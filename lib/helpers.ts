import { Environments, StandardTags } from './config';
import { Tags } from 'aws-cdk-lib';
import { IConstruct } from 'constructs';
import * as dotenv from 'dotenv';

export function applyTags(scope: IConstruct, tags: StandardTags) {
  for (const [k, v] of Object.entries(tags)) {
    Tags.of(scope).add(k, v);
  }
}

export function validateEnvVars() {
  const envConfig = dotenv.config({ path: '.env' });

  if (envConfig.error || !envConfig.parsed) {
    throw new Error('Could not load .env file');
  }

  const requiredTags = Object.keys(envConfig.parsed);
  const missingTags = requiredTags.filter(key => !process.env[key]);

  if (missingTags.length) {
    throw new Error(`Missing required environment variables: ${missingTags.join(', ')}`);
  }

  if (!process.env.GITHUB_REPOSITORY?.includes('/')) {
    throw new Error('GITHUB_REPOSITORY must be in format "owner/repo"');
  }
  if (!process.env.NOTIFICATION_EMAIL?.includes('@')) {
    throw new Error('NOTIFICATION_EMAIL must be a valid email');
  }

  // Validates that the ENVIRONMENT value is one of the allowed options
  const env = process.env.ENVIRONMENT;
  if (!env || !Object.values(Environments).includes(env as any)) {
    throw new Error(
      `Invalid ENVIRONMENT value: ${env}. Must be one of: ${Object.values(Environments).join(', ')}`
    );
  }
}

export function isEnvironment(env: string) {
  return process.env.ENVIRONMENT === env;
}
