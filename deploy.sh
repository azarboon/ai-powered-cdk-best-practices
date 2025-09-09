# @azarboon: remove outdated or unnecessary comments and codes


#!/bin/bash
# Exit immediately on errors, undefined variables, or failed pipelines
# Improves script safety and prevents silent failures
set -euo pipefail

# =============================================================================
# GitHub Monitor CDK Application - Deployment Script
# =============================================================================
# 
# Purpose: Automated deployment with build validation
# This script:
# 1. Validates environment variables
# 2. Builds TypeScript code
# 3. Validates CDK templates
# 4. Deploys the stack
# 5. Displays important outputs
#
# Usage: ./deploy.sh
# Prerequisites: Environment variables must be set (see .env.template)
# NOTE: ESLint validation is enforced ONLY at commit time via pre-commit hooks
# =============================================================================

echo "🚀 GitHub Monitor CDK Deployment Script"
echo "========================================"

# =============================================================================
# STEP 0: Load Environment Variables
# =============================================================================
echo "📋 Step 0: Loading environment variables from .env file..."

if [ -f ".env" ]; then
    echo "✅ Found .env file"
    # Load environment variables from .env file
    set -a  # Automatically export all variables
    source .env
    set +a  # Disable automatic export
    echo "✅ Environment variables loaded from .env file"
else
    echo "⚠️  Warning: .env file not found — deployment may fail if required environment variables are missing"
fi
echo ""

# =============================================================================
# STEP 1: Environment Validation
# =============================================================================
echo "📋 Step 1: Validating environment variables..."

# Check required environment variables
REQUIRED_VARS=(
    "AWS_ACCOUNT_ID"
    "AWS_REGION"
    "REPOSITORY" 
    "NOTIFICATION_EMAIL"
    "STACK_NAME"
    "ENVIRONMENT"
    "SERVICE"
    "TEAM"
    "COST_CENTER"
)

MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var:-}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo "❌ Error: Missing required environment variables:"
    printf '   - %s\n' "${MISSING_VARS[@]}"
    echo ""
    echo "💡 Solution: Set environment variables or update .env file:"
    echo "   # Edit .env with your values"
    exit 1
fi

echo "✅ Environment variables validated"
echo "   Account: ${AWS_ACCOUNT_ID:-}"
echo "   Region: ${AWS_REGION:-}"
echo "   Repository: ${REPOSITORY:-}"
echo "   Email: ${NOTIFICATION_EMAIL:-}"
echo "   CDK Stack name: ${STACK_NAME:-}"
echo ""

# =============================================================================
# STEP 2: Dependency Check
# =============================================================================
echo "📦 Step 2: Checking dependencies..."

# Check if node_modules exists and package-lock.json is newer than package.json
if [ ! -d "node_modules" ] || [ "package.json" -nt "package-lock.json" ] || [ ! -f "package-lock.json" ]; then
    echo "🔍 Installing/updating dependencies..."
    if ! npm install; then
        echo "❌ ERROR: npm install failed"
        exit 1
    fi
    echo "✅ Dependencies installed successfully"
else
    echo "✅ Dependencies are up-to-date, skipping npm install"
fi
echo ""

# =============================================================================
# STEP 3: CDK Bootstrap
# =============================================================================

# Bootstrap CDK environment only if not already bootstrapped
echo "🔧 Step 3: CDK Bootstrapping"
echo "========================"
echo ""

if ! aws cloudformation describe-stacks --stack-name CDKToolkit >/dev/null 2>&1; then
    echo "🔍 Bootstrapping CDK environment..."
    if ! cdk bootstrap; then
        echo "❌ ERROR: CDK bootstrap failed"
        echo "   Check AWS credentials and permissions"
        exit 1
    fi
    echo "✅ CDK bootstrap completed"
else
    echo "✅ CDK environment already bootstrapped, skipping..."
fi

echo ""

# =============================================================================
# STEP 4: Deployment
# =============================================================================
echo "🚀 Step 4: Deploying"
echo "============================================"
echo ""

if ! cdk deploy --require-approval never; then
    echo "❌ ERROR: CDK deployment failed"
    exit 1
fi

echo "✅ Deployment completed successfully"
echo ""


# =============================================================================
# STEP 5: Post-deployment Information
# =============================================================================
echo "📋 Step 5: Post-deployment information..."

# Extract webhook URL from CDK outputs
WEBHOOK_URL=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME:-} \
    --query 'Stacks[0].Outputs[?OutputKey==`WebhookUrl`].OutputValue' \
    --output text 2>/dev/null || echo "Unable to retrieve")

if [ "$WEBHOOK_URL" != "Unable to retrieve" ] && [ "$WEBHOOK_URL" != "" ]; then
    echo "🎯 GitHub Webhook URL:"
    echo "   $WEBHOOK_URL"
    echo ""
    echo "📝 Next Steps:"
    echo "   1. Go to: https://github.com/${REPOSITORY:-}/settings/hooks"
    echo "   2. Add webhook with URL: $WEBHOOK_URL"
    echo "   3. Set Content type: application/json"
    echo "   4. Select 'Just the push event'"
    echo "   5. Set 'secret' to: ${WEBHOOK_SECRET:-}"
    echo "   6. Ensure webhook is Active"
    echo ""
    echo "📧 Email Confirmation:"
    echo "   Check ${NOTIFICATION_EMAIL:-} for SNS subscription confirmation"
    echo "   Click the confirmation link to receive notifications"
    echo ""
else
    echo "⚠️  Could not retrieve webhook URL automatically"
    echo "   Run: cdk deploy --outputs-file outputs.json"
    echo "   Check outputs.json for WebhookUrl"
fi

echo "🎉 Deployment completed successfully!"
echo ""
echo "🔍 Monitoring:"
echo "   Monitor CloudWatch logs for webhook activity"
echo "   Confirm your SNS subscription in the ${NOTIFICATION_EMAIL:-} then test by making a commit to ${REPOSITORY:-}"
echo "   You will get a new email upon any new commit that shows code change"
echo ""
