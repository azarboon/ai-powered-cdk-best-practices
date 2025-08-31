#!/usr/bin/env node

/**
 * GitHub Monitor CDK App
 *
 * This application monitors GitHub repository commits and sends email notifications
 * with git diff details via SNS.
 */

import 'source-map-support/register';
import { App, Aspects } from 'aws-cdk-lib';
import { GitHubMonitorStack } from '../lib/github-monitor-stack';
import { AwsSolutionsChecks } from 'cdk-nag';
import { applyTags, validateEnvVars } from '../lib/helpers';

validateEnvVars();

const app = new App();

// Apply centralized tagging to entire CDK application
applyTags(app, {
  Environment: process.env.ENVIRONMENT!,
  Service: process.env.SERVICE!,
  Team: process.env.TEAM!,
  CostCenter: process.env.COST_CENTER!,
  Project: process.env.CDK_STACK_NAME!,
});

new GitHubMonitorStack(app, process.env.CDK_STACK_NAME!, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  },
});

console.log('🔍 Running CDK Nag against AWS Solutions rules...');
Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
