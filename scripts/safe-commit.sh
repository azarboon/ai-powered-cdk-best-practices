#!/bin/bash

# =============================================================================
# Safe Commit Script - Prevents ESLint Bypass
# =============================================================================
# 
# This script ensures that commits always go through proper ESLint validation
# and prevents the use of --no-verify or other bypass methods.
#
# Usage: ./scripts/safe-commit.sh "commit message"
#
# =============================================================================

set -e

if [ $# -eq 0 ]; then
    echo "❌ ERROR: Commit message required"
    echo "Usage: ./scripts/safe-commit.sh \"commit message\""
    exit 1
fi

COMMIT_MESSAGE="$1"

echo "🛡️  SAFE COMMIT PROCESS"
echo "======================"
echo ""
echo "Commit message: $COMMIT_MESSAGE"
echo ""

# Step 1: Run ESLint validation first
echo "🔍 Step 1: Running ESLint validation..."
if ! npm run lint; then
    echo ""
    echo "❌ COMMIT BLOCKED: ESLint validation failed"
    echo ""
    echo "Required actions:"
    echo "1. Run 'npm run lint:fix' to auto-fix issues"
    echo "2. Manually fix any remaining ESLint errors"
    echo "3. Re-run this script"
    echo ""
    exit 1
fi

echo "✅ ESLint validation passed"
echo ""

# Step 2: Check if there are changes to commit
if git diff --cached --quiet; then
    echo "❌ ERROR: No staged changes to commit"
    echo "Run 'git add .' to stage your changes first"
    exit 1
fi

echo "📋 Staged changes detected"
echo ""

# Step 3: Test pre-commit hook
echo "🔍 Step 2: Testing pre-commit hook..."
if [ ! -f ".husky/pre-commit" ]; then
    echo "❌ ERROR: Pre-commit hook missing"
    exit 1
fi

echo "✅ Pre-commit hook exists"
echo ""

# Step 4: Perform the commit (with pre-commit hook validation)
echo "🚀 Step 3: Performing commit with ESLint validation..."
echo "Note: Pre-commit hook will run ESLint validation again"
echo ""

if ! git commit -m "$COMMIT_MESSAGE"; then
    echo ""
    echo "❌ COMMIT FAILED: Pre-commit validation failed"
    echo ""
    echo "This is the expected behavior when code doesn't meet quality standards."
    echo "Please fix the issues and try again."
    echo ""
    exit 1
fi

echo ""
echo "✅ COMMIT SUCCESSFUL!"
echo "==================="
echo "✅ ESLint validation passed"
echo "✅ Pre-commit hook validation passed"
echo "✅ Code quality standards maintained"
echo ""
echo "Your commit has been made safely without bypassing any validation."
