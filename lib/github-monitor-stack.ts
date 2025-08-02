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
import { Construct } from 'constructs';

export class GitHubMonitorStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const githubRepository = process.env.GITHUB_REPOSITORY!;
    const notificationEmail = process.env.NOTIFICATION_EMAIL!;
    const environment = process.env.ENVIRONMENT || 'dev';

    // Validate inputs
    if (!githubRepository || !githubRepository.includes('/')) {
      console.log('DEBUG: Validation failed. githubRepository =', JSON.stringify(githubRepository));
      throw new Error('GITHUB_REPOSITORY must be in format "owner/repo"');
    }
    if (!notificationEmail || !notificationEmail.includes('@')) {
      throw new Error('NOTIFICATION_EMAIL must be a valid email');
    }

    // SNS Topic
    const topic = new sns.Topic(this, 'GitHubTopic', {
      topicName: 'github-notifications',
      displayName: 'GitHub Push Notifications',
    });

    // Add email subscription with explicit construct ID
    topic.addSubscription(
      new subscriptions.EmailSubscription(notificationEmail, {
        json: false,
      })
    );

    // Lambda Function
    const processor = new nodejs.NodejsFunction(this, 'GitHubProcessor', {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64, // Changed from ARM64 for Docker compatibility
      entry: 'lambda/processor.ts',
      handler: 'handler',
      timeout: cdk.Duration.seconds(15),
      memorySize: 512,
      environment: {
        GITHUB_REPOSITORY: githubRepository,
        SNS_TOPIC_ARN: topic.topicArn,
        ENVIRONMENT: environment,
      },
    });

    topic.grantPublish(processor);

    // Log Group
    new logs.LogGroup(this, 'ProcessorLogs', {
      logGroupName: `/aws/lambda/${processor.functionName}`,
      retention: logs.RetentionDays.THREE_DAYS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // API Gateway
    const api = new apigateway.RestApi(this, 'GitHubApi', {
      restApiName: 'GitHub Webhook API',
      description: 'GitHub webhook receiver',
    });

    const webhook = api.root.addResource('webhook');
    webhook.addMethod('POST', new apigateway.LambdaIntegration(processor));

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
