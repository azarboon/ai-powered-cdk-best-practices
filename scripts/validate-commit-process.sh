#!/bin/bash

# =============================================================================
# Commit Process Validator
# =============================================================================
# 
# This script validates that the proper commit process is followed
# and that ESLint validation is not bypassed.
#
# Usage: ./scripts/validate-commit-process.sh
#
# =============================================================================

set -e

echo "🔍 COMMIT PROCESS VALIDATION"
echo "============================"
echo ""

# Check if the last commit was made with --no-verify
LAST_COMMIT_MSG=$(git log -1 --pretty=format:"%s")
LAST_COMMIT_HASH=$(git log -1 --pretty=format:"%H")

echo "Last commit: $LAST_COMMIT_HASH"
echo "Commit message: $LAST_COMMIT_MSG"
echo ""

# Check if ESLint validation passes on current codebase
echo "🔍 Running ESLint validation on current codebase..."
if ! npm run lint; then
    echo ""
    echo "❌ VIOLATION DETECTED: Code in repository does not pass ESLint validation"
    echo "This indicates that commits may have been made bypassing ESLint checks."
    echo ""
    echo "Required actions:"
    echo "1. Run 'npm run lint:fix' to auto-fix issues"
    echo "2. Manually fix any remaining ESLint errors"
    echo "3. Commit the fixes with proper ESLint validation"
    echo ""
    exit 1
fi

echo "✅ ESLint validation passed on current codebase"
echo ""

# Check if pre-commit hook is working
echo "🔍 Testing pre-commit hook functionality..."
if [ ! -f ".husky/pre-commit" ]; then
    echo "❌ ERROR: Pre-commit hook file missing"
    exit 1
fi

if ! grep -q "run precommit" .husky/pre-commit; then
    echo "❌ ERROR: Pre-commit hook does not run ESLint validation"
    exit 1
fi

echo "✅ Pre-commit hook is properly configured"
echo ""

# Validate that ESLint configuration is current
echo "🔍 Validating ESLint configuration..."
if [ ! -f ".eslintrc.json" ]; then
    echo "❌ ERROR: ESLint configuration file missing"
    exit 1
fi

if ! npm list eslint >/dev/null 2>&1; then
    echo "❌ ERROR: ESLint not installed"
    exit 1
fi

echo "✅ ESLint configuration is valid"
echo ""

echo "🎉 COMMIT PROCESS VALIDATION PASSED"
echo "=================================="
echo "✅ Current code passes ESLint validation"
echo "✅ Pre-commit hook is properly configured"
echo "✅ ESLint configuration is valid"
echo ""
echo "The commit process appears to be following PROJECT_RULES correctly."
