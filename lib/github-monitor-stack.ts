import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
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

    // AWS Solutions Construct: API Gateway + Lambda
    // This pattern provides secure API Gateway with Lambda integration,
    // including proper IAM roles, CloudWatch logging, and X-Ray tracing
    const apiGatewayLambda = new ApiGatewayToLambda(this, 'GitHubWebhookApi', {
      lambdaFunctionProps: {
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.X86_64,
        handler: 'processor.handler',
        code: lambda.Code.fromAsset('lambda'),
        timeout: cdk.Duration.seconds(15),
        memorySize: 512,
        environment: {
          GITHUB_REPOSITORY: githubRepository,
          ENVIRONMENT: environment,
          GITHUB_WEBHOOK_SECRET: webhookSecret,
        },
      },
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
      existingLambdaObj: apiGatewayLambda.lambdaFunction, // Reuse Lambda from API Gateway pattern
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
    apiGatewayLambda.lambdaFunction.addEnvironment('SNS_TOPIC_ARN', lambdaSns.snsTopic.topicArn);

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
    webhook.addMethod('POST', new apigateway.LambdaIntegration(apiGatewayLambda.lambdaFunction), {
      authorizationType: apigateway.AuthorizationType.NONE, // Required for GitHub webhooks - see comments above
    });

    // Suppress CDK Nag warnings for AWS Solutions Constructs defaults
    NagSuppressions.addResourceSuppressions(
      apiGatewayLambda.lambdaFunction.role!,
      [
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
            'Request validation is handled at the application level in the Lambda function. API Gateway request validation is not required for this webhook endpoint.',
        },
        {
          id: 'AwsSolutions-APIG4',
          reason:
            'GitHub webhooks require authorizationType: NONE because GitHub servers need to call our endpoint directly without AWS IAM credentials. Security is provided through GitHub webhook signature verification in the Lambda function using HMAC-SHA256.',
        },
        {
          id: 'AwsSolutions-COG4',
          reason:
            'GitHub webhooks require authorizationType: NONE because GitHub servers need to call our endpoint directly without AWS IAM credentials. Security is provided through GitHub webhook signature verification in the Lambda function using HMAC-SHA256.',
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
      value: apiGatewayLambda.lambdaFunction.functionName,
      description: `${stackName} Lambda Function Name`,
    });
  }
}
