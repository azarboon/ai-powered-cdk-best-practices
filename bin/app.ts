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
  ENVIRONMENT: process.env.ENVIRONMENT!,
  SERVICE: process.env.SERVICE!,
  TEAM: process.env.TEAM!,
  COST_CENTER: process.env.COST_CENTER!,
});

new GitHubMonitorStack(app, process.env.STACK_NAME!, {
  env: {
    account: process.env.AWS_ACCOUNT_ID,
    region: process.env.AWS_REGION ?? 'us-east-1',
  },
});

console.log('🔍 Running CDK Nag against AWS Solutions rules...');
Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
