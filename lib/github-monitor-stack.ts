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
import { ApiGatewayToLambda } from '@aws-solutions-constructs/aws-apigateway-lambda';
import { LambdaToSns } from '@aws-solutions-constructs/aws-lambda-sns';
import { Environments, AppConfig } from './config';
import { isEnvironment } from './helpers';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';

/**
 * This stack implements a serverless GitHub webhook processor using API Gateway, Lambda, and SNS,
 * leveraging vetted AWS Solutions Constructs patterns to enforce security and best practices.
 *
 * It prioritizes the use of L3 constructs and validates GitHub webhook requests at the API Gateway level,
 * with an additional signature verification performed inside the Lambda function.
 */
export class GitHubMonitor extends Stack {
  constructor(scope: Construct, id: string, { appConfig, ...stackProps }: GitHubMonitorStackProps) {
    super(scope, id, stackProps);
    const processorFunction = createProcessorFunction(this, appConfig);

    new Webhook(this, `${appConfig.STACK_NAME}-webhook`, processorFunction, appConfig);

    new Notification(this, `${appConfig.STACK_NAME}-notification`, processorFunction, appConfig);
  }
}

class Webhook extends Construct {
  public apiGateway: RestApi;
  public apiGatewayLambda: ApiGatewayToLambda;
  private readonly stackName: string;

  constructor(scope: Construct, id: string, lambdaFunction: NodejsFunction, appConfig: AppConfig) {
    super(scope, id);
    this.stackName = appConfig.STACK_NAME;

    // creates api gateway and lambda integrtion using L3 construct
    this.apiGatewayLambda = new ApiGatewayToLambda(this, `${this.stackName}-rest-integration`, {
      existingLambdaObj: lambdaFunction,
      apiGatewayProps: {
        restApiName: this.node.id,
        description: `${this.stackName} webhook receiver`,
        proxy: false,
        deployOptions: {
          stageName: `${this.stackName}-${appConfig.ENVIRONMENT}`,
          loggingLevel: MethodLoggingLevel.INFO,
          dataTraceEnabled: true,
          metricsEnabled: true,
        },
      },
      logGroupProps: {
        logGroupName: `/aws/lambda/${this.stackName}-webhook-processor`,
        retention: RetentionDays.THREE_DAYS,
        removalPolicy: RemovalPolicy.DESTROY,
      },
    });

    this.apiGateway = this.apiGatewayLambda.apiGateway;

    // creates model to validate webhook requests
    const webhookModel = this.apiGateway.addModel(`${this.stackName}WebhookValidation`, {
      modelName: `${this.stackName}WebhookModel`,
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
    const requestValidator = new RequestValidator(this, `${this.stackName}-webhook-validator`, {
      restApi: this.apiGateway,
      validateRequestBody: true,
      validateRequestParameters: true,
      requestValidatorName: this.node.id,
    });

    // Create webhook endpoint and attaches validator and request model to the API
    const webhook = this.apiGateway.root.addResource('webhook');
    webhook.addMethod('POST', new LambdaIntegration(lambdaFunction), {
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

    // Suppress CDK Nag warnings for AWS Solutions Constructs defaults
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

    // Suppress Lambda DLQ SSL warning - DLQ is managed internally by Lambda service
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

    // Add webhook URL output
    new CfnOutput(this, `${this.stackName}-webhook-url`, {
      exportName: `${this.stackName}-webhook-url`,
      value: `${this.apiGateway.url}webhook`,
      description: `${this.stackName} Webhook URL`,
    });
  }
}

// @azarboon: instead of passing entire appconfig, only pass relevant part
class Notification extends Construct {
  constructor(scope: Construct, id: string, lambdaFunction: NodejsFunction, appConfig: AppConfig) {
    super(scope, id);
    // @azarboon: make the this.stackname as private property, like webhook construct
    // @azarboon: remove stackname among required props. like webhook construct
    const stackName = appConfig.STACK_NAME;
    // AWS Solutions Construct: Lambda + SNS
    const lambdaSns = new LambdaToSns(this, `${stackName}-notification-topic`, {
      existingLambdaObj: lambdaFunction,
      topicProps: {
        topicName: this.node.id,
        displayName: `${stackName} Push Notifications`,
      },
    });

    const snsTopic = lambdaSns.snsTopic;

    // Add email subscription to SNS topic
    snsTopic.addSubscription(
      new EmailSubscription(appConfig.NOTIFICATION_EMAIL, {
        json: false,
      })
    );

    // Update Lambda environment with SNS topic ARN
    lambdaFunction.addEnvironment('SNS_TOPIC_ARN', snsTopic.topicArn);
  }
}

export interface GitHubMonitorStackProps extends StackProps {
  appConfig: Readonly<AppConfig>;
}

function createProcessorFunction(scope: Construct, appConfig: AppConfig): NodejsFunction {
  const processorFunction = new NodejsFunction(scope, `${appConfig.STACK_NAME}-processor`, {
    functionName: `${appConfig.STACK_NAME}-processor`,
    runtime: Runtime.NODEJS_22_X,
    architecture: Architecture.ARM_64,
    handler: 'handler',
    entry: 'lambda/processor.ts',
    timeout: Duration.seconds(30),
    memorySize: 256,
    deadLetterQueueEnabled: true,
    retryAttempts: 2,
    layers: [
      LayerVersion.fromLayerVersionArn(
        scope,
        `${appConfig.STACK_NAME}-powertools-layer`,
        `arn:aws:lambda:${Aws.REGION}:094274105915:layer:AWSLambdaPowertoolsTypeScriptV2:33`
      ),
    ],
    environment: {
      GITHUB_WEBHOOK_SECRET: appConfig.GITHUB_WEBHOOK_SECRET,
      GITHUB_REPOSITORY: appConfig.GITHUB_REPOSITORY,
      ENVIRONMENT: appConfig.ENVIRONMENT,
      POWERTOOLS_SERVICE_NAME: `${appConfig.STACK_NAME}-webhook-processor`,
      POWERTOOLS_LOG_LEVEL: isEnvironment(Environments.PROD, appConfig) ? 'INFO' : 'DEBUG',
      POWERTOOLS_METRICS_NAMESPACE: `${appConfig.STACK_NAME}/${appConfig.ENVIRONMENT}`,
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
      ],
      minify: true,
      sourceMap: false,
      target: 'node22',
      forceDockerBundling: false,
    },
  });

  // Add Lambda NAG suppressions
  NagSuppressions.addResourceSuppressions(
    processorFunction.role!,
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
    processorFunction,
    [
      {
        id: 'AwsSolutions-SQS4',
        reason:
          'DLQ is used internally by Lambda service and does not require SSL enforcement. Lambda service handles secure communication to SQS internally.',
      },
    ],
    true
  );

  return processorFunction;
}
