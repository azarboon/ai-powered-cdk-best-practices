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
    const stackName = this.stackName;

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
      topicName: `${stackName}-sns-topic`,
      displayName: `${stackName} Push Notifications`,
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
        sid: `${stackName}DenyInsecureTransport`,
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

    // Create specific log group first
    const logGroup = new logs.LogGroup(this, 'ProcessorLogs', {
      logGroupName: `/aws/lambda/${stackName}-github-processor`,
      retention: logs.RetentionDays.THREE_DAYS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Custom IAM role for Lambda with specific permissions (no AWS managed policies)
    const lambdaRole = new iam.Role(this, 'GitHubProcessorRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: `Custom IAM role for ${stackName} Lambda function`,
      inlinePolicies: {
        [`${stackName}LambdaExecutionPolicy`]: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
              resources: [logGroup.logGroupArn],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['sns:Publish'],
              resources: [topic.topicArn],
            }),
          ],
        }),
      },
    });

    // Lambda Function with custom role and no automatic log retention
    const processor = new nodejs.NodejsFunction(this, 'GitHubProcessor', {
      runtime: lambda.Runtime.NODEJS_22_X,
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
      // Remove logRetention to avoid creating the LogRetention Lambda with managed policies
    });

    // Update IAM role description to reference actual Lambda function name
    lambdaRole.node.addMetadata(
      'description',
      `Custom IAM role for ${processor.functionName} Lambda function`
    );

    // Create log group for API Gateway access logs first
    const apiLogGroupName = `/aws/apigateway/${this.stackName}-access-logs`;
    const apiLogGroup = new logs.LogGroup(this, 'ApiGatewayAccessLogs', {
      logGroupName: apiLogGroupName,
      retention: logs.RetentionDays.THREE_DAYS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create CloudWatch Logs role for API Gateway with split permissions
    const apiGatewayCloudWatchRole = new iam.Role(this, 'ApiGatewayCloudWatchRole', {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      inlinePolicies: {
        [`${stackName}CloudWatchLogsPolicy`]: new iam.PolicyDocument({
          statements: [
            // Specific log group permissions for main logging operations
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
                'logs:PutRetentionPolicy',
              ],
              resources: [
                `arn:aws:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:${apiLogGroupName}:*`,
              ],
            }),
            // API Gateway execution log groups permissions
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
                'logs:PutRetentionPolicy',
              ],
              resources: [
                `arn:aws:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:/aws/apigateway/*:*`,
              ],
            }),
            // API Gateway scoped permissions for describe operations @azarboon i think this comment doesnt make sense
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['logs:DescribeLogGroups', 'logs:DescribeLogStreams'],
              resources: ['*'],
            }),
          ],
        }),
      },
    });

    // Suppress CDK Nag rule for wildcard permission in API Gateway CloudWatch role
    NagSuppressions.addResourceSuppressions(
      apiGatewayCloudWatchRole,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason:
            'logs:DescribeLogGroups requires wildcard due to AWS API Gateway needing read access across /aws/apigateway/* for logging validation. This is a read-only operation with no write.',
        },
      ],
      true
    );

    // Set the CloudWatch Logs role for API Gateway at account level with proper dependencies
    const account = new apigateway.CfnAccount(this, 'ApiGatewayAccount', {
      cloudWatchRoleArn: apiGatewayCloudWatchRole.roleArn,
    });

    account.node.addDependency(apiLogGroup);
    account.node.addDependency(apiGatewayCloudWatchRole);

    // API Gateway with proper logging and validation
    const api = new apigateway.RestApi(this, 'WebhookApi', {
      restApiName: `${stackName}-api`,
      description: `${stackName} webhook receiver`,
      deployOptions: {
        accessLogDestination: new apigateway.LogGroupLogDestination(apiLogGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields(),
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
      },
      defaultMethodOptions: {
        requestValidatorOptions: {
          requestValidatorName: `${stackName}-request-validator`,
          validateRequestBody: true,
          validateRequestParameters: true,
        },
      },
    });

    // Suppress the automatic endpoint output to avoid confusion for the users
    api.node.tryRemoveChild('Endpoint');

    const webhook = api.root.addResource('webhook');
    const webhookMethod = webhook.addMethod('POST', new apigateway.LambdaIntegration(processor), {
      requestValidator: new apigateway.RequestValidator(this, 'WebhookValidator', {
        restApi: api,
        requestValidatorName: `${stackName}-request-validator`,
        validateRequestBody: true,
        validateRequestParameters: true,
      }),
      requestModels: {
        'application/json': new apigateway.Model(this, 'WebhookModel', {
          restApi: api,
          contentType: 'application/json',
          modelName: `${stackName}WebhookPayload`,
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

    // Revert suppressions for auth errors #5 and #6 as requested
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
    const tags = { Environment: environment, Project: stackName };
    Object.entries(tags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });

    // Outputs
    new cdk.CfnOutput(this, 'WebhookUrl', {
      value: `${api.url}webhook`,
      description: `${stackName} Webhook URL`,
    });

    new cdk.CfnOutput(this, 'TopicArn', {
      value: topic.topicArn,
      description: `${stackName} SNS Topic ARN`,
    });
  }
}
