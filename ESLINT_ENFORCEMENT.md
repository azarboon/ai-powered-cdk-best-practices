# ESLint Enforcement Policy - Current Implementation

**Last Updated**: 2025-01-13  
**Status**: ACTIVE - Commit-Time Enforcement Only  
**Version**: 2.0 (Updated for commit-time only enforcement)

## 🎯 **Current Enforcement Strategy**

### **✅ COMMIT-TIME ENFORCEMENT (MANDATORY)**
ESLint validation is **ONLY** enforced before commits, **NOT** before deployments.

- **When**: Before every `git commit`
- **Scope**: All JavaScript and TypeScript files in `bin/`, `lib/`, `lambda/`
- **Tolerance**: Zero warnings, zero errors
- **Blocking**: Commits are blocked if ESLint fails
- **Auto-fix**: Attempted automatically during pre-commit

### **🚀 DEPLOYMENT-TIME (NO ENFORCEMENT)**
Deployments focus on build and template validation for faster cycles.

- **When**: During `npm run deploy` or `./deploy.sh`
- **Scope**: TypeScript compilation + CDK template validation only
- **ESLint**: **NOT ENFORCED** during deployment
- **Purpose**: Fast deployment cycles for testing and iteration

## 📋 **Current ESLint Configuration**

### **JavaScript Files** (`lambda/*.js`)
- **Parser**: Default ESLint parser
- **Environment**: Node.js, ES2021
- **Base Rules**: `eslint:recommended`
- **Plugins**: `jsdoc` for documentation enforcement
- **Key Rules**:
  - Indentation: 2 spaces
  - Quotes: Single quotes
  - Semicolons: Required
  - JSDoc: Required for all functions
  - Complete sentences in comments
  - Parameter and return documentation required

### **TypeScript Files** (`bin/*.ts`, `lib/*.ts`)
- **Parser**: `@typescript-eslint/parser`
- **Base Rules**: `@typescript-eslint/recommended`
- **Additional Rules**:
  - Explicit function return types required
  - Explicit module boundary types required
  - No `any` type allowed
  - Prefer readonly properties
  - Prefer nullish coalescing (`??`)
  - Prefer optional chaining (`?.`)
  - No non-null assertions (`!`)

## 🔧 **Available Commands**

### **Manual ESLint Commands**
```bash
npm run lint           # Check all files for issues
npm run lint:fix       # Auto-fix issues where possible
npm run lint:check     # Fix + validate (used by pre-commit)
```

### **Development Commands**
```bash
npm run build          # TypeScript compilation only
npm run validate       # Build + CDK synth (no linting)
npm run deploy         # Build + deploy (no linting)
npm run precommit      # ESLint validation (used by pre-commit hook)
```

## 🚨 **Pre-Commit Hook Implementation**

### **Location**: `.husky/pre-commit`
### **Behavior**:
1. Runs `npm run precommit` (which runs `npm run lint:check`)
2. Attempts auto-fix with `eslint --fix`
3. Validates all files with zero tolerance
4. Blocks commit if any issues remain
5. Provides helpful error messages and fix suggestions

### **Bypass** (Emergency Only):
```bash
git commit -m "message" --no-verify
```

## 📁 **Files Validated**

### **Included**:
- `bin/**/*.ts` - CDK application entry points
- `lib/**/*.ts` - CDK stack definitions and constructs
- `lambda/**/*.js` - Lambda function implementations

### **Excluded**:
- `node_modules/` - Third-party dependencies
- `cdk.out/` - CDK synthesis output
- `*.d.ts` - TypeScript declaration files
- `bin/*.js`, `lib/*.js` - Compiled JavaScript files
- `awscliv2.zip`, `aws/` - AWS CLI artifacts

## 🎯 **Quality Standards Enforced**

### **Documentation Requirements**:
- All functions must have JSDoc comments
- Comments must be complete sentences ending with periods
- All parameters must be documented with descriptions
- All return values must be documented with descriptions
- Function descriptions must explain purpose clearly

### **TypeScript Requirements**:
- Explicit return types for all functions
- No use of `any` type
- Proper null/undefined handling with nullish coalescing
- Use of optional chaining where appropriate
- No non-null assertions without justification

### **Code Style Requirements**:
- 2-space indentation
- Single quotes for strings
- Semicolons required
- No unused variables (except those prefixed with `_`)
- Prefer `const` over `let`, never use `var`

## 🔄 **Developer Workflow**

### **Recommended Development Flow**:
1. Write code with proper JSDoc comments
2. Run `npm run lint:fix` to auto-fix issues
3. Run `npm run lint` to verify compliance
4. Commit changes (pre-commit hook validates automatically)
5. Deploy with `npm run deploy` (fast, no linting)

### **If Pre-Commit Fails**:
1. Review ESLint errors in terminal output
2. Run `npm run lint:fix` to auto-fix what's possible
3. Manually fix remaining issues
4. Ensure all functions have proper JSDoc comments
5. Retry commit

## 📊 **Enforcement Statistics**

- **Enforcement Point**: Pre-commit hooks only
- **Files Validated**: JavaScript and TypeScript in specified directories
- **Rules Enforced**: 40+ ESLint rules + TypeScript-specific rules
- **Auto-fix Capability**: ~70% of common issues
- **Zero Tolerance**: No warnings or errors allowed
- **Bypass Available**: Yes, with `--no-verify` (emergency use only)

## 🔧 **Configuration Files**

- **Main Config**: `.eslintrc.json`
- **TypeScript Config**: `tsconfig.json` (referenced by ESLint)
- **Package Scripts**: `package.json` (lint commands)
- **Pre-commit Hook**: `.husky/pre-commit`
- **Lint-staged Config**: `package.json` (lint-staged section)

## 📝 **Recent Changes**

### **Version 2.0 Changes** (2025-01-13):
- **REMOVED**: ESLint enforcement from deployment process
- **MAINTAINED**: ESLint enforcement at commit time
- **IMPROVED**: Faster deployment cycles
- **UPDATED**: Documentation to reflect commit-time only enforcement
- **ENHANCED**: Pre-commit hook robustness for WSL environments

### **Rationale**:
- Separate code quality concerns from deployment speed
- Maintain high code quality standards through commit-time enforcement
- Enable rapid iteration and testing through fast deployments
- Preserve developer experience while ensuring code quality

---

**Note**: This document is automatically updated to reflect the current ESLint configuration and enforcement policies. Any changes to ESLint rules, enforcement timing, or configuration must be reflected in this document before commit.
