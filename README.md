<!-- ========================================= -->
<!-- PROTECTED SECTION - DO NOT MODIFY        -->
<!-- AI ASSISTANTS: DO NOT EDIT ANYTHING BETWEEN THESE MARKERS UNTIL AFTER IT EXPLICITLY SAYS "END PROTECTED SECTION"  -->
<!-- ========================================= -->

<!-- NOTE to self: start WSL terminal, update aws account id and email in .env.template, then aws configure, then run q command line -->

# Boilerplate for AWS CDK TypeScript Best Practices and Effective Amazon Q Development

This AWS CDK application monitors any GitHub repository (in this example, `azarboon/dummy`) for new commits and reads the content of its README file. It is an educational AWS app built with AWS CDK in TypeScript, designed to demonstrate best practices such as automated code quality checks, automated security checks, automated documentation updates.

The app is developed using Amazon Q CLI. While Amazon Q CLI can be very powerful, it can also behave unpredictably. This project focuses on harnessing its capabilities effectively. To achieve this, special attention is given to the development context—specifically, the rules that the AI assistant must follow, which are detailed in PROJECT_RULES.md. These rules are designed to guide Amazon Q CLI usage but can also be applied with other AI assistants or in other projects. The goal is to create a simple boilerplate that makes working with Amazon Q CLI easier while enforcing code best practices. 

Once this project is finalized, I plan to use it as a foundation for other projects—particularly those focused on scrutinizing error handling and troubleshooting across multiple AWS services. As a result, this app intentionally includes various integrations between AWS services that may not represent ideal real-world architecture but serve to demonstrate and test more complex scenarios.

## Warning

Given the unpredictable behavior of Amazon Q CLI, there have been instances where unintended changes were committed. I address and correct these issues as they arise.

## TODO

<!-- AI Assistant: The TODO section is a note to self. Completely ignore it. NEVER read it, NEVER change it, and NEVER act upon it. NEVER. -->

text 2

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

ALL TypeScript files MUST pass ESLint validation before every commit, with zero warning tolerance. This strict check does not run during deployment—I chose this for faster troubleshooting and development. See `.eslintrc.json` for details.

ESLint ensures code and comment quality on all TS files in the project using a simplified, fast configuration with caching enabled for optimal performance. 

The pre-commit hook uses Husky. Below you can find more about its configuration and pre-commit flow.


### **🔧 Husky Pre-Commit Configuration**

**Setup**: Husky v8.0.3 auto-configures via `"prepare": "husky install"` in package.json during `npm install`. Sets Git's `core.hooksPath` to `.husky/` directory.

**Pre-commit Flow**:

1. `git commit` → `.husky/pre-commit` script
2. Runs `npm run lint:fix` directly on all project files 
3. ESLint validates all TS files with caching (`--max-warnings 0 --cache`)
5. Blocks commit if linting fails 

File-based hooks in `.husky/` instead of package.json config. Direct ESLint execution with comprehensive project-wide validation and caching for optimal performance.


<!-- ========================================= -->
<!-- END PROTECTED SECTION                    -->
<!-- ========================================= -->

---

### **🔧 ESLint Commands**

```bash
# Check all files for linting issues (with caching)
npm run lint

# Auto-fix issues where possible (with caching)
npm run lint:fix

# Complete validation pipeline (build + synth, no linting)
npm run validate
```


### **🚀 Developer Workflow**

1. **Write code** following TypeScript best practices
2. **Run `npm run lint:fix`** to auto-fix issues
3. **Fix any remaining issues manually**
4. **Commit** - pre-commit hook validates linting



### **⚡ Quick Setup (Recommended)**

For the fastest setup experience, use the automated setup script:

```bash
# Clone the repository
git clone <repository-url>
cd q-sample

# Run automated setup (works on all platforms)
./setup.sh
```

@QCLI: make sure the script verify nodeinstallation, too. Also update README to include this.
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

- **Node.js 22+** and npm
- **Docker v27.5** (for CDK Lambda bundling)
- **AWS CLI v2.27** configured with your credentials
- **AWS CDK CLI v2.1** installed (`npm install -g aws-cdk`)
- **GitHub Repository Access** for webhook configuration

### Environment Setup

Setup AWS configure

Configure environment variables in .env:

   ```bash
   # Edit the .env file with your actual values
   nano .env  # or use your preferred editor
   ```


### Automated Deployment

1. **Install dependencies:**

   ```bash
   npm install
   ```

@mahdi: try to deploy manually to check if deploy.sh is needed. if not, remove it
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

Confirm Email Subscription

Check your email for SNS subscription confirmation and click the confirmation link.



Add Webhook
Go to: `https://github.com/[your-repo]/settings/hooks`

- **Payload URL**: Use the `WebhookUrl` from deployment output
- **Content type**: `application/json`
- **Secret**: Leave empty (optional for additional security)
- **Events**: Select "Just the push event"
- **Active**: ✅ Enabled

Update GitHub webhook URL if API Gateway endpoint changes 

Test the Webhook


Make a commit to the repository and verify webhook delivery in GitHub settings.


## 🧹 Cleanup

To remove all resources and avoid ongoing costs:

```bash
cdk destroy
```

### Development Workflow

- **Before changes:** `npm run validate` (runs build + synth, no linting)
- **Code quality:** `npm run lint:fix` (enforced at commit time)
- **Build only:** `npm run build`
- **Deploy with validation:** `npm run deploy` (build + deploy, no linting)


All configuration is managed through environment variables (no hardcoded values):

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

@mahdi: check if these are actually implemented
- **Least Privilege IAM**: All roles have minimal required permissions
- **Event Type Filtering**: Only processes push events (ignores ping, issues, etc.)
- **No Hardcoded Credentials**: Uses IAM roles and environment variables
- **Environment Variable Configuration**: All sensitive values externalized
- **Secure Logging**: No sensitive data or credentials in logs
- **Request Timeouts**: Prevents hanging requests and runaway costs
- **Resource Scoping**: IAM policies target specific resources where possible

## 💰 Cost Optimization

- **Log Retention**: 1-week retention to control storage costs
- **Early Returns**: Webhook receiver exits early for ignored events
- **Resource Tagging**: All resources tagged for cost tracking

@mahdi: verify this
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
