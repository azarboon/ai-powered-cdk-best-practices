import { Tags } from 'aws-cdk-lib';
import { IConstruct } from 'constructs';
import * as dotenv from 'dotenv';

export type StandardTags = {
  ENVIRONMENT: string;
  SERVICE: string;
  TEAM: string;
  COST_CENTER: string;
};

export function applyTags(scope: IConstruct, tags: StandardTags) {
  for (const [k, v] of Object.entries(tags)) {
    Tags.of(scope).add(k, v);
  }
}

export function validateAllEnvVars() {
  const envConfig = dotenv.config({ path: '.env' });

  if (envConfig.error || !envConfig.parsed) {
    throw new Error('Could not load .env file');
  }

  const requiredTags = Object.keys(envConfig.parsed);
  const missingTags = requiredTags.filter(key => !process.env[key]);

  if (missingTags.length) {
    throw new Error(`Missing required environment variables: ${missingTags.join(', ')}`);
  }
}
