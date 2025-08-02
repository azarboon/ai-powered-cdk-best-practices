#!/usr/bin/env node

/**
 * GitHub Monitor CDK App.
 *
 * Deploys: API Gateway → Lambda → SNS
 */

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { GitHubMonitorStack } from '../lib/github-monitor-stack';

const app = new cdk.App();

new GitHubMonitorStack(app, 'GitHubMonitorStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
});
