/**
 * GitHub Monitor Stack.
 *
 * Architecture: API Gateway → Lambda → SNS
 * Replaces: 8 services with 3 services
 */

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as iam from 'aws-cdk-lib/aws-iam';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';

export class GitHubMonitorStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const githubRepository = process.env.GITHUB_REPOSITORY!;
    const notificationEmail = process.env.NOTIFICATION_EMAIL!;
    const environment = process.env.ENVIRONMENT || 'dev';

    // Validate required env vars exists
    if (!githubRepository || !githubRepository.includes('/')) {
      console.log('DEBUG: Validation failed. githubRepository =', JSON.stringify(githubRepository));
      throw new Error('GITHUB_REPOSITORY must be in format "owner/repo"');
    }
    if (!notificationEmail || !notificationEmail.includes('@')) {
      throw new Error('NOTIFICATION_EMAIL must be a valid email');
    }

    // SNS Topic with SSL enforcement
    const topic = new sns.Topic(this, 'GitHubTopic', {
      topicName: 'github-notifications',
      displayName: 'GitHub Push Notifications',
    });

    /*
  The following block of code attaches a dedicated TopicPolicy to the SNS topic to enforce secure (SSL/TLS) publishing.

  This policy explicitly denies any SNS:Publish requests made over insecure (non-HTTPS) transport
  by evaluating the 'aws:SecureTransport' condition. Using an Effect of DENY ensures that
  all insecure publishing attempts are blocked, regardless of other permissions granted.

  While this policy could technically be applied inline via topic.addToResourcePolicy(),
  the AWS Solutions cdk-nag rule (AwsSolutions-SNS3) requires that an explicit
  AWS::SNS::TopicPolicy CloudFormation resource exists.

  By using sns.TopicPolicy and attaching this denial statement, we ensure compliance with
  AWS security best practices and pass the cdk-nag security check for SSL enforcement.
*/

    new sns.TopicPolicy(this, 'GitHubTopicPolicy', {
      topics: [topic],
    }).document.addStatements(
      new iam.PolicyStatement({
        sid: 'DenyInsecureTransport',
        effect: iam.Effect.DENY,
        actions: ['SNS:Publish'],
        principals: [new iam.AnyPrincipal()],
        resources: [topic.topicArn],
        conditions: {
          Bool: {
            'aws:SecureTransport': 'false',
          },
        },
      })
    );

    // Add email subscription with explicit construct ID
    topic.addSubscription(
      new subscriptions.EmailSubscription(notificationEmail, {
        json: false,
      })
    );

    // Custom IAM role for Lambda with minimal permissions
    const lambdaRole = new iam.Role(this, 'GitHubProcessorRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'IAM role for GitHub processor Lambda function',
    });

    // Lambda Function with latest runtime
    const processor = new nodejs.NodejsFunction(this, 'GitHubProcessor', {
      runtime: lambda.Runtime.NODEJS_22_X, // Latest available runtime
      architecture: lambda.Architecture.X86_64,
      entry: 'lambda/processor.ts',
      handler: 'handler',
      timeout: cdk.Duration.seconds(15),
      memorySize: 512,
      role: lambdaRole,
      environment: {
        GITHUB_REPOSITORY: githubRepository,
        SNS_TOPIC_ARN: topic.topicArn,
        ENVIRONMENT: environment,
      },
    });

    // Create Log Group first to get its ARN
    const logGroup = new logs.LogGroup(this, 'ProcessorLogs', {
      logGroupName: `/aws/lambda/${processor.functionName}`,
      retention: logs.RetentionDays.THREE_DAYS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Add specific permissions to the role using log group ARN - no wildcards
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
        resources: [logGroup.logGroupArn],
      })
    );

    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['sns:Publish'],
        resources: [topic.topicArn],
      })
    );

    // API Gateway with access logging
    const api = new apigateway.RestApi(this, 'GitHubApi', {
      restApiName: 'GitHub Webhook API',
      description: 'GitHub webhook receiver',
      deployOptions: {
        accessLogDestination: new apigateway.LogGroupLogDestination(
          new logs.LogGroup(this, 'ApiGatewayAccessLogs', {
            logGroupName: `/aws/apigateway/${this.stackName}-access-logs`,
            retention: logs.RetentionDays.THREE_DAYS,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
          })
        ),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
          caller: true,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: true,
        }),
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
      },
      defaultMethodOptions: {
        requestValidatorOptions: {
          requestValidatorName: 'webhook-validator',
          validateRequestBody: true,
          validateRequestParameters: true,
        },
      },
    });

    const webhook = api.root.addResource('webhook');
    const webhookMethod = webhook.addMethod('POST', new apigateway.LambdaIntegration(processor), {
      requestValidator: new apigateway.RequestValidator(this, 'WebhookValidator', {
        restApi: api,
        requestValidatorName: 'webhook-request-validator',
        validateRequestBody: true,
        validateRequestParameters: true,
      }),
      requestModels: {
        'application/json': new apigateway.Model(this, 'WebhookModel', {
          restApi: api,
          contentType: 'application/json',
          modelName: 'WebhookPayload',
          schema: {
            type: apigateway.JsonSchemaType.OBJECT,
            properties: {
              ref: { type: apigateway.JsonSchemaType.STRING },
              repository: { type: apigateway.JsonSchemaType.OBJECT },
              commits: { type: apigateway.JsonSchemaType.ARRAY },
            },
            required: ['repository'],
          },
        }),
      },
    });

    // Suppress CDK Nag rules for webhook endpoint - authorization intentionally disabled for GitHub webhooks
    NagSuppressions.addResourceSuppressions(webhookMethod, [
      {
        id: 'AwsSolutions-APIG4',
        reason:
          'For simplicity during development, authentication has been omitted from the API. However, proper authentication and authorization must be implemented before deploying to production.',
      },
      {
        id: 'AwsSolutions-COG4',
        reason:
          'For simplicity during development, authentication has been omitted from the API. However, proper authentication and authorization must be implemented before deploying to production.',
      },
    ]);

    // Tags
    const tags = { Environment: environment, Project: 'GitHubMonitor' };
    Object.entries(tags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });

    // Outputs
    new cdk.CfnOutput(this, 'WebhookUrl', {
      value: `${api.url}webhook`,
      description: 'GitHub Webhook URL',
    });

    new cdk.CfnOutput(this, 'TopicArn', {
      value: topic.topicArn,
      description: 'SNS Topic ARN',
    });
  }
}
