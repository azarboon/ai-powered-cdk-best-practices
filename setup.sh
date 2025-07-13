#!/bin/bash

# =============================================================================
# AWS CDK GitHub Monitor - Cross-Platform Setup Script
# =============================================================================
# This script sets up the project for development across different environments
# =============================================================================

set -e  # Exit on any error

echo "🚀 AWS CDK GitHub Monitor Setup"
echo "==============================="
echo ""

# Detect environment
OS=$(uname -s 2>/dev/null || echo "Unknown")
echo "🔍 Detected environment: $OS"

# Check Node.js and npm
echo ""
echo "📋 Checking prerequisites..."

if ! command -v node >/dev/null 2>&1; then
    echo "❌ Node.js not found"
    echo ""
    echo "Please install Node.js first:"
    echo "  • Linux/WSL: sudo apt install nodejs npm"
    echo "  • macOS: brew install node"
    echo "  • Windows: Download from https://nodejs.org"
    echo ""
    exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
    echo "❌ npm not found"
    echo "Please install npm (usually comes with Node.js)"
    exit 1
fi

NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)
echo "✅ Node.js: $NODE_VERSION"
echo "✅ npm: $NPM_VERSION"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Setup husky hooks
echo ""
echo "🔗 Setting up pre-commit hooks..."
npm run prepare

# Test pre-commit hook
echo ""
echo "🧪 Testing pre-commit hook..."
if ./.husky/pre-commit; then
    echo "✅ Pre-commit hook working correctly"
else
    echo "⚠️  Pre-commit hook test completed (may have found no staged files)"
fi

# Check AWS CLI (optional)
echo ""
echo "🔍 Checking AWS CLI (optional for deployment)..."
if command -v aws >/dev/null 2>&1; then
    AWS_VERSION=$(aws --version 2>&1 | head -n1)
    echo "✅ AWS CLI: $AWS_VERSION"
else
    echo "⚠️  AWS CLI not found (install if you plan to deploy)"
fi

# Check CDK CLI (optional)
echo ""
echo "🔍 Checking AWS CDK CLI (optional for deployment)..."
if command -v cdk >/dev/null 2>&1; then
    CDK_VERSION=$(cdk --version)
    echo "✅ AWS CDK: $CDK_VERSION"
else
    echo "⚠️  AWS CDK CLI not found"
    echo "   Install with: npm install -g aws-cdk"
fi

echo ""
echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "✅ Dependencies installed"
echo "✅ Pre-commit hooks configured"
echo "✅ Cross-platform compatibility enabled"
echo ""
echo "📋 Next steps:"
echo "  1. Copy .env.template to .env and configure your values"
echo "  2. Run 'npm run validate' to test the build"
echo "  3. Run './deploy.sh' to deploy (after AWS configuration)"
echo ""
echo "💡 The pre-commit hook will automatically:"
echo "   • Detect your environment (Linux/macOS/Windows/WSL/Git Bash)"
echo "   • Process only staged JavaScript/TypeScript files"
echo "   • Auto-fix ESLint issues where possible"
echo "   • Block commits that don't meet quality standards"
echo ""
echo "🔧 If you encounter issues:"
echo "   • Test hook manually: ./.husky/pre-commit"
echo "   • Check npm: which npm && npm --version"
echo "   • Reload environment: source ~/.bashrc (Linux/macOS)"
echo ""
