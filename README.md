<!-- ========================================= -->
<!-- PROTECTED SECTION - DO NOT MODIFY        -->
<!-- AI ASSISTANTS: DO NOT EDIT ANYTHING BETWEEN THESE MARKERS UNTIL AFTER IT EXPLICITLY SAYS "END PROTECTED SECTION"  -->
<!-- ========================================= -->

<!-- NOTE to self: start WSL terminal, update aws account id and email in .env.template, then aws configure, then run q command line -->

# Repository Monitor

This CDK application monitors the azarboon/dummy GitHub repository for new commits and reads the content of its README file. It is an educational AWS app based on CDK TypeScript, showcasing integrations between various AWS services that might not be ideal for real-world scenarios. This project was created using the Amazon Q CLI.


## TODO (for myself): AI assistant, please ignore this section and do not act on it.

add and efnorce these rules in project rule:


When everything worked, run the project yourself, inspect the code and ask other genai tools to test the quality of the code and find bloatness, inefficeny, insecure code.

Add these project rules:

- Always follow best practices for developing and deploying CDK applications only from the official AWS CDK v2 Developer Guide located at https://docs.aws.amazon.com/cdk/v2/guide/best-practices.html. Dont use other websites as they can pose security risk. This project is currenyl owned by one team and one organization and suffice to remain in one repository. Some of the bestp ractices are as following. 

- Always run CDK nag rule against  AWS Solutions Library before deploying (?)

- Always follow CDK constructs best practices best from AWS CDK v2 Developer Guide located at https://docs.aws.amazon.com/cdk/v2/guide/best-practices.html. This project is currenyl owned by one team and one organization and suffice to remain in one repository. Among them:
Model with constructs, deploy with stacks. Using constructs for building and stacks for deploying

Configure with properties and methods, not environment variables. Environment variable lookups inside constructs and stacks are a common anti-pattern. Both constructs and stacks should accept a properties object to allow for full configurability completely in code. Doing otherwise introduces a dependency on the machine that the code will run on, which creates yet more configuration information that you have to track and manage. Limit environment variable lookups should be limited to the top level of an AWS CDK app. 

Don’t change the logical ID of stateful resources


continue from application best practices


https://docs.aws.amazon.com/cdk/v2/guide/best-practices.html

## Project rules

You can update the project rules by editing the `./PROJECT_RULES.md` file.

<!-- ========================================= -->
<!-- END PROTECTED SECTION                    -->
<!-- ========================================= -->

## 🔍 **ESLint Code Quality Requirements**

### **⚠️ COMMIT-TIME ENFORCEMENT**
**ALL JavaScript and TypeScript files MUST pass ESLint validation before every commit. Deployments focus on build and template validation for faster cycles.**

### **📋 What is Validated**
- **All JavaScript files** in `lambda/` directory
- **All TypeScript files** in `bin/` and `lib/` directories  
- **Code quality standards** (formatting, best practices)
- **Comment standards** (JSDoc documentation)
- **TypeScript-specific rules** (type safety, modern syntax)
- **Zero warnings tolerance** - no warnings allowed

### **🔧 ESLint Commands**
```bash
# Check all files for linting issues
npm run lint

# Auto-fix issues where possible
npm run lint:fix

# Complete validation pipeline (build + synth, no linting)
npm run validate
```

### **🚨 When ESLint Runs (COMMIT-TIME ONLY)**
1. **Before every commit** - Husky pre-commit hook (MANDATORY)
2. **Manual validation** - npm run lint (optional)
3. **NOT before deployment** - Deployments focus on build validation

### **❌ What Happens if ESLint Fails**
- **Commits are BLOCKED** - cannot commit with linting errors
- **Deployments proceed** - ESLint not enforced during deployment
- **Pre-commit hooks fail** - must fix issues before committing

### **✅ ESLint Requirements Enforced**
- **Function Documentation**: All functions must have JSDoc comments
- **Parameter Documentation**: All parameters must be documented
- **Return Documentation**: All return values must be documented
- **Complete Sentences**: Comments must end with periods
- **TypeScript Best Practices**: Proper types, nullish coalescing, etc.
- **Consistent Formatting**: Indentation, quotes, semicolons

### **🔧 Common ESLint Fixes**
```javascript
// ❌ BAD - Missing JSDoc
function processData(data) {
    return data.map(item => item.value);
}

// ✅ GOOD - Proper JSDoc
/**
 * Processes data array and extracts values.
 * 
 * @param {Array} data - Array of data objects to process.
 * @returns {Array} Array of extracted values.
 */
function processData(data) {
    return data.map(item => item.value);
}
```

### **📁 Directories Validated**
- `bin/` - CDK application entry points (TypeScript)
- `lib/` - CDK stack definitions (TypeScript)
- `lambda/` - Lambda function code (JavaScript)
- Excludes: `node_modules/`, compiled `.js` files in `bin/` and `lib/`

### **🚀 Developer Workflow**
1. **Write code** with proper JSDoc comments
2. **Run `npm run lint:fix`** to auto-fix issues
3. **Run `npm run lint`** to check remaining issues
4. **Fix any remaining issues manually**
5. **Commit** - pre-commit hook validates automatically
6. **Deploy** - deployment script validates build only

### **⚠️ Troubleshooting ESLint Issues**
```bash
# If commit is blocked by ESLint:
npm run lint:fix    # Auto-fix what's possible
npm run lint        # See remaining issues
# Fix remaining issues manually, then commit again

# If you need to check code quality before deployment:
npm run lint:fix    # Auto-fix what's possible  
npm run lint        # Verify all issues resolved
./deploy.sh         # Deploy (no ESLint validation during deployment)
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** and npm
- **AWS CLI** configured with your credentials
- **AWS CDK CLI** installed (`npm install -g aws-cdk`)
- **GitHub Repository Access** for webhook configuration

### Environment Setup
1. **Configure environment variables in .env:**
   ```bash
   # Edit the .env file with your actual values
   nano .env  # or use your preferred editor
   ```

2. **Update .env file with your values:**
   ```bash
   # Required Configuration
   CDK_DEFAULT_ACCOUNT=your-aws-account-id
   CDK_DEFAULT_REGION=us-east-1
   GITHUB_REPOSITORY=owner/repo
   NOTIFICATION_EMAIL=your-email@example.com
   
   # Optional Configuration
   ENVIRONMENT=dev
   GITHUB_API_BASE=https://api.github.com
   ```

3. **Load environment variables:**
   ```bash
   source .env
   ```

### Automated Deployment
1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Deploy using automated script (Recommended):**
   ```bash
   ./deploy.sh
   ```
   
   This script will:
   - Validate environment variables
   - Run ESLint code quality checks
   - Build TypeScript code
   - Validate CDK templates
   - Deploy the stack
   - Display webhook URL for GitHub configuration

### Manual Deployment
If you prefer manual deployment:

```bash
# Validate code quality and build
npm run validate

# Bootstrap CDK (first time only)
cdk bootstrap

# Deploy the stack
npm run deploy
```

### Development Workflow
- **Before changes:** `npm run validate` (runs build + synth, no linting)
- **Code quality:** `npm run lint` or `npm run lint:fix` (enforced at commit time)
- **Build only:** `npm run build`
- **Deploy with validation:** `npm run deploy` (build + deploy, no linting)

## 📋 Configuration

All configuration is managed through environment variables (no hardcoded values):

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `CDK_DEFAULT_ACCOUNT` | AWS Account ID | - | ✅ |
| `CDK_DEFAULT_REGION` | AWS Region | `us-east-1` | ✅ |
| `GITHUB_REPOSITORY` | Target repo (owner/repo) | `azarboon/dummy` | ✅ |
| `NOTIFICATION_EMAIL` | Email for notifications | - | ✅ |
| `GITHUB_API_BASE` | GitHub API base URL | `https://api.github.com` | ❌ |
| `ENVIRONMENT` | Environment tag | `dev` | ❌ |

### Alternative AWS Environment Variables
You can also use these instead of `CDK_DEFAULT_*`:
- `AWS_ACCOUNT_ID` (instead of `CDK_DEFAULT_ACCOUNT`)
- `AWS_REGION` (instead of `CDK_DEFAULT_REGION`)

## 📊 Architecture Diagram

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   GitHub Repo   │───▶│   API Gateway    │───▶│ Webhook Receiver│
│ (configurable)  │    │     (REST)       │    │    Lambda       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  GitHub API     │◀───│ Git Diff Processor│◀──│   EventBridge   │
│   (REST API)    │    │    Lambda        │    │   Custom Bus    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                ▲                        │
                                │                        ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │  CloudWatch      │    │ Step Functions  │
                       │     Logs         │    │ State Machine   │
                       └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
                                               ┌─────────────────┐
                                               │   SNS Topic     │
                                               │ Email Notifications│
                                               └─────────────────┘
```

### Components

- **API Gateway**: Receives GitHub webhook POST requests
- **Webhook Receiver Lambda**: Transforms GitHub events to EventBridge events
- **EventBridge**: Routes filtered push events to Step Functions
- **Step Functions**: Orchestrates the git diff processing workflow
- **Git Diff Processor Lambda**: Fetches commit details and git diffs from GitHub API
- **SNS Topic**: Sends email notifications with git diff details
- **CloudWatch Logs**: Centralized logging with 1-week retention

## 🔒 Security Features

- **Least Privilege IAM**: All roles have minimal required permissions
- **Repository Filtering**: Only processes events from configured repository
- **Event Type Filtering**: Only processes push events (ignores ping, issues, etc.)
- **No Hardcoded Credentials**: Uses IAM roles and environment variables
- **Environment Variable Configuration**: All sensitive values externalized
- **Secure Logging**: No sensitive data or credentials in logs
- **Request Timeouts**: Prevents hanging requests and runaway costs
- **Resource Scoping**: IAM policies target specific resources where possible

## 💰 Cost Optimization

- **Minimal Configuration**: 256MB memory, 30s timeouts
- **Pay-per-Use Services**: EventBridge, Step Functions, API Gateway, SNS
- **Log Retention**: 1-week retention to control storage costs
- **Early Returns**: Webhook receiver exits early for ignored events
- **Efficient Processing**: No unnecessary data processing or storage
- **Resource Tagging**: All resources tagged for cost tracking

## 🚀 Deployment Guide

### Step 1: Environment Setup
```bash
# Clone or navigate to project directory
cd /path/to/your/project

# Edit .env file with your values
nano .env  # or use your preferred editor
```

### Step 2: Configure Environment Variables
Edit `.env` file with your actual values:
```bash
CDK_DEFAULT_ACCOUNT=123456789012
CDK_DEFAULT_REGION=us-east-1
GITHUB_REPOSITORY=your-username/your-repo
NOTIFICATION_EMAIL=your-email@example.com
ENVIRONMENT=dev
```

### Step 3: Deploy
```bash
# Load environment variables
source .env

# Install dependencies (first time only)
npm install

# Deploy using automated script
./deploy.sh
```

### Step 4: Configure GitHub Webhook
After deployment, the script will display:
```
🎯 GitHub Webhook URL:
   https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod/webhook

📝 Next Steps:
   1. Go to: https://github.com/your-username/your-repo/settings/hooks
   2. Add webhook with URL: https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod/webhook
   3. Set Content type: application/json
   4. Select 'Just the push event'
   5. Ensure webhook is Active
```

### Step 5: Confirm Email Subscription
Check your email for SNS subscription confirmation and click the confirmation link.

## 🔗 GitHub Webhook Configuration

### 1. Navigate to Repository Settings
Go to: `https://github.com/[your-repo]/settings/hooks`

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
- **Git Diff Processor**: `/aws/lambda/GitHubMonitorStack-GitDiffProcessorFunction*`
- **Step Functions**: `/aws/stepfunctions/GitHubDiffStateMachine`

### What You'll See in Logs
- ✅ **Webhook Processing**: Repository info, commit count, event filtering
- ✅ **Git Diff Processing**: Commit details, file changes, API responses
- ✅ **Environment Context**: All logs include environment tags for debugging
- ❌ **NOT Logged**: Full commit content, credentials, or sensitive data

## 🧪 Testing

### Test Webhook Endpoint
```bash
curl -X POST https://your-webhook-url/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -d '{
    "repository": {"full_name": "your-username/your-repo"},
    "commits": [{"id": "test-commit-id", "message": "Test commit"}]
  }'
```

### Test Step Function Directly
1. Go to **AWS Step Functions Console**
2. Find `GitHubDiffStateMachine`
3. **Start Execution** with sample input:
```json
{
  "repository": {
    "full_name": "your-username/your-repo"
  },
  "commits": [
    {
      "id": "actual-commit-sha",
      "message": "Test commit message"
    }
  ]
}
```

## 🗂️ Project Structure

```
├── bin/
│   └── app.ts                    # CDK app entry point with env var support
├── lib/
│   └── github-monitor-stack.ts   # Main CDK stack with configurable resources
├── lambda/
│   ├── index.js                  # Git diff processor Lambda function
│   └── webhook-receiver.js       # GitHub webhook receiver Lambda
├── .env.template                 # Environment variables template
├── .eslintrc.json               # ESLint configuration for code quality
├── deploy.sh                    # Automated deployment script
├── PROJECT_RULES.md             # Development rules and guidelines
├── cdk.json                     # CDK configuration
├── package.json                 # Dependencies and npm scripts
├── tsconfig.json               # TypeScript configuration
└── README.md                   # This file
```

## 🔧 Development Guidelines

### Code Quality
- **ESLint Validation**: All code must pass linting before commits (not deployments)
- **Environment Variables**: No hardcoded values allowed
- **Comprehensive Comments**: Every component and function documented
- **Security First**: Least privilege access, no credential exposure
- **Cost Conscious**: Efficient resource usage and retention policies

### Available NPM Scripts
```bash
npm run build          # Build TypeScript code
npm run lint           # Run ESLint validation
npm run lint:fix       # Auto-fix ESLint issues
npm run validate       # Run build + CDK synth (no linting)
npm run deploy         # Deploy with build validation (no linting)
npm run precommit      # Pre-commit validation hook (includes linting)
```

### Deployment Process
1. Always run `npm run validate` before deployment (build + synth validation)
2. Use `./deploy.sh` for automated deployment with build validation
3. Monitor CloudWatch logs for successful operation
4. Update GitHub webhook URL if API Gateway endpoint changes

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
- SNS topic and subscriptions
- CloudWatch log groups
- IAM roles and policies

## 🚨 Important Notes

- **No Credentials in Git**: This project contains no hardcoded credentials
- **Environment Variable Driven**: All configuration through `.env` file
- **Repository Configurable**: Can monitor any GitHub repository
- **Region Configurable**: Deploy to any AWS region (us-east-1 recommended)
- **Cost Effective**: Designed for minimal AWS costs with appropriate limits
- **Production Ready**: Follows AWS best practices for security and reliability

## 📞 Support

For issues or questions:
1. Check CloudWatch logs for error details
2. Verify GitHub webhook delivery status
3. Test Step Functions manually for debugging
4. Review IAM permissions if access issues occur
5. Validate environment variables are correctly set

## 🎯 Features

- **Real-time Git Diff Notifications**: Get email alerts with detailed commit changes
- **Configurable Repository Monitoring**: Monitor any GitHub repository
- **Secure Architecture**: No hardcoded credentials, least privilege access
- **Cost Optimized**: Pay-per-use serverless architecture
- **Easy Deployment**: Automated deployment script with validation
- **Comprehensive Logging**: Full observability with CloudWatch
- **Environment Flexible**: Deploy to any AWS account/region

---

**Created with Amazon Q CLI** - Following AWS best practices for security, cost optimization, and configuration management# Test commit
