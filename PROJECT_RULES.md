<!-- ========================================= -->
<!-- PROTECTED SECTION - DO NOT MODIFY        -->
<!-- AI ASSISTANTS: DO NOT EDIT ANYTHING BETWEEN THESE MARKERS UNTIL AFTER IT EXPLICITLY SAYS "END PROTECTED SECTION"  -->
<!-- ========================================= -->

## 🔒 CRITICAL PROJECT RULES

**These rules must be changed only by a human. Do not modify them automatically.**

### Linting

- Before every commit, you must run ESLint to validate and lint all JavaScript and TypeScript files (including code and comments) in all project folders, excluding `node_modules`. This includes, at minimum, the `bin`, `lib`, and `lambda` directories.
- ESLint must be configured with the `@typescript-eslint/recommended` rule set to ensure consistent, high-quality TypeScript code. All JavaScript and TypeScript files must pass their respective linting rules without errors.
- You must run `eslint --fix` to automatically resolve any issues where possible. If any linting errors remain that cannot be fixed automatically, the commit must fail.
- Additionally, ensure that related automation scripts, and all instructions in the `README` clearly enforce and document this requirement. They must describe how linting is checked, when it runs, and what developers need to do to comply.
- All ESLINT\*.md files must always be kept up to date. Before any commit, you must ensure all these files accurately reflect the current ESLint configuration, enforcement policies, and code practices. If these files are outdated or inconsistent, the commit must fail. After making any changes to the ESLint configuration or related code, you must update these documentation files to reflect the latest changes.

### STRICT GIT COMMAND POLICY

- Do not commit anything automatically. Only commit when I explicitly run the git commit command myself. Each commit must be done manually; if I want to commit additional changes, I must run the command again.

FORBIDDEN COMMANDS (NEVER RUN AUTOMATICALLY):

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

### SEEK APPROVAL

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

### Comments

- All code comments in JavaScript and TypeScript files must comply with the `plugin:jsdoc/recommended` rule set and the project's custom JSDoc rules. This includes providing valid, complete JSDoc comments with clear descriptions, parameter details, and return annotations where applicable.
- All code blocks and files must include comments explaining their purpose and functionality. After making any changes to code or files, you must update the corresponding comments to reflect the latest changes. Comments must maintain a consistent tone, style, and format throughout the project to ensure clarity and maintainability.

### The rest

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
