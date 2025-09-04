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
import { buildConfigFromEnv } from '../lib/config';
import { applyTags } from '../lib/helpers';

const app = new App();

const appConfig = buildConfigFromEnv(process.env);

applyTags(app, appConfig.tags);

new GitHubMonitorStack(app, appConfig.STACK_NAME, {
  env: { account: appConfig.AWS_ACCOUNT_ID, region: appConfig.AWS_REGION },
  appConfig,
});

console.log('🔍 Running CDK Nag against AWS Solutions rules...');
Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
