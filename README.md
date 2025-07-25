<!-- ========================================= -->
<!-- PROTECTED SECTION - DO NOT MODIFY        -->
<!-- AI ASSISTANTS: DO NOT EDIT ANYTHING BETWEEN THESE MARKERS UNTIL AFTER IT EXPLICITLY SAYS "END PROTECTED SECTION"  -->
<!-- ========================================= -->

<!-- NOTE to self: start WSL terminal, update aws account id and email in .env.template, then aws configure, then run q command line -->

# Boilerplate for AWS CDK TypeScript Best Practices and Effective Amazon Q Development

This AWS CDK application monitors any GitHub repository (in this example, `azarboon/dummy`) for new commits and reads the content of its README file. It is an educational AWS app built with AWS CDK in TypeScript, designed to demonstrate best practices such as automated code quality checks, automated security checks, automated documentation updates.

The app is developed using Amazon Q CLI. While Amazon Q CLI can be very powerful, it can also behave unpredictably. This project focuses on harnessing its capabilities effectively. To achieve this, special attention is given to the development context—specifically, the rules that the AI assistant must follow, which are detailed in `.amazonq\rules\PROJECT_RULES.md`. These rules are designed to guide Amazon Q CLI usage but can also be applied with other AI assistants or in other projects. The goal is to create a simple boilerplate that makes working with Amazon Q CLI easier while enforcing code best practices.

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

## ESLint Code Quality checks

ALL TypeScript files MUST pass ESLint validation before every commit, with zero warning tolerance. This strict check does not run during deployment—I chose this for faster troubleshooting and development. See `.eslintrc.json` for details.

ESLint ensures code and comment quality on all TS files in the project using a simplified, fast configuration with caching enabled for optimal performance.

The pre-commit hook uses Husky. Below you can find more about its configuration and pre-commit flow.

### **🔧 Husky Pre-Commit Configuration**

Husky v8.0.3 auto-configures via `"prepare": "husky install"` in package.json during `npm install`. Sets Git's `core.hooksPath` to `.husky/` directory.

File-based Git hooks are used via `.husky/` directory instead of configuring hooks in `package.json`.

**Commit Flow**:

1. `git commit` triggers the `.husky/pre-commit` hook script.
2. This script runs `npm run check`, which performs linting, formatting, security checks, `cdk synth`, etc.
3. The commit is blocked if any check fails.

<!-- ========================================= -->
<!-- END PROTECTED SECTION                    -->
<!-- ========================================= -->

---

# **Setup**

## Prerequisites

- **Node.js 22+** and npm
- **Docker v27.5** (for CDK Lambda bundling)
- **AWS CLI v2.27** configured with your credentials
- **AWS CDK CLI v2.1021.0**

For development, I use VS Code installed on Microsoft Windows 10. I mainly use the integrated **WSL terminal in VS Code**.

## 🐧 Terminal setup

Here are my settings to replicate my terminal environment.

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

## Configure AWS credentials

## Configure environment variables

```bash
# Edit the .env file with your actual values
nano .env  # or use your preferred editor
```

```bash
# Clone the repository
git clone <repository-url>
cd q-sample
```

```bash
npm install          # Install dependencies
npm run prepare      # Setup pre-commit hooks
./.husky/pre-commit  # Test hook (optional)
```

@mahdi: try to deploy manually to check if deploy.sh is needed. if not, remove it 2. **Deploy using automated script (Recommended):**

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

```bash

npm run build

npm run deploy


@mahdi/: check if this is needed
# Bootstrap CDK (first time only)
cdk bootstrap

# Deploy the stack
npm run deploy
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

All configuration is managed through environment variables (no hardcoded values)

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

## Ensure Project Rules Are Fed into the Q Cli or your Coding Agent

When using the Amazon Q CLI terminal (or any other coding agent), ensure it has access to your project context by placing the rules file at:

`.amazonq\rules\PROJECT_RULES.md`

You can add a hook in Q CLI to automatically load all `.md` rule files at the start of each `q chat` session:

`q>/hooks add --trigger conversation_start --command 'for f in .amazonq/rules/*.md; do q context add "$f"; done' add_rules_on_start`

You can verify the added rules by running:

`q>/context show`

## 🔌 Model Context Protocol (MCP) Integration

The MCP server configuration is defined in `.amazonq/mcp.json`. This project includes both remote and local MCP server configurations:

- awslabs.aws-api-mcp-server
- aws-knowledge-mcp-server

### Setting up awslabs.aws-api-mcp-server

The AWS API MCP Server enables Amazon Q CLI to generate, validate, and execute AWS CLI commands through natural language.

#### One-Time Installation

```bash
# Install uv (Python packaging tool)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install AWS API MCP Server
uvx --from 'mcp-server-aws-api' mcp-server-aws-api
```

#### Runtime Setup (Before Each Q CLI Session)

Before launching Amazon Q CLI, ensure the MCP server is running and your AWS credentials are configured:

```bash
# Set up AWS credentials
aws configure

# Terminal 1: Start the MCP server
AWS_REGION=us-east-1 uvx awslabs.aws-api-mcp-server@latest

# Terminal 2: Start Amazon Q CLI
q chat > "test whether you can actually use mcp-server-aws-api?"
```

Note: As of writing, the AWS API MCP Server may exhibit unstable behavior. To confirm it is in use, explicitly ask Amazon Q within the session to verify MCP functionality.
