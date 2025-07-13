#!/bin/bash

# =============================================================================
# GitHub Monitor CDK Application - Deployment Script
# =============================================================================
# 
# Purpose: Automated deployment with build validation
# 
# NOTE: ESLint validation is enforced ONLY at commit time via pre-commit hooks
# - Deployment focuses on build and CDK template validation
# - Code quality is ensured before commits, not before deployments
# - This allows faster deployment cycles while maintaining code quality
#
# This script:
# 1. Validates environment variables
# 2. Builds TypeScript code
# 3. Validates CDK templates
# 4. Deploys the stack
# 5. Displays important outputs
#
# Usage: ./deploy.sh
# Prerequisites: Environment variables must be set (see .env.template)
#
# =============================================================================

set -e  # Exit on any error

echo "🚀 GitHub Monitor CDK Deployment Script"
echo "========================================"
echo ""
echo "ℹ️  Code Quality: ESLint validation enforced at commit time only"
echo "   - Pre-commit hooks ensure code quality before commits"
echo "   - Deployment focuses on build and template validation"
echo "   - Faster deployment cycles with maintained code quality"
echo ""

# =============================================================================
# STEP 1: Environment Validation
# =============================================================================
echo "📋 Step 1: Validating environment variables..."

# Check required environment variables
REQUIRED_VARS=(
    "CDK_DEFAULT_ACCOUNT"
    "GITHUB_REPOSITORY" 
    "NOTIFICATION_EMAIL"
)

MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

# Check alternative AWS variables if CDK_DEFAULT_* not set
if [ -z "$CDK_DEFAULT_ACCOUNT" ] && [ -z "$AWS_ACCOUNT_ID" ]; then
    MISSING_VARS+=("CDK_DEFAULT_ACCOUNT or AWS_ACCOUNT_ID")
fi

if [ -z "$CDK_DEFAULT_REGION" ] && [ -z "$AWS_REGION" ]; then
    echo "⚠️  Warning: No region specified, defaulting to us-east-1"
    export CDK_DEFAULT_REGION=us-east-1
fi

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo "❌ Error: Missing required environment variables:"
    printf '   - %s\n' "${MISSING_VARS[@]}"
    echo ""
    echo "💡 Solution: Set environment variables or update .env file:"
    echo "   # Edit .env with your values"
    echo "   nano .env"
    echo "   source .env"
    echo "   ./deploy.sh"
    exit 1
fi

echo "✅ Environment variables validated"
echo "   Account: ${CDK_DEFAULT_ACCOUNT:-$AWS_ACCOUNT_ID}"
echo "   Region: ${CDK_DEFAULT_REGION:-$AWS_REGION}"
echo "   Repository: $GITHUB_REPOSITORY"
echo "   Email: $NOTIFICATION_EMAIL"
echo ""

# =============================================================================
# STEP 2: TypeScript Build
# =============================================================================
echo "🔨 Step 2: Building TypeScript Code"
echo "===================================="
echo ""
echo "ℹ️  Code quality is enforced at commit time via pre-commit hooks"
echo "   - ESLint validation runs before every commit"
echo "   - Deployment focuses on build and template validation"
echo ""

# Build TypeScript code
echo "🔧 Compiling TypeScript files..."
if ! npm run build; then
    echo "❌ ERROR: TypeScript compilation failed"
    echo "   Check the output above for compilation errors"
    echo "   Fix TypeScript errors and re-run deployment"
    exit 1
fi

echo "✅ TypeScript compilation successful"
echo ""

# =============================================================================
# STEP 3: CDK Template Validation
# =============================================================================
echo "📋 Step 3: Validating CDK Templates"
echo "===================================="
echo ""

# Run CDK synth to validate CloudFormation templates
echo "🔍 Validating CDK templates and CloudFormation syntax..."
if ! cdk synth > /dev/null; then
    echo "❌ ERROR: CDK synthesis failed"
    echo "   Check CDK code and template syntax"
    exit 1
fi

echo "✅ CDK template validation successful"
echo ""

# =============================================================================
# STEP 4: Deployment
# =============================================================================
echo "🚀 Step 4: Deploying CDK Stack"
echo "==============================="
echo ""
echo "✅ All validation checks passed:"
echo "   ✅ Environment variables validated"
echo "   ✅ TypeScript compilation successful"
echo "   ✅ CDK template validation successful"
echo ""
echo "Proceeding with deployment..."
echo ""

# Deploy with auto-approval (following project rules)
if ! cdk deploy --require-approval never; then
    echo "❌ ERROR: CDK deployment failed"
    echo "   Check AWS credentials and permissions"
    exit 1
fi

echo "✅ Deployment completed successfully!"
echo ""

# =============================================================================
# STEP 5: Post-deployment Information
# =============================================================================
echo "📋 Step 5: Post-deployment information..."

# Get stack outputs
echo "🔗 Important URLs and Information:"
echo ""

# Extract webhook URL from CDK outputs
WEBHOOK_URL=$(aws cloudformation describe-stacks \
    --stack-name GitHubMonitorStack \
    --query 'Stacks[0].Outputs[?OutputKey==`WebhookUrl`].OutputValue' \
    --output text 2>/dev/null || echo "Unable to retrieve")

if [ "$WEBHOOK_URL" != "Unable to retrieve" ] && [ "$WEBHOOK_URL" != "" ]; then
    echo "🎯 GitHub Webhook URL:"
    echo "   $WEBHOOK_URL"
    echo ""
    echo "📝 Next Steps:"
    echo "   1. Go to: https://github.com/$GITHUB_REPOSITORY/settings/hooks"
    echo "   2. Add webhook with URL: $WEBHOOK_URL"
    echo "   3. Set Content type: application/json"
    echo "   4. Select 'Just the push event'"
    echo "   5. Ensure webhook is Active"
    echo ""
    echo "📧 Email Confirmation:"
    echo "   Check $NOTIFICATION_EMAIL for SNS subscription confirmation"
    echo "   Click the confirmation link to receive notifications"
    echo ""
else
    echo "⚠️  Could not retrieve webhook URL automatically"
    echo "   Run: cdk deploy --outputs-file outputs.json"
    echo "   Check outputs.json for WebhookUrl"
fi

echo "🎉 Deployment completed successfully!"
echo ""
echo "📊 Deployment Summary:"
echo "   ✅ TypeScript compilation: PASSED"
echo "   ✅ CDK template validation: PASSED"
echo "   ✅ AWS deployment: SUCCESSFUL"
echo ""
echo "🔍 Monitoring:"
echo "   Monitor CloudWatch logs for webhook activity"
echo "   Test by making a commit to $GITHUB_REPOSITORY"
echo ""
echo "💡 Code Quality:"
echo "   ESLint validation enforced at commit time via pre-commit hooks"
echo "   Use 'npm run lint' to check code quality anytime"
echo "   Use 'npm run lint:fix' to auto-fix issues"
echo ""
