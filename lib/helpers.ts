import { Tags } from 'aws-cdk-lib';
import { IConstruct } from 'constructs';

export type StandardTags = {
  Environment: string;
  Service: string;
  Team: string;
  CostCenter: string;
  Project: string;
};

export function applyTags(scope: IConstruct, tags: StandardTags) {
  for (const [k, v] of Object.entries(tags)) {
    Tags.of(scope).add(k, v);
  }
}

export function validateEnvVars() {
  const required = [
    'CDK_STACK_NAME',
    'CDK_DEFAULT_ACCOUNT',
    'CDK_DEFAULT_REGION',
    'GITHUB_WEBHOOK_SECRET',
    'GITHUB_REPOSITORY',
    'GITHUB_API_BASE',
    'NOTIFICATION_EMAIL',
    'ENVIRONMENT',
    'SERVICE',
    'TEAM',
    'COST_CENTER',
  ];

  const missing = required.filter(key => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
