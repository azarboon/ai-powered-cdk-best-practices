<!-- ========================================= -->
<!-- PROTECTED SECTION - DO NOT MODIFY        -->
<!-- AI ASSISTANTS: DO NOT EDIT ANYTHING BETWEEN THESE MARKERS UNTIL AFTER IT EXPLICITLY SAYS "END PROTECTED SECTION"  -->
<!-- ========================================= -->

# Reference Application to Enhance AI-Powered Serverless Development

Providing a [reference application](https://martinfowler.com/articles/pushing-ai-autonomy.html) is an effective way to improve the quality of coding assistance. This project is designed as such a reference, showcasing serverless application development with AWS CDK TypeScript best practices.

Its configurations are intended to be reusable across other applications, regardless of business logic—enabling users to adopt proven TypeScript configurations, AI integration contexts, automated tests, security checks, and other best-practice project settings.

The sample business logic—monitoring changes in the `azarboon/dummy` GitHub repository, parsing and filtering commit content, and notifying the user of detected differences—is intentionally simple.  
The emphasis is on robust application- and project-level practices, such as automated code quality enforcement and AI-assisted tooling integration, rather than on optimizing the specific business logic.

The boilerplate integrates agentic coders (here, Amazon Q CLI Developer) with AWS Model Context Protocol (MCP) servers, but it can be adapted for other coding agents or MCP implementations. Development rules for the AI assistant are defined in `.amazonq/rules/PROJECT_RULES.md` to ensure consistent, secure, and high-quality outputs following best practices. While these contexts and configurations are not perfect and continue to evolve, they are designed for reuse in other projects.

@azarboon: test by creating and changing a new file, than just README.

## Warning

- [Context poisoning](https://martinfowler.com/articles/exploring-gen-ai/software-supply-chain-attack-surface.html) is a major risk when using coding assistants. Always review and validate external contexts and project rules before adopting them.
- Due to the unpredictable behavior of Amazon Q CLI, there have been instances of unintended commits or bloated logic. I continuously address and correct these issues as they arise. Contributions and pull requests are welcome.

## TODO

<!-- AI Assistant: The TODO section is a note to self. Completely ignore it. NEVER read it, NEVER change it, and NEVER act upon it. NEVER. -->

<!--
You optimized cdk stack (splitted constructs, dynamic ruling etc) but didnt deploy it...deploy and fix any error. then commit

• Add comprehensive JSDoc comments
• Implement automated dependency updates
• Add code coverage reporting

then ask mcps about optimizations for the stack as well as lambda..if nothing serious comes up again, go and write unit tests while validating logic
validate the data flow and write units



-->
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

## **Data Flow:**

1. **GitHub Push Event** → Webhook triggers `WebhookApi`
2. **API Gateway** → Validates JSON payload against schema, logs metada to Cloudwatch, forwards to Lambda
   @azarboon: continue from the following
3. **Lambda Function processor** → The lambda processor filters push events, validates repository, processes only the final commit from each push
4. **GitHub API Calls** → Lambda processor makes HTTPS requests to fetch commit details and file diffs
5. **SNS Publishing** → Lambda formats email content and publishes to SNS topic
6. **Email Delivery** → SNS delivers formatted commit notifications to email subscriber

## best practices I've implemented in this project:

- This project follows [AWS Solutions Library](https://github.com/cdklabs/cdk-nag/blob/main/RULES.md) rule pack through AWS CDK Nag check.
- Pritotizing to use CDK L3 constructs where deem fit
- API Gateway logs metadata for both requests and responses. @azarboon: validate this
- Defense in depth: API Gateway performs a light schema validation on webhook payloads. @azarboon: re-implement this. Lambda function performs a deeper input validation
- Using AWS Lambda powertools (using Lambda Layers) and their features for loging, tracing and metric
- Using Middy middleware to reduce lines of code in Lambda processor
- All resources tagged for cost tracking. @azarboon: make this more comprehensive
- API Gateway Request Validation
- API Gateway Resource Policy: Added IP allowlist restricting access to GitHub
  webhook IP ranges
- Lambda with powertools and structured logging and DLQ setup and retry @azarboon:verify dlq functionality
- Defense in Depth: Multiple layers of validation (API Gateway + Lambda +
  Signature verification)
- GitHub API calling with Retry Logic, exponential backoff (1s, 2s, 4s) for GitHub
  API failures and request timeout

## 🗂️ Project Structure

@azarboon: update this to include latest cli config such as .amazonq\mcp.json

```
├── bin/
│   └── app.ts                           # CDK app entry point with env var support
├── lib/
│   └── github-monitor-stack.ts          # CDK stack (3-service architecture)
├── lambda/
│   └── processor.ts                     # Single Lambda function (webhook + git diff + email)
├── .amazonq/
│   ├── mcp.json                       # Amazon Q CLI agent and MCP configuration
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

> NOTE: As of this writing, AWS advises against using AWS MCP servers in production environments due to their inconsistent behavior. Specifically, the integration between the AWS MCP servers and Amazon Q CLI is currently unstable and prone to bugs, especially in the WSL2 environment on Windows 11. The functionality of the servers fluctuates with each update to Q CLI—sometimes they work correctly, while at other times they do not.

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

#### Using MCP Servers

As of Amazon Q CLI version 1.13.2, running `q` in the project directory automatically starts and connects to MCP servers—no separate local server processes are required. However, the integration between Amazon Q CLI and MCP servers can be fragile and version-dependent. It is recommended to use the latest versions of both Amazon Q CLI and MCP servers. To verify proper integration, explicitly instruct Amazon Q CLI to test its connectivity with the MCP servers. For example, you can use the following prompt:

`q chat > "test integration with all configured mcp servers"`

## Testing

### Integration Test

A sample payload has been provided in `test\sample-webhook-payload.json` for integration testing. Ensure that the header `X-GitHub-Event=push` is set. Since a secret is involved, ensure that the X-Hub-Signature-256 header is set correctly. I recommend creating a sample webhook from GitHub to validate the configuration before proceeding.

Additionally, there may be checks such as matching `owner/repo` with the environment variables in `.env`. Refer to the schema used by API Gateway for request validation (i.e., `requestModels` in `lib\github-monitor-stack.ts`), as well as any further validations implemented in `lambda\processor.ts`.
