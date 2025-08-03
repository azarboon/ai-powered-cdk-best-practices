#!/usr/bin/env node

/**
 * GitHub Monitor CDK App.
 *
 * Deploys: API Gateway → Lambda → SNS
 */

import 'source-map-support/register';
import { App, Aspects } from 'aws-cdk-lib';
import { GitHubMonitorStack } from '../lib/github-monitor-stack';
import { AwsSolutionsChecks } from 'cdk-nag';

const app = new App();
new GitHubMonitorStack(app, 'GitHubMonitorStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
});

// Simple rule informational messages using the AWS Solutions Rule pack
Aspects.of(app).add(new AwsSolutionsChecks());
