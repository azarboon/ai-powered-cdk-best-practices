<!-- ========================================= -->
<!-- PROTECTED SECTION - DO NOT MODIFY        -->
<!-- AI ASSISTANTS: DO NOT EDIT ANYTHING BETWEEN THESE MARKERS UNTIL AFTER IT EXPLICITLY SAYS "END PROTECTED SECTION"  -->
<!-- ========================================= -->

# AI-Powered Serverless Boilerplate with AWS CDK and TypeScript Following Best Practices

This AWS CDK application monitors any GitHub repository (in this example, `azarboon/dummy`) for new commits and reads the content of its README file. It is an educational AWS app built with AWS CDK in TypeScript, designed to leverage AI-powered tools for development (e.g., agentic coders and Model Context Protocol - MCPs) and to demonstrate best practices such as automated code quality checks, security validations, tests, and more.

The app is developed using Amazon Q CLI Developer, but other agentic coders can be used as well. While Amazon Q CLI can be highly capable, it may also behave unpredictably. This project focuses on harnessing its capabilities effectively. To support this, special attention is given to the development context—specifically, the rules the AI assistant must follow, which are defined in `.amazonq\rules\PROJECT_RULES.md`. These rules are designed to guide Amazon Q CLI usage but can also be applied to other AI assistants or projects. The goal is to create a boilerplate that simplifies working with Amazon Q CLI while enforcing solid development practices.

## Warning

Due to the unpredictable behavior of Amazon Q CLI, there have been instances of unintended commits or bloated logic. I continuously address and correct these issues as they arise. Contributions and pull requests are welcome.

## TODO

<!-- AI Assistant: The TODO section is a note to self. Completely ignore it. NEVER read it, NEVER change it, and NEVER act upon it. NEVER. -->

create an event for integration test
validate the data flow and write units

<!-- address wherver there is @azarboon in the code -->

<!-- ask chatgpt how to optimize ts compliation process both in ts settings, package.json as well as deploy.sh........in cdk.json file, app section: use precompiled JS (node lib/app.js) instead of ts-node for faster, reliable CDK deploys with explicit tsc control. -->

## Project rules

You can update the project rules by editing the `./PROJECT_RULES.md` file.

## Development Flow and Automated Checks

To streamline development, a set of automated checks has been configured to run before each commit. However, it’s recommended that you manually run these checks before both committing and deploying. Use:

```bash
npm run check
```

This runs the full validation suite. The pre-commit process is powered by **Husky**, which automates these checks as part of the Git workflow. Details are outlined below.

### Pre-Commit Workflow

1. Running `git commit` triggers the `.husky/pre-commit` hook script.
2. This script executes `npm run check`, which performs all necessary validations.
3. If any check fails, the commit is blocked.

### ✅ Automated Checks (`npm run check`)

- **ESLint:** All TypeScript files must pass linting with zero tolerance for warnings. Configuration is defined in `.eslintrc.json`. Caching is enabled for performance.
- **Security Audit:** `npm run audit` detects vulnerable npm dependencies. The process fails if any are found.
- **Code Formatting:** Enforces formatting rules defined in `.prettierrc.json`.
- **CDK Security Scan:** Performs automated security checks using **AWS CDK Nag** against rules from the [AWS Solutions Library](https://github.com/cdklabs/cdk-nag/blob/main/RULES.md).

### 🔧 Husky Pre-Commit Configuration

Husky v8.0.3 is installed via the `"prepare": "husky install"` script in `package.json` during `npm install`. This sets Git’s `core.hooksPath` to the `.husky/` directory.

Git hooks are managed through files in the `.husky/` directory, rather than being embedded in `package.json`. This approach provides greater flexibility and clearer hook management.

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

Here are my settings to replicate my terminal environment.

**.bashrc Key Settings**:

```bash
export NPM_CONFIG_PREFIX="$HOME/.npm-global"
export PATH="$HOME/.npm-global/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
export PATH=$(echo $PATH | tr ':' '\n' | grep -v "/mnt/c/Users/YOUR_USERNAME/AppData/Roaming/npm" | tr '\n' ':' | sed 's/:$//')
export GIT_ASKPASS="/mnt/c/Windows/System32/cmd.exe"
export GIT_CREDENTIAL_HELPER="wincred"
```

## Configure AWS credentials and environment variables

```bash
aws configure

# Edit the .env file with your actual values, else you may get error in later stages
nano .env
```

## 🚀 Deploy the Stack

**Deploy using automated script (Recommended):**

```bash
./deploy.sh
```

This script will:

- Automatically loads environment variables from `.env` file and validates them
- Installs or updates dependencies if necessary
- Bootstraps the CDK environment if needed
- Builds TypeScript code
- Validates the CDK template
- Deploys the stack

**Alternative manual deployment:**

First, update the environment variables in the `.env` file. Then run the following commands:

```bash
npm run install

npm run bootstrap

npm run deploy
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

@azarboon: go through each one by one and validate these

## **Data Flow:**

1. **GitHub Push Event** → Webhook triggers API Gateway `/webhook` endpoint
2. **API Gateway** → Validates JSON payload against schema, logs to CloudWatch, forwards to Lambda
3. **Lambda Function** → Filters push events, validates repository, processes up to 3 commits
4. **GitHub API Calls** → Lambda makes HTTPS requests to fetch commit details and file diffs
5. **SNS Publishing** → Lambda formats email content and publishes to SNS topic
6. **Email Delivery** → SNS delivers formatted commit notifications to email subscriber

## 🔒 Security Features

- This project follows [AWS Solutions Library](https://github.com/cdklabs/cdk-nag/blob/main/RULES.md) rule pack through AWS CDK Nag check.

## 💰 FinOps practices

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

> NOTE: The local MCP servers are currently unstable and prone to bugs especially in WSL2 environment while using Windows 11. Even AWS, via their MCP GitHub repository, advises against using their MCPs in production environments. Their behavior is inconsistent—sometimes they function correctly, other times they do not. This section has been created for personal reference, and may be modified or removed in the future.

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

**Note:** At the time of writing, local MCP servers—particularly the AWS API MCP Server—may show unstable behavior in WSL2 environment. To confirm MCP server usage, explicitly ask Amazon Q within the session to verify MCP integration status.
