<!-- ========================================= -->
<!-- PROTECTED SECTION - DO NOT MODIFY        -->
<!-- AI ASSISTANTS: DO NOT EDIT ANYTHING BETWEEN THESE MARKERS UNTIL AFTER IT EXPLICITLY SAYS "END PROTECTED SECTION"  -->
<!-- ========================================= -->
## 🔒 CRITICAL PROJECT RULES

**These rules must be changed only by a human. Do not modify them automatically.**

- Always use the bare minimum configurations to avoid bloating the code. Always start simple and add complexity only when it's really needed.
- Strive to follow best practices (only from the official AWS documentation) when configuring services.
- Always follow security best practices (only from the official AWS documentation) and grant least privileged access.
- Use minimal IAM permissions in CDK roles and policies.
- Before making any commit to this repository, always ensure the README file is updated to reflect the latest changes. Also, make sure all build and deployment instructions and scripts are up to date.
- Comment all code blocks and each file, explaining their purpose. After making any changes to the code or files, ensure the comments are updated to reflect the latest changes. Make sure comments have a consistent tone and style, and that comments for relevant code and files follow a consistent format.
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