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
import { App, Aspects, Tags } from 'aws-cdk-lib';
import { GitHubMonitorStack } from '../lib/github-monitor-stack';
import { AwsSolutionsChecks } from 'cdk-nag';

/**
 * Validate required environment variables for deployment and tagging
 */
const validateEnvironment = (): void => {
  const required = ['CDK_STACK_NAME', 'ENVIRONMENT', 'SERVICE', 'TEAM', 'COST_CENTER'];

  const missing = required.filter(key => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

// Validate environment variables before creating app
validateEnvironment();

const app = new App();

// Get required environment variables
const stackName = process.env.CDK_STACK_NAME!;

// Apply centralized tagging to entire CDK application
Tags.of(app).add('Environment', process.env.ENVIRONMENT!);
Tags.of(app).add('Service', process.env.SERVICE!);
Tags.of(app).add('Team', process.env.TEAM!);
Tags.of(app).add('CostCenter', process.env.COST_CENTER!);
Tags.of(app).add('Project', stackName);

new GitHubMonitorStack(app, stackName, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  },
});

console.log('🔍 Running CDK Nag against AWS Solutions rules...');
Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
