import { Stack, StackProps, Duration, Aws, CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import { Runtime, Architecture, Tracing, LayerVersion } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { EmailSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import {
  RestApi,
  JsonSchemaType,
  RequestValidator,
  LambdaIntegration,
  AuthorizationType,
  MethodLoggingLevel,
} from 'aws-cdk-lib/aws-apigateway';
import { PolicyStatement, Effect, AnyPrincipal } from 'aws-cdk-lib/aws-iam';
import { Queue, QueueEncryption } from 'aws-cdk-lib/aws-sqs';
import { ApiGatewayToLambda } from '@aws-solutions-constructs/aws-apigateway-lambda';
import { LambdaToSns } from '@aws-solutions-constructs/aws-lambda-sns';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';

/**
 * Properties for WebhookApiConstruct
 */
interface WebhookApiProps {
  readonly stackName: string;
  readonly environment: string;
  readonly githubRepository: string;
  readonly webhookSecret: string;
  readonly deadLetterQueue: Queue;
}

/**
 * Webhook API Construct - Encapsulates API Gateway + Lambda using Solutions Constructs
 */
class WebhookApiConstruct extends Construct {
  public readonly apiGateway: RestApi;
  public readonly lambdaFunction: NodejsFunction;
  public readonly apiGatewayLambda: ApiGatewayToLambda;

  constructor(scope: Construct, id: string, props: WebhookApiProps) {
    super(scope, id);

    const { stackName, environment, githubRepository, webhookSecret, deadLetterQueue } = props;

    // Create NodejsFunction with automatic bundling
    this.lambdaFunction = new NodejsFunction(this, `${stackName}-webhook-processor`, {
      functionName: `${stackName}-webhook-processor`,
      runtime: Runtime.NODEJS_22_X,
      architecture: Architecture.X86_64,
      handler: 'handler',
      entry: 'lambda/processor.ts',
      timeout: Duration.seconds(30),
      memorySize: 256,
      deadLetterQueue,
      retryAttempts: 2,
      layers: [
        LayerVersion.fromLayerVersionArn(
          this,
          `${stackName}-powertools-layer`,
          `arn:aws:lambda:${Aws.REGION}:094274105915:layer:AWSLambdaPowertoolsTypeScriptV2:33`
        ),
      ],
      environment: {
        GITHUB_REPOSITORY: githubRepository,
        ENVIRONMENT: environment,
        GITHUB_WEBHOOK_SECRET: webhookSecret,
        POWERTOOLS_SERVICE_NAME: `${stackName}-webhook-processor`,
        POWERTOOLS_LOG_LEVEL: environment === 'prod' ? 'INFO' : 'DEBUG',
        POWERTOOLS_METRICS_NAMESPACE: `${stackName}/${environment}`,
        POWERTOOLS_LOGGER_SAMPLE_RATE: '0.1',
        POWERTOOLS_LOGGER_LOG_EVENT: 'true',
        POWERTOOLS_TRACER_CAPTURE_RESPONSE: 'true',
        POWERTOOLS_TRACER_CAPTURE_ERROR: 'true',
      },
      tracing: Tracing.ACTIVE,
      bundling: {
        externalModules: [
          '@aws-lambda-powertools/logger',
          '@aws-lambda-powertools/tracer',
          '@aws-lambda-powertools/metrics',
          '@aws-lambda-powertools/parser',
          'aws-sdk',
        ],
        minify: false,
        sourceMap: false,
        target: 'node22',
        forceDockerBundling: false, // Use local esbuild instead of Docker
      },
    });

    // AWS Solutions Construct: API Gateway + Lambda
    this.apiGatewayLambda = new ApiGatewayToLambda(this, `${stackName}-webhook-api`, {
      existingLambdaObj: this.lambdaFunction,
      apiGatewayProps: {
        restApiName: `${stackName}-webhook-api`,
        description: `${stackName} webhook receiver`,
        proxy: false,
        deployOptions: {
          stageName: `${stackName}-${environment}`,
          loggingLevel: MethodLoggingLevel.INFO,
          dataTraceEnabled: true,
          metricsEnabled: true,
        },
      },
      logGroupProps: {
        logGroupName: `/aws/lambda/${stackName}-webhook-processor`,
        retention: RetentionDays.THREE_DAYS,
        removalPolicy: RemovalPolicy.DESTROY,
      },
    });

    this.apiGateway = this.apiGatewayLambda.apiGateway;

    // Add request validation and webhook endpoint
    this.setupWebhookEndpoint(stackName);
    this.setupSecurityPolicies();
    this.addNagSuppressions();
  }

  private setupWebhookEndpoint(stackName: string): void {
    // Add request validation model for GitHub webhooks
    const webhookModel = this.apiGateway.addModel(`${stackName}-webhook-model`, {
      modelName: `${stackName}WebhookModel`,
      contentType: 'application/json',
      schema: {
        type: JsonSchemaType.OBJECT,
        required: ['repository', 'commits'],
        properties: {
          repository: {
            type: JsonSchemaType.OBJECT,
            required: ['full_name'],
            properties: {
              full_name: { type: JsonSchemaType.STRING },
            },
          },
          commits: { type: JsonSchemaType.ARRAY },
          ref: { type: JsonSchemaType.STRING },
          before: { type: JsonSchemaType.STRING },
          after: { type: JsonSchemaType.STRING },
        },
      },
    });

    // Add request validator
    const requestValidator = new RequestValidator(this, `${stackName}-webhook-validator`, {
      restApi: this.apiGateway,
      validateRequestBody: true,
      validateRequestParameters: true,
      requestValidatorName: `${stackName}WebhookValidator`,
    });

    // Create webhook endpoint
    const webhook = this.apiGateway.root.addResource('webhook');
    webhook.addMethod('POST', new LambdaIntegration(this.lambdaFunction), {
      authorizationType: AuthorizationType.NONE,
      requestValidator,
      requestModels: {
        'application/json': webhookModel,
      },
      requestParameters: {
        'method.request.header.X-GitHub-Event': true,
        'method.request.header.X-Hub-Signature-256': true,
        'method.request.header.Content-Type': true,
      },
    });
  }

  private setupSecurityPolicies(): void {
    // Apply resource policy to API Gateway for GitHub IP allowlist
    this.apiGateway.addToResourcePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        principals: [new AnyPrincipal()],
        actions: ['execute-api:Invoke'],
        resources: ['*'],
        conditions: {
          IpAddress: {
            'aws:SourceIp': [
              // GitHub webhook IP ranges (as of 2025)
              '192.30.252.0/22',
              '185.199.108.0/22',
              '140.82.112.0/20',
              '143.55.64.0/20',
            ],
          },
        },
      })
    );
  }

  private addNagSuppressions(): void {
    // Suppress CDK Nag warnings for AWS Solutions Constructs defaults
    NagSuppressions.addResourceSuppressions(
      this.lambdaFunction.role!,
      [
        {
          id: 'AwsSolutions-IAM4',
          reason:
            'NodejsFunction construct uses AWSLambdaBasicExecutionRole managed policy for CloudWatch logs access. This is the standard AWS pattern for Lambda functions.',
          appliesTo: [
            'Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
          ],
        },
        {
          id: 'AwsSolutions-IAM5',
          reason:
            'AWS Solutions Constructs uses wildcard permissions for Lambda CloudWatch logs access. This is a standard pattern for Lambda logging.',
          appliesTo: [
            'Resource::arn:<AWS::Partition>:logs:<AWS::Region>:<AWS::AccountId>:log-group:/aws/lambda/*',
            'Resource::*',
          ],
        },
      ],
      true
    );

    NagSuppressions.addResourceSuppressions(
      this.apiGatewayLambda.apiGatewayCloudWatchRole!,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason:
            'AWS Solutions Constructs uses wildcard permissions for API Gateway CloudWatch logs access. This is required for API Gateway logging functionality.',
          appliesTo: ['Resource::arn:<AWS::Partition>:logs:<AWS::Region>:<AWS::AccountId>:*'],
        },
      ],
      true
    );

    NagSuppressions.addResourceSuppressions(
      this.apiGateway,
      [
        {
          id: 'AwsSolutions-APIG2',
          reason:
            'Request validation is implemented with API Gateway RequestValidator, JSON schema model, and required header validation for X-GitHub-Event, X-Hub-Signature-256, and Content-Type headers. Additional validation is performed in Lambda function.',
        },
        {
          id: 'AwsSolutions-APIG4',
          reason:
            'GitHub webhooks require authorizationType: NONE because GitHub servers need to call our endpoint directly without AWS IAM credentials. Compensating controls: (1) GitHub webhook signature verification in Lambda using HMAC-SHA256, (2) API Gateway resource policy restricting access to GitHub IP ranges, (3) Request validation with required headers and JSON schema.',
        },
        {
          id: 'AwsSolutions-COG4',
          reason:
            'GitHub webhooks require authorizationType: NONE because GitHub servers need to call our endpoint directly without AWS IAM credentials. Compensating controls: (1) GitHub webhook signature verification in Lambda using HMAC-SHA256, (2) API Gateway resource policy restricting access to GitHub IP ranges, (3) Request validation with required headers and JSON schema.',
        },
      ],
      true
    );

    NagSuppressions.addResourceSuppressions(
      this.apiGatewayLambda.apiGateway.deploymentStage,
      [
        {
          id: 'AwsSolutions-APIG3',
          reason:
            'AWS WAFv2 is not required for this development webhook endpoint. In production, consider adding WAFv2 for additional security.',
        },
      ],
      true
    );
  }
}

/**
 * Properties for NotificationConstruct
 */
interface NotificationProps {
  readonly stackName: string;
  readonly lambdaFunction: NodejsFunction;
  readonly notificationEmail: string;
}

/**
 * Notification Construct - Encapsulates SNS using Solutions Constructs
 */
class NotificationConstruct extends Construct {
  public readonly snsTopic: any;
  public readonly lambdaSns: LambdaToSns;

  constructor(scope: Construct, id: string, props: NotificationProps) {
    super(scope, id);

    const { stackName, lambdaFunction, notificationEmail } = props;

    // AWS Solutions Construct: Lambda + SNS
    this.lambdaSns = new LambdaToSns(this, `${stackName}-notification`, {
      existingLambdaObj: lambdaFunction,
      topicProps: {
        topicName: `${stackName}-notification-topic`,
        displayName: `${stackName} Push Notifications`,
      },
    });

    this.snsTopic = this.lambdaSns.snsTopic;

    // Add email subscription to SNS topic
    this.snsTopic.addSubscription(
      new EmailSubscription(notificationEmail, {
        json: false,
      })
    );

    // Update Lambda environment with SNS topic ARN
    lambdaFunction.addEnvironment('SNS_TOPIC_ARN', this.snsTopic.topicArn);
  }
}

/**
 * Properties for MonitoringConstruct
 */
interface MonitoringProps {
  readonly stackName: string;
}

// @azarboon: verify DLQ functionality
/**
 * Monitoring Construct - Encapsulates DLQ and monitoring resources
 */
class MonitoringConstruct extends Construct {
  public readonly deadLetterQueue: Queue;

  constructor(scope: Construct, id: string, props: MonitoringProps) {
    super(scope, id);

    const { stackName } = props;

    // Create Dead Letter Queue for failed invocations
    this.deadLetterQueue = new Queue(this, `${stackName}-webhook-dlq`, {
      queueName: `${stackName}-webhook-dlq`,
      retentionPeriod: Duration.days(14),
      encryption: QueueEncryption.SQS_MANAGED,
    });

    this.addNagSuppressions();
  }

  private addNagSuppressions(): void {
    // Suppress DLQ encryption warning - SQS managed encryption is sufficient for this use case
    NagSuppressions.addResourceSuppressions(
      this.deadLetterQueue,
      [
        {
          id: 'AwsSolutions-SQS3',
          reason:
            'SQS managed encryption is sufficient for webhook processing DLQ. Customer managed KMS keys are not required for this use case.',
        },
        {
          id: 'AwsSolutions-SQS4',
          reason:
            'DLQ is used internally by Lambda service and does not require SSL enforcement. Lambda service handles secure communication to SQS internally.',
        },
      ],
      true
    );
  }
}

/**
 * GitHub Monitor Stack - Built with AWS Solutions Constructs
 *
 * This stack implements a serverless GitHub webhook processor using vetted
 * AWS Solutions Constructs patterns for security and best practices.
 *
 * Architecture:
 * - API Gateway (with GitHub webhook signature verification)
 * - Lambda Function (processes webhooks and extracts git diffs)
 * - SNS Topic (sends email notifications)
 *
 * Security:
 * - GitHub webhook signature verification using HMAC-SHA256
 * - API Gateway with authorizationType: NONE (required for GitHub webhooks)
 * - SNS topic with SSL enforcement and encryption
 * - Least privilege IAM permissions via Solutions Constructs
 */
export class GitHubMonitorStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Environment variables validation
    const validateEnvironment = (): void => {
      const required = ['GITHUB_REPOSITORY', 'NOTIFICATION_EMAIL', 'GITHUB_WEBHOOK_SECRET'];
      const missing = required.filter(key => !process.env[key]);
      if (missing.length) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
      }

      if (!process.env.GITHUB_REPOSITORY?.includes('/')) {
        throw new Error('GITHUB_REPOSITORY must be in format "owner/repo"');
      }
      if (!process.env.NOTIFICATION_EMAIL?.includes('@')) {
        throw new Error('NOTIFICATION_EMAIL must be a valid email');
      }
    };

    validateEnvironment();

    // Environment variables - using nullish coalescing to preserve falsy values
    const githubRepository = process.env.GITHUB_REPOSITORY!;
    const notificationEmail = process.env.NOTIFICATION_EMAIL!;
    const environment = process.env.ENVIRONMENT ?? 'dev';
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET ?? 'my-webhook-secret';
    const stackName = this.stackName;

    // Create monitoring resources (DLQ)
    const monitoring = new MonitoringConstruct(this, `${stackName}-monitoring`, {
      stackName,
    });

    // Create webhook API with Lambda
    const webhookApi = new WebhookApiConstruct(this, `${stackName}-webhook-api`, {
      stackName,
      environment,
      githubRepository,
      webhookSecret,
      deadLetterQueue: monitoring.deadLetterQueue,
    });

    // Create notification system
    const notification = new NotificationConstruct(this, `${stackName}-notification`, {
      stackName,
      lambdaFunction: webhookApi.lambdaFunction,
      notificationEmail,
    });

    // Stack outputs for external reference
    new CfnOutput(this, `${stackName}-webhook-url`, {
      exportName: `${stackName}-webhook-url`,
      value: `https://${webhookApi.apiGateway.restApiId}.execute-api.${Aws.REGION}.amazonaws.com/${webhookApi.apiGateway.deploymentStage.stageName}/webhook`,
      description: `${stackName} Webhook URL`,
    });

    new CfnOutput(this, `${stackName}-topic-arn`, {
      exportName: `${stackName}-topic-arn`,
      value: notification.snsTopic.topicArn,
      description: `${stackName} SNS Topic ARN`,
    });

    new CfnOutput(this, `${stackName}-lambda-function-name`, {
      exportName: `${stackName}-lambda-function-name`,
      value: webhookApi.lambdaFunction.functionName,
      description: `${stackName} Lambda Function Name`,
    });

    new CfnOutput(this, `${stackName}-dlq-arn`, {
      exportName: `${stackName}-dlq-arn`,
      value: monitoring.deadLetterQueue.queueArn,
      description: `${stackName} Dead Letter Queue ARN for failed webhook processing`,
    });
  }
}
