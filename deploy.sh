
# @azarboon: cdk asset bundling happens several times. try to minimize them 

# @azarboon: remove outdated or unnecessary comments and codes
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
# STEP 0: Load Environment Variables
# =============================================================================
echo "📋 Step 0: Loading environment variables from .env file..."

if [ -f ".env" ]; then
    echo "✅ Found .env file, loading variables..."
    # Export variables from .env file (skip comments and empty lines)
    export $(grep -v '^#' .env | grep -v '^$' | xargs)
    echo "✅ Environment variables loaded from .env"
else
    echo "⚠️  Warning: .env file not found, using existing environment variables"
fi
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
# STEP 2: CDK Bootstrap
# =============================================================================
echo "🔧 Step 2: CDK Bootstrap"
echo "========================"
echo ""

# Bootstrap CDK environment (automatically skips if already bootstrapped)
echo "🔍 Bootstrapping CDK environment..."
echo "   Account: ${CDK_DEFAULT_ACCOUNT:-$AWS_ACCOUNT_ID}"
echo "   Region: ${CDK_DEFAULT_REGION:-$AWS_REGION}"
echo ""

if ! cdk bootstrap; then
    echo "❌ ERROR: CDK bootstrap failed"
    echo "   Check AWS credentials and permissions"
    echo "   Ensure you have sufficient permissions to create CDK bootstrap resources"
    exit 1
fi

echo "✅ CDK bootstrap completed"
echo ""
# =============================================================================
# STEP 3: Build + CDK Synth
# =============================================================================
echo "🔨 Step 3: Building and Synthesizing Once"
echo "=========================================="
echo ""

# Compile TypeScript
echo "🔧 Compiling TypeScript files..."
if ! npm run build; then
    echo "❌ ERROR: TypeScript compilation failed"
    exit 1
fi
echo "✅ TypeScript compilation successful"

# Run CDK synth (generates templates and triggers bundling once)
echo "🔍 Synthesizing CDK app..."
if ! npm run synth:out; then
    echo "❌ ERROR: CDK synthesis failed"
    exit 1
fi
echo "✅ CDK synthesis successful"
echo ""

# =============================================================================
# STEP 4: Deployment (No Additional Bundling)
# =============================================================================
echo "🚀 Step 4: Deploying from Synthesized Output"
echo "============================================"
echo ""

if ! cdk deploy --app cdk.out --require-approval never; then
    echo "❌ ERROR: CDK deployment failed"
    exit 1
fi

echo "✅ Deployment completed successfully"
echo ""


# =============================================================================
# STEP 5: Post-deployment Information
# =============================================================================
echo "📋 Step 6: Post-deployment information..."

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
echo "   ✅ CDK environment bootstrap: VERIFIED"
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
