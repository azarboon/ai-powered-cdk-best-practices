#!/usr/bin/env node

/**
 * GitHub Repository Monitor CDK Application Entry Point
 * 
 * Purpose: Initializes and deploys the GitHub monitoring infrastructure
 * 
 * Configuration:
 * - Target Account: 381492315817 (hardcoded for security)
 * - Target Region: us-east-1 (GitHub webhook optimal region)
 * - Stack Name: GitHubMonitorStack
 * 
 * Security:
 * - No credentials in code (uses AWS CLI/environment credentials)
 * - Specific account targeting prevents accidental deployments
 * - Minimal configuration approach
 */

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { GitHubMonitorStack } from '../lib/github-monitor-stack';

// Initialize CDK application
const app = new cdk.App();

/**
 * Deploy GitHub Monitor Stack
 * 
 * Environment Configuration:
 * - Account: Specific account ID for security
 * - Region: us-east-1 for optimal GitHub webhook performance
 * 
 * Description: Provides context for CloudFormation stack
 */
new GitHubMonitorStack(app, 'GitHubMonitorStack', {
  env: {
    account: '381492315817',
    region: 'us-east-1',
  },
  description: 'Monitor GitHub repository commits and read README file'
});
