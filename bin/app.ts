#!/usr/bin/env node

/**
 * GitHub Monitor CDK App - Built with AWS Solutions Constructs.
 *
 * Architecture: API Gateway → Lambda → SNS
 * Uses: @aws-solutions-constructs/aws-apigateway-lambda + @aws-solutions-constructs/aws-lambda-sns
 *
 * This application monitors GitHub repository commits and sends email notifications
 * with git diff details via SNS. It uses AWS Solutions Constructs for vetted
 * architecture patterns with built-in security and best practices.
 */

import 'source-map-support/register';
import { App, Aspects } from 'aws-cdk-lib';
import { GitHubMonitorStack } from '../lib/github-monitor-stack';
import { AwsSolutionsChecks } from 'cdk-nag';

const app = new App();

// Require CDK_STACK_NAME environment variable
const stackName = process.env.CDK_STACK_NAME;
if (!stackName) {
  throw new Error('CDK_STACK_NAME environment variable is required');
}

new GitHubMonitorStack(app, stackName, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  },
});

console.log('🔍 Running CDK Nag against AWS Solutions rules...');
Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
