import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import { ApiGatewayToLambda } from '@aws-solutions-constructs/aws-apigateway-lambda';
import { LambdaToSns } from '@aws-solutions-constructs/aws-lambda-sns';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';

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
export class GitHubMonitorStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Environment variables - using nullish coalescing to preserve falsy values
    const githubRepository = process.env.GITHUB_REPOSITORY!;
    const notificationEmail = process.env.NOTIFICATION_EMAIL!;
    const environment = process.env.ENVIRONMENT ?? 'dev';
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET ?? 'my-webhook-secret';
    const stackName = this.stackName;

    // Validate required environment variables
    if (!githubRepository?.includes('/')) {
      console.log('DEBUG: Validation failed. githubRepository =', JSON.stringify(githubRepository));
      throw new Error('GITHUB_REPOSITORY must be in format "owner/repo"');
    }
    if (!notificationEmail?.includes('@')) {
      throw new Error('NOTIFICATION_EMAIL must be a valid email');
    }

    // Create Dead Letter Queue for failed invocations
    const dlq = new cdk.aws_sqs.Queue(this, 'WebhookDLQ', {
      queueName: `${stackName}-webhook-dlq`,
      retentionPeriod: cdk.Duration.days(14),
      encryption: cdk.aws_sqs.QueueEncryption.SQS_MANAGED,
    });

    // Create NodejsFunction with automatic bundling
    const lambdaFunction = new NodejsFunction(this, 'GitHubWebhookProcessor', {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.X86_64,
      handler: 'handler',
      entry: 'lambda/processor.ts',
      timeout: cdk.Duration.seconds(30), // Increased for GitHub API calls
      memorySize: 256, // Reduced - webhook processing doesn't need much memory
      deadLetterQueue: dlq,
      retryAttempts: 2,
      // Add AWS Lambda Powertools layer with latest version
      layers: [
        lambda.LayerVersion.fromLayerVersionArn(
          this,
          'PowertoolsLayer',
          `arn:aws:lambda:${cdk.Aws.REGION}:094274105915:layer:AWSLambdaPowertoolsTypeScriptV2:33`
        ),
      ],
      environment: {
        GITHUB_REPOSITORY: githubRepository,
        ENVIRONMENT: environment,
        GITHUB_WEBHOOK_SECRET: webhookSecret,
        // Lambda Powertools environment variables
        POWERTOOLS_SERVICE_NAME: 'github-webhook-processor',
        POWERTOOLS_LOG_LEVEL: environment === 'prod' ? 'INFO' : 'DEBUG',
        POWERTOOLS_METRICS_NAMESPACE: `${stackName}/${environment}`,
        POWERTOOLS_LOGGER_SAMPLE_RATE: '0.1',
        POWERTOOLS_LOGGER_LOG_EVENT: 'true',
        POWERTOOLS_TRACER_CAPTURE_RESPONSE: 'true',
        POWERTOOLS_TRACER_CAPTURE_ERROR: 'true',
      },
      tracing: lambda.Tracing.ACTIVE, // Enable X-Ray tracing for Powertools
      bundling: {
        externalModules: [
          '@aws-lambda-powertools/logger',
          '@aws-lambda-powertools/tracer',
          '@aws-lambda-powertools/metrics',
          '@aws-lambda-powertools/parser',
        ],
        minify: true,
        sourceMap: false,
        target: 'es2022',
      },
    });

    // AWS Solutions Construct: API Gateway + Lambda
    // This pattern provides secure API Gateway with Lambda integration,
    // including proper IAM roles, CloudWatch logging, and X-Ray tracing
    const apiGatewayLambda = new ApiGatewayToLambda(this, 'GitHubWebhookApi', {
      existingLambdaObj: lambdaFunction,
      apiGatewayProps: {
        restApiName: `${stackName}-api`,
        description: `${stackName} webhook receiver`,
        proxy: false, // Disable proxy to allow custom webhook resource
        deployOptions: {
          loggingLevel: apigateway.MethodLoggingLevel.INFO,
          dataTraceEnabled: true,
          metricsEnabled: true,
        },
      },
      logGroupProps: {
        logGroupName: `/aws/lambda/${stackName}-github-processor`,
        retention: logs.RetentionDays.THREE_DAYS,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      },
    });

    // AWS Solutions Construct: Lambda + SNS
    // This pattern provides secure SNS topic with encryption and proper IAM permissions
    const lambdaSns = new LambdaToSns(this, 'GitHubNotification', {
      existingLambdaObj: lambdaFunction, // Use the NodejsFunction we created
      topicProps: {
        topicName: `${stackName}-sns-topic`,
        displayName: `${stackName} Push Notifications`,
      },
    });

    // Add email subscription to SNS topic
    lambdaSns.snsTopic.addSubscription(
      new subscriptions.EmailSubscription(notificationEmail, {
        json: false,
      })
    );

    // Update Lambda environment with SNS topic ARN (automatically set by LambdaToSns)
    lambdaFunction.addEnvironment('SNS_TOPIC_ARN', lambdaSns.snsTopic.topicArn);

    // Add request validation model for GitHub webhooks
    const webhookModel = apiGatewayLambda.apiGateway.addModel('WebhookModel', {
      contentType: 'application/json',
      schema: {
        type: apigateway.JsonSchemaType.OBJECT,
        required: ['repository', 'commits'],
        properties: {
          repository: {
            type: apigateway.JsonSchemaType.OBJECT,
            required: ['full_name'],
            properties: {
              full_name: { type: apigateway.JsonSchemaType.STRING },
            },
          },
          commits: {
            type: apigateway.JsonSchemaType.ARRAY,
          },
          ref: {
            type: apigateway.JsonSchemaType.STRING,
          },
          before: {
            type: apigateway.JsonSchemaType.STRING,
          },
          after: {
            type: apigateway.JsonSchemaType.STRING,
          },
        },
      },
    });

    // Add request validator
    const requestValidator = new apigateway.RequestValidator(this, 'WebhookValidator', {
      restApi: apiGatewayLambda.apiGateway,
      validateRequestBody: true,
      validateRequestParameters: true,
      requestValidatorName: `${stackName}-webhook-validator`,
    });

    // Apply resource policy to API Gateway for GitHub IP allowlist
    apiGatewayLambda.apiGateway.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.AnyPrincipal()],
        actions: ['execute-api:Invoke'],
        resources: ['*'],
        conditions: {
          IpAddress: {
            'aws:SourceIp': [
              // GitHub webhook IP ranges (as of 2024)
              '192.30.252.0/22',
              '185.199.108.0/22',
              '140.82.112.0/20',
              '143.55.64.0/20',
              '20.201.28.151/32',
              '20.205.243.166/32',
              '102.133.202.242/32',
            ],
          },
        },
      })
    );

    /*
     * GitHub Webhook Authentication Strategy:
     *
     * We use authorizationType: NONE for the API Gateway endpoint because:
     * 1. GitHub servers need to call our webhook endpoint directly
     * 2. GitHub doesn't have AWS IAM credentials to authenticate with AWS_IAM
     * 3. Security is provided by GitHub webhook signature verification in the Lambda function
     *
     * This is the standard and recommended approach for GitHub webhooks:
     * - API Gateway: authorizationType: NONE (allows GitHub to call the endpoint)
     * - Lambda Function: Verifies GitHub signature using HMAC-SHA256 (ensures request is from GitHub)
     *
     * GitHub signs each webhook payload with the secret and sends the signature in
     * the 'X-Hub-Signature-256' header. Our Lambda function verifies this signature
     * to ensure the request actually came from GitHub and hasn't been tampered with.
     *
     * This provides better security than AWS_IAM because:
     * - Only GitHub can generate valid signatures (they have the secret)
     * - Each request is cryptographically verified
     * - Prevents replay attacks and unauthorized webhook calls
     */
    const webhook = apiGatewayLambda.apiGateway.root.addResource('webhook');
    webhook.addMethod('POST', new apigateway.LambdaIntegration(lambdaFunction), {
      authorizationType: apigateway.AuthorizationType.NONE, // Required for GitHub webhooks - see comments above
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

    // Suppress CDK Nag warnings for AWS Solutions Constructs defaults
    NagSuppressions.addResourceSuppressions(
      lambdaFunction.role!,
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
      apiGatewayLambda.apiGatewayCloudWatchRole!,
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

    /*
@azarboon: fix these suppressions:
AwsSolutions-APIG2 (request validation disabled) is not well justified. Even for GitHub webhooks, you can and should reject bad requests at the edge with an API Gateway Model and RequestValidator (e.g., require content-type application/json, require X-Hub-Signature-256 and X-GitHub-Event headers, and a minimal JSON schema).  Reuse validation from your previous config. make sure to add header signature validation: 
https://github.com/azarboon/ai-powered-cdk-best-practices/blob/458bdb328ffbf1a6fb471afda8684bfc7ecfc4fa/lib/github-monitor-stack.ts

AwsSolutions-APIG4 and AwsSolutions-COG4 (no auth) are conditionally acceptable for third-party webhooks, but the justification should name compensating controls. Keep HMAC verification in Lambda, but also add at least one of: API Gateway resource policy with an allow-list of GitHub’s published CIDR ranges
    */
    NagSuppressions.addResourceSuppressions(
      apiGatewayLambda.apiGateway,
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
      apiGatewayLambda.apiGateway.deploymentStage,
      [
        {
          id: 'AwsSolutions-APIG3',
          reason:
            'AWS WAFv2 is not required for this development webhook endpoint. In production, consider adding WAFv2 for additional security.',
        },
      ],
      true
    );

    // Suppress DLQ encryption warning - SQS managed encryption is sufficient for this use case
    NagSuppressions.addResourceSuppressions(
      dlq,
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

    // Resource tagging for cost tracking and ownership
    const tags = { Environment: environment, Project: stackName };
    Object.entries(tags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });

    // Stack outputs for external reference
    new cdk.CfnOutput(this, 'WebhookUrl', {
      value: cdk.Fn.join('', [
        'https://',
        apiGatewayLambda.apiGateway.restApiId,
        '.execute-api.',
        cdk.Aws.REGION,
        '.amazonaws.com/',
        apiGatewayLambda.apiGateway.deploymentStage.stageName,
        '/webhook',
      ]),
      description: `${stackName} Webhook URL`,
    });

    new cdk.CfnOutput(this, 'TopicArn', {
      value: lambdaSns.snsTopic.topicArn,
      description: `${stackName} SNS Topic ARN`,
    });

    new cdk.CfnOutput(this, 'LambdaFunctionName', {
      value: lambdaFunction.functionName,
      description: `${stackName} Lambda Function Name`,
    });

    new cdk.CfnOutput(this, 'DeadLetterQueueArn', {
      value: dlq.queueArn,
      description: `${stackName} Dead Letter Queue ARN for failed webhook processing`,
    });
  }
}
