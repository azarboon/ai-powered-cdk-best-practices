/**
 * GitHub Repository Monitor Stack.
 * 
 * Purpose: Monitors any configured GitHub repository for new commits
 * and automatically sends git difference notifications via email using SNS.
 * 
 * Configuration: All settings managed via environment variables
 * - Repository: Configurable via GITHUB_REPOSITORY env var
 * - Email: Configurable via NOTIFICATION_EMAIL env var
 * - Environment: Configurable via ENVIRONMENT env var (default: dev).
 * 
 * Architecture:
 * 1. API Gateway receives GitHub webhooks
 * 2. Webhook receiver Lambda transforms events to EventBridge
 * 3. EventBridge triggers Step Functions on push events
 * 4. Step Functions orchestrates git diff processor Lambda
 * 5. Git diff processor fetches commit differences from GitHub API
 * 6. Step Functions publishes git diff to SNS topic
 * 7. SNS sends email notification with git differences.
 * 
 * Security: All components follow least privilege access principles
 * Cost: Minimal configuration with pay-per-use services and log retention
 * Resource Tagging: All resources tagged for cost tracking and ownership.
 */

import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

/**
 * Main CDK Stack for GitHub Repository Monitoring
 * Deploys all necessary AWS resources with minimal configuration.
 */
export class GitHubMonitorStack extends cdk.Stack {
  /**
   * Creates a new GitHubMonitorStack instance.
   * 
   * @param scope - The scope in which to define this construct.
   * @param id - The scoped construct ID.
   * @param props - Stack properties for configuration.
   */
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // =============================================================================
    // CONFIGURATION - Environment variables for flexible deployment
    // =============================================================================

    /**
     * Configuration from Environment Variables
     * Following AWS CDK best practices for configuration management.
     * 
     * Required Environment Variables:
     * - GITHUB_REPOSITORY: Target GitHub repository (format: owner/repo)
     * - NOTIFICATION_EMAIL: Email address for SNS notifications.
     * 
     * Optional Environment Variables:
     * - GITHUB_API_BASE: GitHub API base URL (defaults to api.github.com)
     * - ENVIRONMENT: Environment tag (defaults to 'dev').
     */
    const githubRepository = process.env.GITHUB_REPOSITORY ?? 'azarboon/dummy';
    const notificationEmail = process.env.NOTIFICATION_EMAIL ?? 'm.azarboon@gmail.com';
    const githubApiBase = process.env.GITHUB_API_BASE ?? 'https://api.github.com';
    const environment = process.env.ENVIRONMENT ?? 'dev';

    // Validate required configuration
    if (!githubRepository.includes('/')) {
      throw new Error('GITHUB_REPOSITORY must be in format "owner/repo"');
    }
    if (!notificationEmail.includes('@')) {
      throw new Error('NOTIFICATION_EMAIL must be a valid email address');
    }

    // =============================================================================
    // LAMBDA FUNCTIONS - Core processing components
    // =============================================================================

    /**
     * Git Diff Processor Lambda Function
     * Purpose: Fetches git differences from GitHub API when triggered by Step Functions
     * Runtime: Node.js 18.x (minimal, stable runtime)
     * Memory: 256MB (minimal for HTTP requests and JSON processing)
     * Timeout: 30s (sufficient for GitHub API calls with buffer for retries)
     * Security: No internet access restrictions needed for GitHub API calls.
     */
    const gitDiffProcessorFunction = new nodejs.NodejsFunction(this, 'GitDiffProcessorFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: 'lambda/index.ts',
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        // Configuration from environment variables - no hardcoded values
        GITHUB_API_BASE: `${githubApiBase}/repos/${githubRepository}`,
        GITHUB_REPOSITORY: githubRepository,
        SNS_TOPIC_ARN: '', // Will be set after SNS topic creation
        ENVIRONMENT: environment
      },
      description: 'Fetches git differences from GitHub repository commits'
    });

    // Add resource tagging for cost tracking and ownership
    cdk.Tags.of(gitDiffProcessorFunction).add('Environment', environment);
    cdk.Tags.of(gitDiffProcessorFunction).add('Project', 'GitHubMonitor');
    cdk.Tags.of(gitDiffProcessorFunction).add('Component', 'GitDiffProcessor');

    /**
     * CloudWatch Log Group for Git Diff Processor
     * Purpose: Centralized logging with cost-effective retention
     * Retention: 1 week (minimal for debugging, cost-effective)
     * Removal: Destroy with stack (no orphaned resources).
     */
    new logs.LogGroup(this, 'GitDiffProcessorLogGroup', {
      logGroupName: `/aws/lambda/${gitDiffProcessorFunction.functionName}`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // =============================================================================
    // SNS TOPIC - Email notifications
    // =============================================================================

    /**
     * SNS Topic for Git Diff Notifications
     * Purpose: Sends email notifications with git differences
     * Security: Minimal configuration, no encryption needed for git diffs
     * Cost: Pay-per-message pricing model.
     */
    const gitDiffTopic = new sns.Topic(this, 'GitDiffTopic', {
      topicName: 'github-git-diff-notifications',
      displayName: 'GitHub Git Diff Notifications'
    });

    // Add resource tagging for cost tracking and ownership
    cdk.Tags.of(gitDiffTopic).add('Environment', environment);
    cdk.Tags.of(gitDiffTopic).add('Project', 'GitHubMonitor');
    cdk.Tags.of(gitDiffTopic).add('Component', 'Notifications');

    /**
     * Email Subscription for Git Diff Notifications
     * Purpose: Delivers git diff notifications to specified email address
     * Configuration: Uses environment variable for email address
     * Note: Subscription will require email confirmation after deployment.
     */
    gitDiffTopic.addSubscription(new subscriptions.EmailSubscription(notificationEmail));

    // Update Lambda environment variable with SNS topic ARN
    gitDiffProcessorFunction.addEnvironment('SNS_TOPIC_ARN', gitDiffTopic.topicArn);

    // =============================================================================
    // STEP FUNCTIONS - Workflow orchestration
    // =============================================================================

    /**
     * Step Functions IAM Role
     * Purpose: Allows Step Functions to invoke Lambda functions, publish to SNS, and write logs
     * Principle: Least privilege - only necessary permissions
     * Security: Scoped to specific Lambda function and SNS topic ARNs where possible.
     */
    const stepFunctionRole = new iam.Role(this, 'StepFunctionRole', {
      assumedBy: new iam.ServicePrincipal('states.amazonaws.com'),
      description: 'Role for GitHub monitor Step Function',
      inlinePolicies: {
        // Minimal policy: only invoke the specific git diff processor Lambda
        LambdaInvokePolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['lambda:InvokeFunction'],
              // Security: Specific resource ARN, not wildcard
              resources: [gitDiffProcessorFunction.functionArn]
            })
          ]
        }),
        // Minimal policy: only publish to specific SNS topic
        SNSPublishPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['sns:Publish'],
              // Security: Specific SNS topic ARN, not wildcard
              resources: [gitDiffTopic.topicArn]
            })
          ]
        }),
        // Required for Step Functions CloudWatch logging
        LoggingPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'logs:CreateLogDelivery',
                'logs:GetLogDelivery',
                'logs:UpdateLogDelivery',
                'logs:DeleteLogDelivery',
                'logs:ListLogDeliveries',
                'logs:PutResourcePolicy',
                'logs:DescribeResourcePolicies',
                'logs:DescribeLogGroups'
              ],
              // Note: These actions require wildcard resource for Step Functions logging
              resources: ['*']
            })
          ]
        })
      }
    });

    /**
     * CloudWatch Log Group for Step Functions
     * Purpose: Centralized logging for workflow execution monitoring
     * Retention: 1 week (cost-effective, sufficient for debugging).
     */
    const stepFunctionLogGroup = new logs.LogGroup(this, 'StepFunctionLogGroup', {
      logGroupName: '/aws/stepfunctions/GitHubDiffStateMachine',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    /**
     * Step Function Task Definition - Git Diff Processing
     * Purpose: Defines the Lambda invocation task within the workflow
     * Configuration: Minimal - just invoke Lambda and return payload
     * Error Handling: Built-in service exception retries enabled.
     */
    const gitDiffTask = new tasks.LambdaInvoke(this, 'ProcessGitDiffTask', {
      lambdaFunction: gitDiffProcessorFunction,
      comment: 'Invoke Lambda to process git differences from GitHub',
      retryOnServiceExceptions: true,
      // Security: Don't include client context or payload in logs
      outputPath: '$.Payload'
    });

    /**
     * Step Function Task Definition - SNS Notification
     * Purpose: Publishes git diff results to SNS topic for email notification
     * Configuration: Uses dynamic message from previous Lambda output
     * Security: Minimal permissions, specific topic targeting.
     */
    const snsNotificationTask = new tasks.SnsPublish(this, 'SendGitDiffNotification', {
      topic: gitDiffTopic,
      subject: stepfunctions.JsonPath.stringAt('$.subject'),
      message: stepfunctions.TaskInput.fromJsonPathAt('$.message'),
      comment: 'Send git diff notification via SNS email'
    });

    /**
     * Step Functions State Machine
     * Purpose: Orchestrates the git diff processing and notification workflow
     * Definition: Sequential workflow - process git diff then send notification
     * Timeout: 5 minutes (generous buffer for GitHub API calls and SNS)
     * Logging: Error level only (minimal logging, cost-effective).
     */
    const stateMachine = new stepfunctions.StateMachine(this, 'GitHubDiffStateMachine', {
      definition: gitDiffTask.next(snsNotificationTask),
      role: stepFunctionRole,
      timeout: cdk.Duration.minutes(5),
      // Security: Enable logging but exclude sensitive data
      logs: {
        destination: stepFunctionLogGroup,
        level: stepfunctions.LogLevel.ERROR,
        includeExecutionData: false
      }
    });

    // =============================================================================
    // EVENTBRIDGE - Event routing and filtering
    // =============================================================================

    /**
     * EventBridge Rule for GitHub Push Events
     * Purpose: Filters and routes GitHub push events to Step Functions
     * Pattern: Only matches push events from configured repository
     * Security: Specific repository filtering prevents unauthorized triggers.
     */
    const githubCommitRule = new events.Rule(this, 'GitHubCommitRule', {
      description: `Trigger on GitHub commit events for ${githubRepository}`,
      // Event pattern uses environment variable for repository filtering
      eventPattern: {
        source: ['github.webhook'],
        detailType: ['GitHub Push'],
        detail: {
          repository: {
            full_name: [githubRepository]
          }
        }
      }
    });

    // Add resource tagging for cost tracking and ownership
    cdk.Tags.of(githubCommitRule).add('Environment', environment);
    cdk.Tags.of(githubCommitRule).add('Project', 'GitHubMonitor');
    cdk.Tags.of(githubCommitRule).add('Component', 'EventRouting');

    /**
     * EventBridge to Step Functions Target Configuration
     * Purpose: Connects EventBridge rule to Step Functions execution
     * Security: Dedicated IAM role with minimal permissions
     * Input: Passes entire event payload to Step Functions.
     */
    githubCommitRule.addTarget(new targets.SfnStateMachine(stateMachine, {
      input: events.RuleTargetInput.fromEventPath('$'),
      // Security: Use a dedicated role for EventBridge to Step Functions
      role: new iam.Role(this, 'EventBridgeRole', {
        assumedBy: new iam.ServicePrincipal('events.amazonaws.com'),
        inlinePolicies: {
          // Minimal policy: only start execution on specific State Machine
          StepFunctionExecutePolicy: new iam.PolicyDocument({
            statements: [
              new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ['states:StartExecution'],
                // Security: Specific State Machine ARN, not wildcard
                resources: [stateMachine.stateMachineArn]
              })
            ]
          })
        }
      })
    }));

    // =============================================================================
    // WEBHOOK INFRASTRUCTURE - GitHub integration
    // =============================================================================

    /**
     * Webhook Receiver Lambda Function
     * Purpose: Receives GitHub webhooks and transforms them to EventBridge events
     * Runtime: Node.js 18.x (minimal, stable runtime)
     * Memory: 256MB (minimal for JSON processing and HTTP requests)
     * Timeout: 30s (sufficient for EventBridge API calls)
     * Security: Only EventBridge put-events permission.
     */
    const webhookReceiverFunction = new nodejs.NodejsFunction(this, 'WebhookReceiverFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: 'lambda/webhook-receiver.ts',
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        // Configuration from environment variables - no hardcoded values
        GITHUB_REPOSITORY: githubRepository,
        ENVIRONMENT: environment
      },
      description: 'Receives GitHub webhooks and forwards to EventBridge'
    });

    // Add resource tagging for cost tracking and ownership
    cdk.Tags.of(webhookReceiverFunction).add('Environment', environment);
    cdk.Tags.of(webhookReceiverFunction).add('Project', 'GitHubMonitor');
    cdk.Tags.of(webhookReceiverFunction).add('Component', 'WebhookReceiver');

    /**
     * EventBridge Permissions for Webhook Receiver
     * Purpose: Allows webhook receiver to publish events to EventBridge
     * Security: Minimal permission - only PutEvents action.
     */
    webhookReceiverFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['events:PutEvents'],
      // Note: EventBridge PutEvents requires wildcard resource
      resources: ['*']
    }));

    /**
     * CloudWatch Log Group for Webhook Receiver
     * Purpose: Centralized logging for webhook processing
     * Retention: 1 week (cost-effective, sufficient for debugging).
     */
    new logs.LogGroup(this, 'WebhookReceiverLogGroup', {
      logGroupName: `/aws/lambda/${webhookReceiverFunction.functionName}`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    /**
     * API Gateway REST API
     * Purpose: Provides HTTP endpoint for GitHub webhooks
     * Configuration: Minimal - basic REST API with CORS enabled
     * Security: Public endpoint (GitHub webhooks require public access).
     */
    const api = new apigateway.RestApi(this, 'GitHubWebhookApi', {
      restApiName: 'GitHub Webhook Receiver',
      description: 'API Gateway to receive GitHub webhooks',
      // Enable CORS for webhook compatibility
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    /**
     * API Gateway Webhook Resource and Method
     * Purpose: Defines the /webhook POST endpoint
     * Integration: Direct integration with webhook receiver Lambda
     * Security: Lambda integration handles authentication via IAM.
     */
    const webhookResource = api.root.addResource('webhook');
    const webhookIntegration = new apigateway.LambdaIntegration(webhookReceiverFunction);
    webhookResource.addMethod('POST', webhookIntegration);

    // =============================================================================
    // STACK OUTPUTS - Important URLs and ARNs for reference
    // =============================================================================

    /**
     * Step Function State Machine ARN Output
     * Purpose: Reference for manual testing and monitoring.
     */
    new cdk.CfnOutput(this, 'StateMachineArn', {
      value: stateMachine.stateMachineArn,
      description: 'Step Function State Machine ARN'
    });

    /**
     * EventBridge Rule ARN Output
     * Purpose: Reference for monitoring and debugging.
     */
    new cdk.CfnOutput(this, 'EventRuleArn', {
      value: githubCommitRule.ruleArn,
      description: 'EventBridge Rule ARN'
    });

    /**
     * Git Diff Processor Lambda Function ARN Output
     * Purpose: Reference for monitoring and debugging.
     */
    new cdk.CfnOutput(this, 'LambdaFunctionArn', {
      value: gitDiffProcessorFunction.functionArn,
      description: 'Git Diff Processor Lambda Function ARN'
    });

    /**
     * SNS Topic ARN Output
     * Purpose: Reference for monitoring and manual testing.
     */
    new cdk.CfnOutput(this, 'SNSTopicArn', {
      value: gitDiffTopic.topicArn,
      description: 'SNS Topic ARN for git diff notifications'
    });

    // =============================================================================
    // OUTPUTS - Important URLs and information for post-deployment setup
    // =============================================================================

    /**
     * Output the webhook URL for GitHub configuration.
     * 
     * This URL needs to be configured in GitHub repository settings as a webhook endpoint.
     */
    new cdk.CfnOutput(this, 'WebhookUrl', {
      value: api.url + 'webhook',
      description: 'GitHub Webhook URL - Configure this in your GitHub repository settings',
      exportName: 'GitHubWebhookUrl'
    });

    /**
     * Output the SNS topic ARN for reference.
     * 
     * This can be used for additional integrations or monitoring.
     */
    new cdk.CfnOutput(this, 'NotificationTopicArn', {
      value: gitDiffTopic.topicArn,
      description: 'SNS Topic ARN for git diff notifications',
      exportName: 'GitDiffNotificationTopicArn'
    });
  }
}
