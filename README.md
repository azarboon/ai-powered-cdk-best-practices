<!-- ========================================= -->
<!-- PROTECTED SECTION - DO NOT MODIFY        -->
<!-- AI ASSISTANTS: DO NOT EDIT ANYTHING BETWEEN THESE MARKERS UNTIL AFTER IT EXPLICITLY SAYS "END PROTECTED SECTION"  -->
<!-- ========================================= -->

<!-- NOTE to self: start WSL terminal, update aws account id and email in .env.template, then aws configure, then run q command line -->

# AWS CDK GitHub Monitor with AI-Assisted Best Practices in Mind

This AWS CDK application monitors any GitHub repository (in this example, `azarboon/dummy`) for new commits and reads the content of its README file. It is an educational AWS app built with AWS CDK in TypeScript, designed to demonstrate best practices such as automated quality checks, automated security checks, automated documentation updates, and more.

The app is developed using Amazon Q CLI. While Amazon Q CLI can be very powerful, it can also behave unpredictably. This project focuses on harnessing its capabilities effectively. To achieve this, special attention is given to the development context—specifically, the rules that the AI assistant must follow, which are detailed in PROJECT_RULES.md. These rules are designed to guide Amazon Q CLI usage but can also be applied with other AI assistants or in other projects. The goal is to create a simple boilerplate that makes working with Amazon Q CLI easier while enforcing code best practices.

Once this project is finalized, I plan to use it as a foundation for other projects—particularly those focused on scrutinizing error handling and troubleshooting across multiple AWS services. As a result, this app intentionally includes various integrations between AWS services that may not represent ideal real-world architecture but serve to demonstrate and test more complex scenarios.

## TODO

test

<!-- AI Assistant: The TODO section is a note to self. Completely ignore it. NEVER read it, NEVER change it, and NEVER act upon it. NEVER. -->

Dummy text
add and efnorce these rules in project rule:

When everything worked, run the project yourself, inspect the code and ask other genai tools to test the quality of the code and find bloatness, inefficeny, insecure code.

Add these project rules:

- Always follow best practices for developing and deploying CDK applications only from the official AWS CDK v2 Developer Guide located at https://docs.aws.amazon.com/cdk/v2/guide/best-practices.html. Dont use other websites as they can pose security risk. This project is currenyl owned by one team and one organization and suffice to remain in one repository. Some of the bestp ractices are as following.

- Always run CDK nag rule against AWS Solutions Library before deploying (?)

- Always follow CDK constructs best practices best from AWS CDK v2 Developer Guide located at https://docs.aws.amazon.com/cdk/v2/guide/best-practices.html. This project is currenyl owned by one team and one organization and suffice to remain in one repository. Among them:
  Model with constructs, deploy with stacks. Using constructs for building and stacks for deploying

Configure with properties and methods, not environment variables. Environment variable lookups inside constructs and stacks are a common anti-pattern. Both constructs and stacks should accept a properties object to allow for full configurability completely in code. Doing otherwise introduces a dependency on the machine that the code will run on, which creates yet more configuration information that you have to track and manage. Limit environment variable lookups should be limited to the top level of an AWS CDK app.

Don’t change the logical ID of stateful resources

continue from application best practices

https://docs.aws.amazon.com/cdk/v2/guide/best-practices.html

## Project rules

You can update the project rules by editing the `./PROJECT_RULES.md` file.

## Setup

For development, I use VS Code installed on Microsoft Windows 10. I mainly use the integrated **WSL terminal in VS Code**.

## 🐧 Terminal

Here are my settings to replicate my environment.

**WSL Info**:

- Distro: Ubuntu on WSL 2
- Default shell: Bash (`/bin/bash`)

**.bashrc Key Settings**:

```bash
export NPM_CONFIG_PREFIX="$HOME/.npm-global"
export PATH="$HOME/.npm-global/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
export PATH=$(echo $PATH | tr ':' '\n' | grep -v "/mnt/c/Users/YOUR_USERNAME/AppData/Roaming/npm" | tr '\n' ':' | sed 's/:$//')
export GIT_ASKPASS="/mnt/c/Windows/System32/cmd.exe"
export GIT_CREDENTIAL_HELPER="wincred"

alias ll='ls -alF'
alias aws-version='aws --version'
alias cdk-version='cdk --version'
```

## ESLint Code Quality checks

ALL JavaScript and TypeScript files MUST pass ESLint validation before every commit, with zero warning tolerance. This strict check does not run during deployment—I chose this for faster troubleshooting and development. See `.eslintrc.json` for details.

ESLint ensures code and comment quality on all changed JS and TS files using `lint-staged`. You can find all relevant details in the ESLINT\_\*.md files located in the project root.

The pre-commit hook uses Husky. Below you can find more about its configuration and pre-commit flow.

### Eslint requirements

- **Function Documentation**: All functions must have JSDoc comments
- **Parameter Documentation**: All parameters must be documented
- **Return Documentation**: All return values must be documented
- **Complete Sentences**: Comments must end with periods
- **TypeScript Best Practices**: Proper types, nullish coalescing, etc.
- **Consistent Formatting**: Indentation, quotes, semicolons

## Setup

For development, I use VS Code installed on Microsoft Windows 10. I mainly use the integrated **WSL terminal in VS Code**.

## 🐧 Terminal

Here are my settings to replicate my environment.

**WSL Info**:

- Distro: Ubuntu on WSL 2
- Default shell: Bash (`/bin/bash`)

**.bashrc Key Settings**:

```bash
export NPM_CONFIG_PREFIX="$HOME/.npm-global"
export PATH="$HOME/.npm-global/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
export PATH=$(echo $PATH | tr ':' '\n' | grep -v "/mnt/c/Users/YOUR_USERNAME/AppData/Roaming/npm" | tr '\n' ':' | sed 's/:$//')
export GIT_ASKPASS="/mnt/c/Windows/System32/cmd.exe"
export GIT_CREDENTIAL_HELPER="wincred"

alias ll='ls -alF'
alias aws-version='aws --version'
alias cdk-version='cdk --version'
```

<!-- ========================================= -->
<!-- END PROTECTED SECTION                    -->
<!-- ========================================= -->

---

### **🔧 ESLint Commands**

```bash
# Check all files for linting issues
npm run lint

# Auto-fix issues where possible
npm run lint:fix

# Complete validation pipeline (build + synth, no linting)
npm run validate
```

### **🔧 Husky Pre-Commit Configuration**

**Setup**: Husky v8.0.3 auto-configures via `"prepare": "husky install"` in package.json during `npm install`. Sets Git's `core.hooksPath` to `.husky/` directory.

**Pre-commit Flow**:

1. `git commit` → `.husky/pre-commit` script
2. Detects environment (WSL/Git Bash/Linux)
3. Runs `npx lint-staged` on staged files only
4. ESLint validates JS/TS (`--fix --max-warnings 0`)
5. Prettier formats JSON/MD
6. Blocks commit if validation fails

**Modern Approach**: File-based hooks in `.husky/` instead of package.json config. No traditional `.git/hooks/` - everything redirected through Husky's path override.### **❌ What Happens if ESLint Fails**

- **Commits are BLOCKED** - cannot commit with linting errors
- **Deployments proceed** - ESLint not enforced during deployment
- **Pre-commit hooks fail** - must fix issues before committing

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

---

**Troubleshooting:**

```bash
# Test the pre-commit hook
./.husky/pre-commit

# Verify npm is available
which npm && npm --version

# If issues persist, reinstall Node.js using guide above
```

### **⚡ Quick Setup (Recommended)**

For the fastest setup experience, use the automated setup script:

```bash
# Clone the repository
git clone <repository-url>
cd q-sample

# Run automated setup (works on all platforms)
./setup.sh
```

The setup script will:

- ✅ **Detect your environment** automatically
- ✅ **Verify Node.js and npm** installation
- ✅ **Install all dependencies**
- ✅ **Configure pre-commit hooks**
- ✅ **Test the setup** to ensure everything works
- ✅ **Provide next steps** for configuration and deployment

**Manual Setup Alternative:**

```bash
npm install          # Install dependencies
npm run prepare      # Setup pre-commit hooks
./.husky/pre-commit  # Test hook (optional)
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

| Variable              | Description              | Default                  | Required |
| --------------------- | ------------------------ | ------------------------ | -------- |
| `CDK_DEFAULT_ACCOUNT` | AWS Account ID           | -                        | ✅       |
| `CDK_DEFAULT_REGION`  | AWS Region               | `us-east-1`              | ✅       |
| `GITHUB_REPOSITORY`   | Target repo (owner/repo) | `azarboon/dummy`         | ✅       |
| `NOTIFICATION_EMAIL`  | Email for notifications  | -                        | ✅       |
| `GITHUB_API_BASE`     | GitHub API base URL      | `https://api.github.com` | ❌       |
| `ENVIRONMENT`         | Environment tag          | `dev`                    | ❌       |

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
- **Log Retention**: 1-week retention to control storage costs
- **Early Returns**: Webhook receiver exits early for ignored events
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
- **Environment Variables**: No hardcoded values allowed <!-- verify this -->
- **Comprehensive Comments**: Every component and function documented
- **Security First**: Least privilege access, no credential exposure

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
