# Repository Monitor

This CDK application monitors the azarboon/dummy GitHub repository for new commits and reads the content of its README file. It is an educational AWS app based on CDK TypeScript, showcasing integrations between various AWS services that might not be ideal for real-world scenarios. This project was created using the Amazon Q CLI.

## TODO:

Use the new prompt to see if things are still working. Then commit.
Configure Step Functions Lambda to invoke an SNS and notify me of commit differences.

## Prompt

Always use the bare minimum configurations to avoid bloating the code.
Strive to follow best practices (only from the official AWS documentation) when configuring services.
Always follow security best practices and grant least privileged access.
Use minimal IAM permissions in CDK roles and policies.
Comment all code blocks and each file, explaining their purpose.
Every time the Webhook URL changes (and only after it changes), provide the updated version so I can update the GitHub webhook configuration.
Make sure only the necessary files and folders are committed to Git; gitignore the rest.
Make sure no credentials, secrets, or environment variables containing secrets are committed to Git.
Don't change these three sections in the README: the first section, TODO, and Prompt.
Always use stable versions of packages, preferably the latest stable version. Never use beta or unstable versions.
Always use packages from official accounts or verified sources.
Follow consistent naming conventions and code formatting.
Include clear setup instructions if new dependencies or configurations are added.
Validate and lint the code before finalizing changes. Always include ESLint with TypeScript rules and ensure all code passes linting before committing.
Ensure all resources created have appropriate tagging for cost tracking and ownership. Use environment variables; you can use env=dev as the default tag and its associated value.
Do not hard-code any secrets; instead, use AWS Parameter Store.
Deploy everything in the us-east-1 region. AWS account user name is "cloud_user"
Always use CDK to modify infrastructure. Avoid making manual changes in the AWS console to resources managed by CDK, as this can cause drift and deployment failures.
Always run cdk synth to check for errors and review the generated CloudFormation templates. This helps ensure code quality and prevents deploying unintended changes.

AWS account:
Account id: *****



## 🏗️ Architecture Overview

```
GitHub Webhook → API Gateway → Lambda (Webhook Receiver) → EventBridge → Step Functions → Lambda (README Reader) → GitHub API
```

## 📊 Detailed Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           GitHub Repository Monitor                              │
│                          Amazon Q Integration App                               │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐     HTTPS POST      ┌──────────────────┐     Invoke
│   GitHub Repo   │────────────────────▶│   API Gateway    │─────────────┐
│  azarboon/dummy │     Webhook         │     (REST)       │             │
│                 │                     │  /prod/webhook   │             │
└─────────────────┘                     └──────────────────┘             │
                                                                         ▼
┌─────────────────┐                                           ┌─────────────────┐
│  GitHub API     │                                           │ Webhook Receiver│
│   (REST API)    │                                           │    Lambda       │
│                 │                                           │                 │
│ GET /repos/     │                                           │ • Validate Event│
│ {owner}/{repo}/ │                                           │ • Filter Repo   │
│ contents/README │                                           │ • Transform Data│
└─────────────────┘                                           └─────────────────┘
         ▲                                                             │
         │                                                             │
         │ HTTP GET                                                    │ Put Event
         │                                                             ▼
┌─────────────────┐     Invoke          ┌──────────────────┐    ┌─────────────────┐
│ README Reader   │◀────────────────────│ Step Functions  │◀───│   EventBridge   │
│    Lambda       │                     │ State Machine   │    │   Custom Bus    │
│                 │                     │                 │    │                 │
│ • Fetch README  │                     │ • Orchestrate   │    │ • Route Events  │
│ • Process Data  │                     │ • Error Handle  │    │ • Filter Rules  │
│ • Log Results   │                     │ • Retry Logic   │    │ • Event Pattern │
└─────────────────┘                     └──────────────────┘    └─────────────────┘
         │                                       │                       │
         │                                       │                       │
         ▼                                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            CloudWatch Logs                                      │
│                                                                                 │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────────────────────┐ │
│  │ Webhook Receiver│  │ Step Functions   │  │ README Reader Lambda            │ │
│  │ Lambda Logs     │  │ Execution Logs   │  │ Logs                            │ │
│  │                 │  │                  │  │                                 │ │
│  │ • Event Details │  │ • State Changes  │  │ • API Responses                 │ │
│  │ • Filtering     │  │ • Error Handling │  │ • Content Preview               │ │
│  │ • Transforming  │  │ • Retry Attempts │  │ • Processing Results            │ │
│  └─────────────────┘  └──────────────────┘  └─────────────────────────────────┘ │
│                                                                                 │
│                        Retention: 1 Week                                       │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Data Flow                                          │
└─────────────────────────────────────────────────────────────────────────────────┘

1. 📤 GitHub Push Event → Webhook POST to API Gateway
2. 🔍 API Gateway → Webhook Receiver Lambda (validate & filter)
3. 📨 Webhook Lambda → EventBridge (custom event)
4. 🎯 EventBridge → Step Functions (event routing)
5. 🚀 Step Functions → README Reader Lambda (orchestrated execution)
6. 📖 README Lambda → GitHub API (fetch README content)
7. 📊 All Components → CloudWatch Logs (centralized logging)

┌─────────────────────────────────────────────────────────────────────────────────┐
│                            Security & Filtering                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

🔒 Repository Filter: Only processes "azarboon/dummy"
🔒 Event Filter: Only processes "push" events (ignores ping, issues, etc.)
🔒 IAM Roles: Least privilege access for each component
🔒 No Credentials: Uses IAM roles, no hardcoded secrets
🔒 Secure Logging: No sensitive data in logs
```

### Components

- **API Gateway**: Receives GitHub webhook POST requests
- **Webhook Receiver Lambda**: Transforms GitHub events to EventBridge events
- **EventBridge**: Routes filtered push events to Step Functions
- **Step Functions**: Orchestrates the README reading workflow
- **README Reader Lambda**: Fetches README content from GitHub API
- **CloudWatch Logs**: Centralized logging with 1-week retention

## 🔒 Security Features

- **Least Privilege IAM**: All roles have minimal required permissions
- **Repository Filtering**: Only processes events from `azarboon/dummy`
- **Event Type Filtering**: Only processes push events (ignores ping, issues, etc.)
- **No Hardcoded Credentials**: Uses IAM roles and environment variables
- **Secure Logging**: No sensitive data or full content in logs
- **Request Timeouts**: Prevents hanging requests and runaway costs
- **Resource Scoping**: IAM policies target specific resources where possible

## 💰 Cost Optimization

- **Minimal Configuration**: 256MB memory, 30s timeouts
- **Pay-per-Use Services**: EventBridge, Step Functions, API Gateway
- **Log Retention**: 1-week retention to control storage costs
- **Early Returns**: Webhook receiver exits early for ignored events
- **Efficient Processing**: No unnecessary data processing or storage

## 📋 Prerequisites

1. **Node.js 18+** and npm
2. **AWS CLI** configured with your credentials
3. **AWS CDK CLI** installed (`npm install -g aws-cdk`)
4. **GitHub Repository Access** to `azarboon/dummy` for webhook configuration

## 🚀 Deployment

### 1. Install Dependencies
```bash
npm install
```

### 2. Bootstrap CDK (first time only)
```bash
cdk bootstrap aws://381492315817/us-east-1
```

### 3. Build and Deploy
```bash
npm run build
cdk deploy
```

### 4. Note the Webhook URL
After deployment, copy the `WebhookUrl` from the output:
```
GitHubMonitorStack.WebhookUrl = https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod/webhook
```

## 🔗 GitHub Webhook Configuration

### 1. Navigate to Repository Settings
Go to: `https://github.com/azarboon/dummy/settings/hooks`

### 2. Add Webhook
- **Payload URL**: Use the `WebhookUrl` from deployment output
- **Content type**: `application/json`
- **Secret**: Leave empty (optional for additional security)
- **Events**: Select "Just the push event"
- **Active**: ✅ Enabled

### 3. Test the Webhook
Make a commit to the repository and verify webhook delivery in GitHub settings.

## 📊 Monitoring

### CloudWatch Log Groups
- **Webhook Receiver**: `/aws/lambda/GitHubMonitorStack-WebhookReceiverFunction*`
- **README Reader**: `/aws/lambda/GitHubMonitorStack-ReadmeReaderFunction*`
- **Step Functions**: `/aws/stepfunctions/GitHubMonitorStateMachine`

### What You'll See in Logs
- ✅ **Webhook Processing**: Repository info, commit count, event filtering
- ✅ **README Fetching**: Content preview (first 100 chars), content length
- ❌ **NOT Logged**: Full commit diffs, complete README content (security)

## 🧪 Manual Testing

### Test Step Function Directly
1. Go to **AWS Step Functions Console**
2. Find `GitHubMonitorStateMachine`
3. **Start Execution** with sample input:
```json
{
  "repository": {
    "full_name": "azarboon/dummy"
  },
  "commits": [
    {
      "id": "test-commit-id",
      "message": "Test commit"
    }
  ]
}
```

### Test Webhook Endpoint
```bash
curl -X POST https://your-webhook-url/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -d '{"repository":{"full_name":"azarboon/dummy"},"commits":[{"id":"test"}]}'
```

## 🗂️ Project Structure

```
├── bin/
│   └── app.ts              # CDK app entry point
├── lib/
│   └── github-monitor-stack.ts  # Main CDK stack definition
├── lambda/
│   ├── index.js            # README reader Lambda function
│   └── webhook-receiver.js # GitHub webhook receiver Lambda
├── cdk.json               # CDK configuration
├── package.json           # Dependencies and scripts
└── README.md             # This file
```

## 🔧 Development Guidelines

### Code Quality
- **Minimal Configuration**: Avoid unnecessary complexity
- **Comprehensive Comments**: Every component and function documented
- **Security First**: Least privilege access, no credential exposure
- **Cost Conscious**: Efficient resource usage and retention policies

### Deployment Process
- Always run `npm run build` before deployment
- Use `cdk deploy --require-approval never` for automated deployments
- Update GitHub webhook URL after each deployment if changed
- Monitor CloudWatch logs for successful operation

## 🧹 Cleanup

To remove all resources and avoid ongoing costs:
```bash
cdk destroy
```

This will delete:
- All Lambda functions
- API Gateway
- Step Functions
- EventBridge rules
- CloudWatch log groups
- IAM roles and policies

## 🚨 Important Notes

- **No Credentials in Git**: This project contains no hardcoded credentials
- **Account Specific**: Hardcoded to account `381492315817` for security
- **Repository Specific**: Only monitors `azarboon/dummy` repository
- **Region Locked**: Deployed to `us-east-1` for optimal GitHub webhook performance
- **Cost Effective**: Designed for minimal AWS costs with appropriate limits

## 📞 Support

For issues or questions:
1. Check CloudWatch logs for error details
2. Verify GitHub webhook delivery status
3. Test Step Functions manually for debugging
4. Review IAM permissions if access issues occur

---

**Created with Amazon Q CLI** - Following AWS best practices for security, cost optimization, and minimal configuration