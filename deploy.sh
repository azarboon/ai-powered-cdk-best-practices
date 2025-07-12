#!/bin/bash

# =============================================================================
# GitHub Monitor CDK Application - Deployment Script
# =============================================================================
# 
# Purpose: Automated deployment following project rules and best practices
# 
# This script:
# 1. Validates environment variables
# 2. Runs ESLint validation
# 3. Builds TypeScript code
# 4. Runs CDK synth for validation
# 5. Deploys the stack
# 6. Displays important outputs
#
# Usage: ./deploy.sh
# Prerequisites: Environment variables must be set (see .env.template)
#
# =============================================================================

set -e  # Exit on any error

echo "🚀 GitHub Monitor CDK Deployment Script"
echo "========================================"

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
    echo "💡 Solution: Set environment variables or use .env file:"
    echo "   cp .env.template .env"
    echo "   # Edit .env with your values"
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
# STEP 2: Code Quality Validation
# =============================================================================
echo "🔍 Step 2: Running code quality checks..."

# Check if ESLint dependencies are installed
if ! npm list eslint &> /dev/null; then
    echo "📦 Installing ESLint dependencies..."
    npm install
fi

# Run ESLint validation
echo "   Running ESLint..."
npm run lint

echo "✅ Code quality checks passed"
echo ""

# =============================================================================
# STEP 3: Build and Validation
# =============================================================================
echo "🔨 Step 3: Building and validating CDK code..."

# Build TypeScript code
echo "   Building TypeScript..."
npm run build

# Run CDK synth to validate CloudFormation templates
echo "   Validating CDK templates..."
cdk synth > /dev/null

echo "✅ Build and validation completed"
echo ""

# =============================================================================
# STEP 4: Deployment
# =============================================================================
echo "🚀 Step 4: Deploying CDK stack..."

# Deploy with auto-approval (following project rules)
cdk deploy --require-approval never

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
echo "   Monitor CloudWatch logs for webhook activity"
echo "   Test by making a commit to $GITHUB_REPOSITORY"
echo ""
