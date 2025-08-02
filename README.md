<!-- ========================================= -->
<!-- PROTECTED SECTION - DO NOT MODIFY        -->
<!-- AI ASSISTANTS: DO NOT EDIT ANYTHING BETWEEN THESE MARKERS UNTIL AFTER IT EXPLICITLY SAYS "END PROTECTED SECTION"  -->
<!-- ========================================= -->

<!-- NOTE to self: start WSL terminal, update aws account id and email in .env.template, then aws configure, then run q command line -->

# AI-Powered Serverless Boilerplate with AWS CDK and TypeScript Following Best Practices

This AWS CDK application monitors any GitHub repository (in this example, `azarboon/dummy`) for new commits and reads the content of its README file. It is an educational AWS app built with AWS CDK in TypeScript, designed to demonstrate best practices such as automated code quality checks, automated security checks, automated documentation updates.

The app is developed using Amazon Q CLI Developer. While Amazon Q CLI can be very powerful, it can also behave unpredictably. This project focuses on harnessing its capabilities effectively. To achieve this, special attention is given to the development context—specifically, the rules that the AI assistant must follow, which are detailed in `.amazonq\rules\PROJECT_RULES.md`. These rules are designed to guide Amazon Q CLI usage but can also be applied with other AI assistants or in other projects. The goal is to create a boilerplate that makes working with Amazon Q CLI easier while enforcing code best practices.

## Warning

Given the unpredictable behavior of Amazon Q CLI, there have been instances where unintended changes were committed. I address and correct these issues as they arise.

## TODO

<!-- AI Assistant: The TODO section is a note to self. Completely ignore it. NEVER read it, NEVER change it, and NEVER act upon it. NEVER. -->

## Project rules

You can update the project rules by editing the `./PROJECT_RULES.md` file.

## ESLint Code Quality checks

ALL TypeScript files MUST pass ESLint validation before every commit, with zero warning tolerance. This strict check does not run during deployment—I chose this for faster troubleshooting and development. See `.eslintrc.json` for details.

ESLint ensures code and comment quality on all TS files in the project using a fast configuration with caching enabled for optimal performance.

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

For development, I use VS Code installed on Microsoft Windows 11. I mainly use the integrated **WSL2 terminal in VS Code**.

## 🐧 Terminal setup

Here are my settings to replicate my terminal environment.

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

## Configure AWS credentials and environment variables

```bash
aws configure

# Edit the .env file with your actual values
nano .env  # or use your preferred editor
```

## 🚀 Deploy the Stack

**Deploy using automated script (Recommended):**

```bash
./deploy.sh
```

This script will:

- Automatically load environment variables from `.env`
- Validate environment variables
- Build TypeScript code
- Validate CDK templates
- Deploy the stack
- Display webhook URL for GitHub configuration

**Alternative manual deployment:**

First, update the environment variables in the `.env` file. Then run the following command, which ensures the variables are loaded into the environment before executing `npm run deploy` to deploy the stack.

```bash
export $(cat .env | grep -v '^#' | grep -v '^$' | xargs) && npm run deploy
```

## 📧 Configure Webhook and confirm Email Subscription

Add Webhook
Go to: `https://github.com/azarboon/REPO_NAME/settings/hooks`

- **Payload URL**: Get it from the outputs @azarboon: check whether its shown as output
- **Content type**: `application/json`
- **Secret**: Leave empty (optional for additional security)
- **Events**: Select "Just the push event"
- **Active**: ✅ Enabled

Update GitHub webhook URL if API Gateway endpoint changes

Check your email for SNS subscription confirmation and click the confirmation link.

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
│   GitHub Repo   │───▶│   API Gateway    │───▶│ GitHub Processor│
│ (azarboon/dummy)│    │ (REST API /webhook)   │     Lambda      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │  GitHub API      │◀───│   SNS Topic     │
                       │ (Fetch git diffs)│    │(Email Notifications)│
                       └──────────────────┘    └─────────────────┘
                                ▲                        │
                                │                        ▼
                                └────────────────────────┘
                                   Commit Details &
                                    Git Diff Data
```

### Components

- **API Gateway**: Receives GitHub webhook POST requests at `/webhook` endpoint
- **GitHub Processor Lambda**: Single function that validates webhooks, fetches git diffs, and sends notifications (Node.js 20.x, 512MB, 15s timeout)
- **SNS Topic**: Sends email notifications with commit details and git diffs to configured email address
- **GitHub API**: Fetched directly by Lambda for commit details and diffs (no authentication required for public repos)
- **CloudWatch Logs**: Automatic logging with 3-day retention for cost optimization

## 🔒 Security Features

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

## 🗂️ Project Structure

```
├── bin/
│   └── app.ts                           # CDK app entry point with env var support
├── lib/
│   └── github-monitor-stack.ts          # CDK stack (3-service architecture)
├── lambda/
│   └── processor.ts                     # Single Lambda function (webhook + git diff + email)
├── .amazonq/
│   ├── mcp.json                         # Model Context Protocol configuration
│   └── rules/
│       └── PROJECT_RULES.md             # Development rules and guidelines
├── .husky/
│   └── pre-commit                       # Git pre-commit hook for code quality
├── .env                                 # Environment variables (gitignored)
├── .eslintcache                         # ESLint cache for performance
├── .eslintignore                        # ESLint ignore patterns
├── .eslintrc.json                       # ESLint configuration for code quality
├── .gitignore                           # Git ignore patterns
├── .prettierignore                      # Prettier ignore patterns
├── .prettierrc.json                     # Prettier configuration
├── .tsbuildinfo                         # TypeScript build cache
├── cdk.json                             # CDK configuration
├── cdk.out/                             # CDK synthesis output (gitignored)
├── deploy.sh                            # Automated deployment script with .env loading
├── node_modules/                        # Dependencies (gitignored)
├── package-lock.json                    # Dependency lock file
├── package.json                         # Dependencies and npm scripts
├── tsconfig.json                        # TypeScript configuration
└── README.md                            # This file
```

## Ensure Project Rules Are Fed into the Amazon Q Cli Developer or your Coding Agent

When using the Amazon Q CLI terminal (or any other coding agent), ensure it has access to your project context by placing the rules file at:

`.amazonq\rules\PROJECT_RULES.md`

You can add a hook in Amazon Q Cli Developer to automatically load all `.md` rule files at the start of each `q chat` session:

`q>/hooks add --trigger conversation_start --command 'for f in .amazonq/rules/*.md; do q context add "$f"; done' add_rules_on_start`

However, as of writing this, adding hooks in Q cli may be buggy.

You can verify the added rules by running:

`q>/context show`

## 🔌 Model Context Protocol (MCP) Integration

> NOTE: The local MCP servers are currently unstable and prone to bugs. Even AWS, via their MCP GitHub repository, advises against using them in production environments. Their behavior is inconsistent—sometimes they function correctly, other times they do not. This section has been created for personal reference, and may be modified or removed in the future.

The MCP server configuration is located in `.amazonq/mcp.json`. This project supports both remote and local MCP server configurations:

- [aws-knowledge-mcp-server](https://github.com/awslabs/mcp/tree/main/src/aws-knowledge-mcp-server) – remote MCP server
- [awslabs.aws-api-mcp-server](https://github.com/awslabs/mcp/tree/main/src/aws-api-mcp-server) – local MCP (requires installation and manual startup)
- [awslabs.cdk-mcp-server](https://github.com/awslabs/mcp/tree/main/src/cdk-mcp-server) – local MCP (requires installation and manual startup)

### Local MCP Server Setup

#### One-Time Installation

```bash
# Install uv (Python packaging tool)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install AWS API MCP Server
uvx --from 'mcp-server-aws-api' mcp-server-aws-api

# Install AWS CDK MCP Server
uvx --from 'awslabs.cdk-mcp-server' awslabs.cdk-mcp-server
```

#### Runtime Setup (Before Each Q CLI Session)

Prior to starting Amazon Q CLI, ensure the local MCP servers are running and your AWS credentials are properly configured:

```bash
# Set up AWS credentials
aws configure

# Terminal 1: Start the AWS API MCP server
FASTMCP_LOG_LEVEL=DEBUG AWS_REGION=us-east-1 uvx awslabs.aws-api-mcp-server@latest

# Terminal 2: Start the AWS CDK MCP server
FASTMCP_LOG_LEVEL=DEBUG uvx awslabs.cdk-mcp-server@latest
```

To verify that MCP servers are active, you run:

```
ps aux | grep "aws-api-mcp-server"

ps aux | grep "cdk-mcp-server"


```

Start Amazon Q CLI in a third terminal:

`q chat > "test integration with all configured mcp servers"`

**Note:** At the time of writing, local MCP servers—particularly the AWS API MCP Server—may show unstable behavior. To confirm MCP server usage, explicitly ask Amazon Q within the session to verify MCP integration status.
