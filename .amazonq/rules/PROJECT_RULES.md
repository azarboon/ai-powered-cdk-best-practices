<!-- ========================================= -->
<!-- PROTECTED SECTION - DO NOT MODIFY        -->
<!-- AI ASSISTANTS: DO NOT EDIT ANYTHING BETWEEN THESE MARKERS UNTIL AFTER IT EXPLICITLY SAYS "END PROTECTED SECTION"  -->
<!-- ========================================= -->

## 🔒 CRITICAL PROJECT RULES

**These rules must be changed only by a human. Do not modify them automatically.**

### Decision-Making Protocol

- Whenever there are more than one possible approaches to solve an issue, never make any changes before presenting all available options to me. This applies even if I have previously given you permission to proceed automatically.
- Always present each viable option clearly, explain the pros and cons, and state your recommendation. Do not implement or act on any option without my explicit approval at that moment.
- This process must be followed on every occasion, regardless of any prior standing permission to act.
- Especially after troubleshooting any issue, you must never proceed with a solution on your own. You must present me with all viable options, including pros and cons, and I will choose the approach. Only after I decide will you proceed with implementation. Repeat this process for every troubleshooting case.

## Error Handling Rule

When I provide you with an error message, you must **not** attempt to fix it or take any autonomous action immediately.

1. **Present Options First** – Provide me with multiple possible solutions to address the error.
2. **Await Explicit Choice** – Do not proceed until I have selected one of the options and explicitly granted permission.
3. **Repeat for Every Error** – This process must be followed for each new error message I provide.

### Lambda functions, Lambda Powertools and Middy rules

- In ALL Lambda functions, implement all error handling, logging, tracing, input validation, and input parsing using **AWS Lambda Powertools** utilities, integrated via the **Middy** middleware. This enforces consistent best-practice instrumentation, standardized validation and parsing, and centralized handling of cross-cutting concerns.
- Resolve the Powertools dependency using the official **Lambda Layers** to ensure consistent versioning, reduced deployment package size, and simplified dependency management across multiple functions.
- When chaining Powertools middlewares in Middy, order them as: Tracer → Logger → others (e.g., Metrics). This ensures tracing covers the full invocation and the original event is logged before any modification.
- If a middleware ends execution early (short-circuits), ensure Powertools cleanup still runs before returning so traces are properly closed and metrics are emitted. If you bypass the normal middleware flow, invoke the appropriate cleanup for each utility explicitly (for example, via the documented cleanup helper).

### Avoid using unstable features in any part of the code

Do not use experimental, alpha, beta, preview, or otherwise unstable features in AWS CDK, Node.js, JavaScript, or TypeScript code. This applies to any API, module, construct, or language feature not marked as stable in official documentation.

Specifically, **do not** use:

- CDK modules or constructs with the `@aws-cdk/aws-...-alpha` or `@aws-cdk/aws-...-experimental` scope, or any construct labeled _Experimental_ in docs.
- TypeScript experimental features, such as decorators (`experimentalDecorators`), metadata reflection (`emitDecoratorMetadata`), or features requiring unstable compiler flags.
- Node.js or JavaScript experimental APIs (e.g., anything requiring `--experimental-*` runtime flags).

Always select stable, production-ready APIs and language features to ensure maintainability, forward compatibility, and predictable behavior. If an unstable feature appears to solve a problem, pause and present stable alternatives before proceeding.

### IAM Policy Resource Rules

**All IAM policies must follow least-privilege principles and use fully qualified ARNs whenever possible.**

- Prefer explicit ARNs constructed using `cdk.Aws.REGION`, `cdk.Aws.ACCOUNT_ID`, and consistent naming conventions.
- Wildcards (e.g., `:*` or `/*`) are acceptable **only when required by the AWS service**, such as for:
  ✅ `arn:aws:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:/aws/lambda/MyFunction:*`  
  ✅ `arn:aws:s3:::my-bucket/*`  
  ✅ `arn:aws:dynamodb:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:table/MyTable/index/*`
- `"Resource": "*"` must never be used unless the action truly cannot be scoped (e.g., `logs:DescribeLogGroups`) and the permission is explicitly reviewed and approved by a human.
- CDK resource references such as `.arn` or `.logGroupArn` are generally safe and recommended **within the same stack**. Use caution when applying them in IAM policies where the target resource may not yet exist — i.e., if the ARN needs to resolve during synthesis before the resource is defined.
- If an unscopable action is required, isolate it in a **dedicated IAM policy statement** containing only that action. This reduces blast radius and clarifies its intent.

# Specific rules for this project. Others may want to tweak them to fit their own project.

AI assistants must NEVER change any of these files automatically unless they have explicit approval from a human. Approval is valid only once, and additional approval must be obtained for any future changes: .eslintrc.json, tsconfig.json, package.json, .husky\pre-commit

## **Rule: Suggestions Must Never Trigger Automatic Actions**

**The agent MUST NOT take any action on suggestions automatically.**  
All suggested changes, fixes, upgrades, deletions, or modifications MUST be presented to the user first for approval.

This rule MUST be followed strictly across the entire project lifecycle

# TypeScript and Code-Related Rules

## Avoid Implicit Defaults with `||`

- Do **not** use the `||` operator to assign default values to variables or properties unless explicitly requested by a human and approved.
- This prevents unintentionally masking valid falsy values and ensures defaults are applied only with deliberate intent.

# AWS CDK Project Rules

These rules are aligned with AWS CDK official best practices and MUST be strictly followed throughout the entire project to ensure clean, maintainable, and predictable AWS infrastructure code.

---

## Create smaller and focused CDK Constructs

Break large CDK stacks or CDK constructs into smaller, focused constructs to keep the main construct clean, organized, and easier to maintain. For example:

```typescript
export class MyApplicationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const serviceApi = new ServiceApiConstruct(this, 'ServiceApi', { ... });
    const messaging = new MessagingConstruct(this, 'Messaging', { ... });
    // Much cleaner and more organized
  }
}
```

## CDK Construct Selection Policy

1. Always prioritize the highest-level CDK construct (L3/pattern) that meets functional, security, compliance, and cost requirements **and** is actively maintained (updated within the last 6 months, with responsive issue handling).
2. If no suitable L3 exists or it imposes unacceptable constraints:
   - Use an L2 construct instead.
   - Document why a higher-level construct was not suitable and how it was evaluated.
   - Obtain explicit approval before implementation.
3. Use an L1 construct only if:
   - The required capability is not available in L2/L3, or
   - Fine-grained control is needed beyond what L2/L3 allow.
   - Keep the L1 scope minimal and wrap it in a custom construct.
   - Apply the same documentation and approval rules as for L2.
4. Before selecting a construct:
   - Search the AWS CDK documentation and construct catalogs.
   - Check maintenance status, feature coverage, limits, and roadmap.
5. Do not rely solely on defaults. Explicitly review and configure IAM, encryption, networking, and observability settings as needed.
6. All constructs and configurations must be validated with:
   - Unit tests for logic, and
   - Integration tests that verify the actual AWS resources created.
7. Prefer composition over inheritance. Keep construct APIs stable to allow easy swapping between L1, L2, and L3 in the future.

## CDK Construct Design and Construct Composition

- Always separate responsibilities when designing constructs. Each construct should perform exactly one clearly defined function (Single Responsibility Principle).
- Before creating a new construct, document your design rationale: why it is needed, how it will interact with other constructs, and the trade-offs compared to alternative approaches. Proceed only after admin approval.
- If the same resource or grouping of resources is used repeatedly, wrap them into a custom composite construct that exposes only the minimal public surface (e.g., endpoints, ARNs, IDs).
- Do not treat a stack as a construct when counting responsibilities. Stacks orchestrate constructs; constructs encapsulate functionality.

## Do Not Hardcode Environment Name Constants

Never hardcode environment names (e.g., `dev`, `test`, `prod`) anywhere in the code except in `lib/config.ts`. Each environment must be defined inside the `ENVIRONMENTS` object. To reference an environment, import and use the property (e.g., `import { ENVIRONMENTS } from './config'` then `ENVIRONMENTS.PROD`), and always refer to the object properties, not string literals.

## Naming Convention Rule – Dynamic Component Names

Never hardcode component names in infrastructure code; instead, dynamically generate them by combining the stack name with a relevant suffix (e.g., {stackName}-topic for an SNS topic, {stackName}-processor for a Lambda function, or {stackName}-api for an API Gateway). This ensures consistent naming across environments, avoids resource name collisions, and supports maintainable, scalable deployments.

## CDK Construct ID Naming Rule

All CDK construct IDs MUST be:

- **Stable and descriptive** – no environment-dependent or runtime values.
- **PascalCase**
- **Human-readable** – meaningful names that reflect the construct’s purpose.
- **Optionally include a type suffix** (e.g. `Function`, `Queue`, `Topic`) for clarity.

### ✅ Correct – Stable PascalCase IDs

```typescript
new NodejsFunction(this, 'ProcessorFunction', { ... });
new ApiGatewayToLambda(this, 'RestApi', { ... });
new RequestValidator(this, 'RequestValidator', { ... });
```

### ❌ Wrong – Dynamic or non-PascalCase IDs

```typescript
// Uses environment/runtime values
new NodejsFunction(this, `${stackName}-processor`, { ... });
new ApiGatewayToLambda(this, `${Aws.ACCOUNT_ID}-RestApi`, { ... });

// Inconsistent casing
new NodejsFunction(this, 'processor', { ... });
new RequestValidator(this, 'validator', { ... });
```

## Avoid duplicating resource names in CDK constructs

Never duplicate resource names when creating CDK constructs.  
If a construct's ID and a resource property (e.g., `functionName`, `queueName`, `topicName`) would have the same value, reference the construct's ID with `this.node.id` instead of repeating the string literal.

**❌ Wrong:**

```typescript
this.lambdaFunction = new NodejsFunction(this, `${stackName}-processor`, {
  functionName: `${stackName}-processor`, // Duplicated
});
```

**✅ Correct:**

```typescript
this.lambdaFunction = new NodejsFunction(this, `${stackName}-processor`, {
  functionName: this.node.id, // References construct ID
});
```

## Single Responsibility Constructs and Stacks

**Each Construct or Stack MUST perform exactly one clearly defined function.**  
They MUST NOT combine unrelated responsibilities within a single class.

---

## Avoid Instantiating Other Stacks Inside Constructors

**Constructs and Stacks MUST NOT create instances of other Stack classes within their constructors.**  
All cross-stack relationships MUST be wired in the app entry point to maintain clear deployment structure.

---

## Pass Dependencies via Props

**All dependencies MUST be provided through constructor properties.**  
Constructs and Stacks MUST NOT create their own dependencies internally.

---

## Use Environment Variables, Context, or Deployment Profiles for Account and Region

**Stacks MUST retrieve AWS account and region configuration from environment variables, CDK context, or deployment profiles.**  
Hardcoding AWS account IDs or regions is strictly forbidden.

---

## Define Composition in app.ts

**All stack instantiation and dependency wiring MUST happen in the app entry point (`app.ts`).**  
Stacks MUST NOT create or wire other stacks internally.

---

## Prefer Outputs, Imports, or Parameter Store for Cross-Stack References

**Cross-stack communication SHOULD prefer CloudFormation Outputs/Imports or parameter store values to maintain loose coupling.**  
Direct construct references within the same app ARE acceptable when appropriate but SHOULD be used carefully to avoid tight coupling.

---

## Minimize Direct Resource References Across Stacks

**Stacks SHOULD minimize direct resource references across stacks to reduce deployment coupling.**  
When needed, AWS CDK’s built-in cross-stack reference handling MAY be used thoughtfully.

---

## Group Related Resources Into Cohesive Constructs

**Related AWS resources MUST be encapsulated into cohesive, well-defined Constructs.**  
Constructs MUST expose only what is necessary to avoid leaking internal details.

---

## Define Clear Boundaries for Environments

**Stacks MUST define clear boundaries for different deployment environments.**  
Environment-specific logic MUST be handled via context variables or separate stack definitions.

---

## Keep Construct Constructors Side-Effect Free

**Construct constructors MUST be free of side effects.**  
They MUST only declare AWS resources and MUST NOT perform deployments, API calls, or mutate external state.

**These rules MUST be strictly followed throughout the entire project. Any violation MUST be corrected before code is merged.**

# Rules for Writing and Modifying CDK Tests

- Write tests with clear, behavior-focused names that state exactly what is being verified. Each test must cover one behavior only; if that behavior breaks, exactly one test should fail, and the test name should make the failure obvious. Do not copy-paste common assertions; extract shared checks into fixtures or helper functions.

- Prefer fine-grained, targeted assertions using the CDK Assertions library rather than hand-rolled JSON checks. Use built-in features from `aws-cdk-lib/assertions` such as `Template`, `Tags` (for checking and matching tags), `Match`, `Matcher`, etc. If a built-in feature exists, use it instead of custom code.

- Never run tests against internal constructs of resources; always run tests against the synthesized template.

- Use `Template.fromStack` with helpers like `resourceCountIs`, `hasResource`, and `hasResourceProperties`.  
  Combine these with `Match.*` (e.g., `Match.objectLike`, `Match.stringLikeRegexp`, `Match.absent`) to avoid brittle equality checks.  
  Assert on resource types and key properties, not on logical IDs, asset hashes, parameter names, asset paths, or resource ordering.

- Synthesize once per test file (e.g., in `beforeAll`) and reuse the `Template` to avoid redundant synths and speed up tests.

- Keep tests deterministic. Pin all context lookups (for example, by committing `cdk.context.json` or setting explicit context in `cdk.json`) so synth results do not flap. Avoid assertions that depend on timestamps, random values, or environment-specific configuration unless those values are controlled in the test.

- Use the assertions API for template annotations when validating warnings or errors, for example `Annotations.fromStack(stack).hasWarning(...)` or `hasError(...)`, rather than parsing synthesized output manually.

- Do not couple tests to construct implementation details. Assert the resulting CloudFormation behavior (resource types and properties) rather than internal L2/L3 specifics that may change across CDK versions.

- Use snapshot tests only when explicitly instructed. If snapshots are allowed for a case, keep them minimal and focused on stable fragments—never entire templates—and prefer matcher-based assertions first.

- Never remove any test unless explicitly instructed by a human.

- Never alter any test unless explicitly instructed by a human.

# 🛡️ AWS CDK Nag Policy Rules

**Required Rule Packs**  
All CDK stacks must be validated against the following CDK Nag rule packs:

- `AwsSolutions`(AWS Solutions Library)
- `NIST80053R5` (NIST 800-53 Revision 5)
  Additional rule packs may be added as needed based on compliance scope.

**CDK Nag Must Be Checked Explicitly**  
You must include CDK Nag in a separate script (e.g., `nag-check.ts`) to validate AWS CDK stacks for security and compliance issues. These checks must not modify stack code.

**Do Not Enforce CDK Nag at Deploy Time**  
CDK Nag must not block or fail `cdk deploy`. It should be executed independently (e.g., via `npm run nag:check`) to maintain deploy flexibility while enforcing compliance.

**No Automatic Suppressions**  
You must not insert CDK Nag suppression rules unless explicitly instructed by a human. All CDK Nag suppressions must be manually reviewed and approved. Each suppression requires a distinct and explicit human approval. An approval granted for one suppression must not be reused or assumed valid for other suppressions.

**Documented Suppressions Required**  
Each suppression requires a distinct and explicit human approval. An approval granted for one suppression must not be reused or assumed valid for other suppressions. Every suppression must include a clear comment detailing:

- Business justification
- Risk assessment
- Optional remediation plan and timeline
- Approval authority or approver identity

**Fail on Warning or Error**  
 The CDK Nag check script must exit with status code `1` if any `error` messages are found during synthesis.

**Verbose Output Required**  
 CDK Nag must output detailed human-readable information, including the rule ID (e.g., `AwsSolutions-IAM4`) and the construct path where it failed.

**CDK Nag Integration Must Be Reusable**  
 CDK Nag logic must be modular (e.g., `nag-check.ts`) and designed to work across multiple stacks without duplication or hardcoding.

**Custom Rule Support**  
 The CDK Nag configuration must support adding custom organizational rules when applicable, using `NagPack` extensions.

**Findings Reporting**  
 CDK Nag findings must be exportable in structured format (e.g., JSON, CSV) for auditing and tracking security/compliance trends over time.

**These rules MUST be strictly followed throughout the entire project. Any violation MUST be corrected before code is merged.**

# Linting

- Before every commit, you must run ESLint to validate and lint all JavaScript and TypeScript files (including code and comments) in all project folders, excluding `node_modules`. This includes, at minimum, the `bin`, `lib`, and `lambda` directories.
- ESLint must be configured with the `@typescript-eslint/recommended` rule set to ensure consistent, high-quality TypeScript code. All JavaScript and TypeScript files must pass their respective linting rules without errors.
- You must run `eslint --fix` to automatically resolve any issues where possible. If any linting errors remain that cannot be fixed automatically, the commit must fail.
- Additionally, ensure that related automation scripts, and all instructions in the `README` clearly enforce and document this requirement. They must describe how linting is checked, when it runs, and what developers need to do to comply.
- All ESLINT\*.md files must always be kept up to date. Before any commit, you must ensure all these files accurately reflect the current ESLint configuration, enforcement policies, and code practices. If these files are outdated or inconsistent, the commit must fail. After making any changes to the ESLint configuration or related code, you must update these documentation files to reflect the latest changes.

# STRICT GIT COMMAND POLICY

## 🚨 CRITICAL RULE: GIT OPERATIONS FORBIDDEN

### **ABSOLUTE PROHIBITION**

- **NEVER run any git commands** (`git add`, `git commit`, `git push`, `git merge`, etc.)
- **NEVER execute state-changing commands** without explicit permission
- **NEVER assume permission** - always ask first

### **USER-ONLY GIT OPERATIONS**

- **Only the user runs git commands**

### **VIOLATION CONSEQUENCES**

- **I must**: Acknowledge the violation and apologize
- **I must**: Recommit to following these rules strictly

### **ALLOWED ACTIONS (NO PERMISSION NEEDED)**

- Reading files (`fs_read`)
- Analyzing code
- Suggesting changes
- Showing what commands would do (without executing)

### **FORBIDDEN ACTIONS (ALWAYS NEED PERMISSION). (NEVER RUN AUTOMATICALLY)**

- `git commit` (in any form)
- `git commit -m`
- `git commit --no-verify`
- `git commit --amend`
- `git push`
- `git merge`
- `git rebase`
- `git reset --hard`
- `git checkout` (when switching branches)

ALLOWED GIT COMMANDS (READ-ONLY ONLY):

- `git status`
- `git diff`
- `git log`
- `git show`
- `git ls-files`

ABSOLUTE PROHIBITIONS:

- NEVER run git commit under ANY circumstances
- NEVER use "emergency" or "necessary" as justification for automatic commits
- NEVER use --no-verify or other bypass flags
- NEVER rationalize that "testing requires committing"

REQUIRED BEHAVIOR:

- ALWAYS ask permission before git operations
- ALWAYS explain what files will be changed BEFORE changing them
- ALWAYS provide commands for user to run manually
- ALWAYS respect user's explicit instructions over technical convenience

If AI assistant runs forbidden git commands:

1. **IMMEDIATE ACKNOWLEDGMENT**: "I violated your git command restrictions"
2. **SPECIFIC VIOLATION**: List exactly which commands were run
3. **NO EXCUSES**: Don't justify or rationalize the violation
4. **CORRECTIVE ACTION**: Explain how to prevent it in future
5. **COMMITMENT**: Explicitly commit to following rules going forward

- AI must always end responses with: "Ready for you to commit when you choose"
- AI must provide exact commands for user to copy-paste
- AI must never assume permission to commit

Emergency Override Prevention:
FORBIDDEN JUSTIFICATIONS:

- "Need to commit to test the fix"
- "Broken hook requires --no-verify"
- "Just this once for technical reasons"
- "User will want this committed anyway"

GIT COMMAND RESTRICTIONS. ABSOLUTE RULE: NO AUTOMATIC COMMITS

- AI assistant MUST NEVER run `git commit` commands
- AI assistant MUST NEVER use git bypass flags (--no-verify, etc.)
- AI assistant MUST ALWAYS ask permission before git operations
- AI assistant MUST provide manual commands for user to run
- AI assistant MUST NEVER use git bypass flags (--no-verify, etc.)
- AI assistant MUST ALWAYS ask permission before git operations
- AI assistant MUST provide manual commands for user to run
- AI assistant MUST ALWAYS ask permission before git operations
- AI assistant MUST provide manual commands for user to run
- AI assistant MUST provide manual commands for user to run

VIOLATION = IMMEDIATE ACKNOWLEDGMENT REQUIRED
If this rule is violated, AI must immediately acknowledge the violation without excuses.

# SEEK APPROVAL

### **🚫 NEVER DO WITHOUT APPROVAL**

1. Never modify any files without explicit user approval first
2. Never run commands that change the project state
3. Never assume what the user wants - always ask first
4. Never make "improvements" unless specifically requested

### **✅ ALWAYS DO FIRST**

1. Ask for permission before any file modifications
2. Explain what I plan to change and why
3. Show the exact changes I would make
4. Wait for explicit "yes" or "go ahead" before proceeding
5. Offer options instead of making decisions

### **📋 Investigation Protocol**

1. Read and analyze only - no modifications
2. Present findings with suggested solutions
3. Ask which solution you prefer before implementing
4. Make changes only after approval

### **🔄 Workflow**

1. Investigate → 2. Present options → 3. Get approval → 4. Implement

# Comments

- All code comments in JavaScript and TypeScript files must comply with the `plugin:jsdoc/recommended` rule set and the project's custom JSDoc rules. This includes providing valid, complete JSDoc comments with clear descriptions, parameter details, and return annotations where applicable.
- All code blocks and files must include comments explaining their purpose and functionality. After making any changes to code or files, you must update the corresponding comments to reflect the latest changes. Comments must maintain a consistent tone, style, and format throughout the project to ensure clarity and maintainability.

# The rest

- Always use the bare minimum configurations to avoid bloating the code. Always start simple and add complexity only when it's really needed.
- Strive to follow best practices (only from the official AWS documentation) when configuring services.
- Always follow security best practices (only from the official AWS documentation) and grant least privileged access.
- Use minimal IAM permissions in CDK roles and policies.
- Before making any commit to this repository, always ensure the README file is updated to reflect the latest status of the project and its configurations. Also make sure all build and deployment instructions and scripts are up to date, and that the architecture diagram shows the latest status. However, do not edit any of the protected sections in the README file.
- In the README file, do not act on the TODO section.
- Every time the Webhook URL changes (and only after it changes), provide the updated version so I can update the GitHub webhook configuration.
- Make sure only the necessary files and folders are committed to Git; gitignore the rest.
- Make sure no credentials, secrets, or environment variables containing secrets are committed to Git.
- Don't change these three sections in the README: the first section, TODO, and Prompt.
- Always use stable versions of packages, preferably the latest stable version. Never use beta or unstable versions.
- Always use packages from official accounts or verified sources.
- Follow consistent naming conventions and code formatting.
- Include clear setup instructions if new dependencies or configurations are added.
- Validate and lint the code before finalizing changes. Always include ESLint with TypeScript rules and ensure all code passes linting. Always run ESLint before committing any changes.
- Ensure all resources created have appropriate tagging for cost tracking and ownership. Use environment variables; you can use `env=dev` as the default tag and its associated value.
- Do not hard-code any secrets; instead, use AWS Parameter Store.
- Do not hard-code configurations such as the AWS account ID, deployment region, AWS account username, the SNS notification email address, or the GitHub repository to be monitored. Instead, use environment variables and follow best practices from the official AWS and CDK documentation for managing configuration. Ask me in a safe and secure way to provide the account ID and credentials so you can deploy the stack in AWS.
- Always use CDK to modify infrastructure. Avoid making manual changes in the AWS console to resources managed by CDK, as this can cause drift and deployment failures.
- Always run `cdk synth` to check for errors and review the generated CloudFormation templates. This helps ensure code quality and prevents deploying unintended changes.
- Always keep the architecture diagram in the README updated and high level. Ensure arrows accurately show component interactions. Size it to fit a page without scrolling, and keep all elements consistent.

<!-- ========================================= -->
<!-- END PROTECTED SECTION                    -->
<!-- ========================================= -->
