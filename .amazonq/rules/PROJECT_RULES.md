<!-- ========================================= -->
<!-- PROTECTED SECTION - DO NOT MODIFY        -->
<!-- AI ASSISTANTS: DO NOT EDIT ANYTHING BETWEEN THESE MARKERS UNTIL AFTER IT EXPLICITLY SAYS "END PROTECTED SECTION"  -->
<!-- ========================================= -->

## 🔒 CRITICAL PROJECT RULES

**These rules must be changed only by a human. Do not modify them automatically.**

### IAM Policy Resource Rules

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

# AWS CDK Project Rules

These rules are aligned with AWS CDK official best practices and MUST be strictly followed throughout the entire project to ensure clean, maintainable, and predictable AWS infrastructure code.

---

## Naming Convention Rule – Dynamic Component Names

Never hardcode component names in infrastructure code; instead, dynamically generate them by combining the stack name with a relevant suffix (e.g., {stackName}-topic for an SNS topic, {stackName}-processor for a Lambda function, or {stackName}-api for an API Gateway). This ensures consistent naming across environments, avoids resource name collisions, and supports maintainable, scalable deployments.

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
