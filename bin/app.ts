#!/usr/bin/env node

/**
 * GitHub Repository Monitor CDK Application Entry Point
 * 
 * Purpose: Initializes and deploys the GitHub monitoring infrastructure
 * 
 * Configuration:
 * - Uses environment variables for account ID and region
 * - Follows AWS CDK best practices for configuration management
 * - Stack Name: GitHubMonitorStack
 * 
 * Security:
 * - No hardcoded credentials or account IDs
 * - Uses AWS CLI/environment credentials
 * - Environment variable validation for required values
 * - Minimal configuration approach following best practices
 * 
 * Environment Variables Required:
 * - CDK_DEFAULT_ACCOUNT or AWS_ACCOUNT_ID: Target AWS account ID
 * - CDK_DEFAULT_REGION or AWS_REGION: Target AWS region (default: us-east-1)
 */

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { GitHubMonitorStack } from '../lib/github-monitor-stack';

// Initialize CDK application
const app = new cdk.App();

/**
 * Environment Configuration
 * 
 * Retrieves configuration from environment variables following AWS CDK best practices:
 * - CDK_DEFAULT_ACCOUNT or AWS_ACCOUNT_ID for account targeting
 * - CDK_DEFAULT_REGION or AWS_REGION for region selection
 * - Defaults to us-east-1 for optimal GitHub webhook performance
 */
const account = process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID;
const region = process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || 'us-east-1';

// Validate required environment variables
if (!account) {
  throw new Error('AWS account ID must be provided via CDK_DEFAULT_ACCOUNT or AWS_ACCOUNT_ID environment variable');
}

/**
 * Deploy GitHub Monitor Stack
 * 
 * Environment Configuration:
 * - Account: Retrieved from environment variables for security
 * - Region: Retrieved from environment variables (default: us-east-1)
 * - Tags: Applied for cost tracking and resource management
 * 
 * Description: Provides context for CloudFormation stack
 */
new GitHubMonitorStack(app, 'GitHubMonitorStack', {
  env: {
    account: account,
    region: region,
  },
  description: 'Monitor GitHub repository commits and send git diff notifications via SNS',
  tags: {
    Environment: process.env.ENVIRONMENT || 'dev',
    Project: 'GitHubMonitor',
    ManagedBy: 'CDK'
  }
});
