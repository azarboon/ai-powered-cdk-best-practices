<!-- ========================================= -->
<!-- PROTECTED SECTION - DO NOT MODIFY        -->
<!-- AI ASSISTANTS: DO NOT EDIT ANYTHING BETWEEN THESE MARKERS UNTIL AFTER IT EXPLICITLY SAYS "END PROTECTED SECTION"  -->
<!-- ========================================= -->

# Reference Application to Enhance AI-Powered Serverless Development

Providing a [reference application](https://martinfowler.com/articles/pushing-ai-autonomy.html) is an effective way to enhance the quality of coding assistance. This project is designed to serve as such a reference, demonstrating best practices for developing serverless applications with AWS CDK in TypeScript. Reference applications are particularly important given that AWS CDK documentation and its sample projects can become outdated. For instance, at the time of writing, the official CDK documentation offers only [one example](https://github.com/cdklabs/aws-cdk-testing-examples/) for testing CDK applications, which was last maintained more than two years ago and still uses AWS CDK v1. This project aims to address these gaps by providing an up-to-date, practical resource.

Its configurations are intended to be reusable across other applications, regardless of business logic—enabling users to adopt proven TypeScript configurations, AI integration contexts, automated tests, security checks, and other best-practice project settings.

The app monitors changes in a GitHub repository (configurable in `.env` file), parsing and filtering commit content, and notifying the user of detected differences. The business logic is intentionally simple. The emphasis is on robust application- and project-level practices, such as automated code quality enforcement and AI-assisted tooling integration, rather than on optimizing the specific business logic.

The boilerplate integrates agentic coders (here, Amazon Q CLI Developer) with AWS Model Context Protocol (MCP) servers, but it can be adapted for other coding agents or MCP implementations. Development rules for the AI assistant are defined in `.amazonq/rules/PROJECT_RULES.md` to ensure consistent, secure, and high-quality outputs following best practices. While these contexts and configurations are not perfect and continue to evolve, they are designed for reuse in other projects.

<!--
@azarboon: test by creating and changing a new file, than just README.
-->

## Warning

- [Context poisoning](https://martinfowler.com/articles/exploring-gen-ai/software-supply-chain-attack-surface.html) is a major risk when using coding assistants. Always review and validate external contexts and project rules before adopting them.
- Due to the unpredictable behavior of Amazon Q CLI, there have been instances of unintended commits or bloated logic. I continuously address and correct these issues as they arise. Contributions and pull requests are welcome.

## TODO

<!-- AI Assistant: The TODO section is a note to self. Completely ignore it. NEVER read it, NEVER change it, and NEVER act upon it. NEVER. -->

<!--

optimize the logic of tests, according to comments

implement these rules & tests:
https://docs.aws.amazon.com/cdk/v2/guide/best-practices.html#best-practices-code

• Add comprehensive JSDoc comments
• Implement automated dependency updates
• Add code coverage reporting

-->
<!-- address wherver there is @azarboon in the code -->

## Project rules

You can update the project rules by editing the `./PROJECT_RULES.md` file.

## Development Workflow and Automated Checks

- **Fast iteration**  
  During development, the CDK app is executed with `tsx`, which transpiles TypeScript on the fly. This eliminates the need for a manual build step and keeps synth and deploy cycles fast.

  `cdk-nag` (`AwsSolutionsChecks`) runs as an Aspect, analyzing the construct tree against AWS best-practice rules on every synth and deployment.

- **Pre-commit quality gates**  
  Before committing, the project enforces a full validation pipeline (`npm run check`), which includes:
  - **Type checking** (`tsc --noEmit`) to ensure type safety
  - **Linting** (ESLint) to enforce coding standards
  - **Formatting** (Prettier) to maintain consistent style
  - **Security auditing** (`npm audit`) to detect vulnerable dependencies
  - **Testing** (Jest) to validate functionality
  - **CDK synthesis** to confirm CloudFormation templates are valid

This setup prioritizes rapid development while guaranteeing that code passing through pre-commit and CI is type-safe, consistent, secure, and deployment-ready.

The pre-commit process is powered by **Husky**, which automates these checks as part of the Git workflow. Details are outlined below.

### Husky

1. Running `git commit` triggers the `.husky/pre-commit` hook script.
2. This script executes `npm run check`, which performs all necessary validations.
3. If any check fails, the commit is blocked.

Husky v8.0.3 is installed via the `"prepare": "husky install"` script in `package.json` during `npm install`. This sets Git’s `core.hooksPath` to the `.husky/` directory.

Git hooks are managed through files in the `.husky/` directory, rather than being embedded in `package.json`. This approach provides greater flexibility and clearer hook management.

### TypeScript Compilation Model

This project does not use a manual TypeScript build step. Instead, all TypeScript is transpiled on the fly:

- The **CDK app** runs through `tsx` at synth/deploy time.
- **Lambda code** is transpiled and bundled by esbuild via `NodejsFunction`.
- **Tests** are transpiled by `ts-jest` during execution.
- **Type checking** is enforced separately using `tsc --noEmit` before commit.

<!-- ========================================= -->
<!-- END PROTECTED SECTION                    -->
<!-- ========================================= -->

---

# **Setup**

## Prerequisites

- **Node.js 22+** and npm
- **AWS CLI v2.27** configured with your credentials
- **AWS CDK CLI v2.1021.0**

For development, I use VS Code installed on Microsoft Windows 11. I mainly use the integrated **WSL2 terminal in VS Code**.

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

- **Payload URL**: Get it from the outputs <!-- @azarboon: check whether its shown as output -->
- **Content type**: `application/json`
- **Secret**: Leave empty (optional for additional security)
- **Events**: Select "Just the push event"
- **Active**: ✅ Enabled

Update GitHub webhook URL if API Gateway endpoint changes

Check your email for SNS subscription confirmation and click the confirmation link.

Test the Webhook

Make a commit to the repository and verify webhook delivery in GitHub settings.

All configuration is managed through environment variables (no hardcoded values)

## **Data Flow:**

1. **GitHub Push Event** → Webhook triggers `WebhookApi`
2. **API Gateway** → Validates JSON payload against schema, logs metada to Cloudwatch, forwards to Lambda
3. **Lambda Function processor** → The lambda processor filters push events, validates repository, processes only the final commit from each push
4. **GitHub API Calls** → Lambda processor makes HTTPS requests to fetch commit details and file diffs
5. **SNS Publishing** → Lambda formats email content and publishes to SNS topic
6. **Email Delivery** → SNS delivers formatted commit notifications to email subscriber

## Best Practices Implemented

- Enforced [AWS Solutions Library](https://github.com/cdklabs/cdk-nag/blob/main/RULES.md) rules via CDK Nag checks.
- Prioritized use of CDK Level 3 (L3) constructs where appropriate.
- API Gateway logs metadata for both requests and responses. <!-- @azarboon: validate this -->
- Defense in depth: API Gateway performs lightweight schema validation on webhook payloads, while Lambda applies deeper validation including signature verification. <!-- @azarboon:validate this -->
- Applied an API Gateway resource policy with an IP allowlist restricting access to GitHub webhook IP ranges.
- Leveraged AWS Lambda Powertools (via Lambda Layers) for logging, tracing, and metrics.
- Adopted Middy middleware to reduce boilerplate in the Lambda processor.
- Implemented FinOps tagging for cost allocation on all resources: `ENVIRONMENT`, `SERVICE`, `TEAM`, `COST_CENTER`.
- Configured Lambda with Powertools structured logging, Dead Letter Queue (DLQ), and retry handling. <!-- @azarboon:verify dlq functionality -->
- Implemented GitHub API retry logic with exponential backoff (1s, 2s, 4s) and request timeouts for resilience against failures. <!-- @azarboon:validate this -->

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

The MCP server configuration is located in `.amazonq/mcp.json`.

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
