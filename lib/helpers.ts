import { AppConfig } from './config';
import { Tags } from 'aws-cdk-lib';
import { IConstruct } from 'constructs';

export function applyTags(scope: IConstruct, tags: AppConfig['TAGS']) {
  for (const [k, v] of Object.entries(tags)) {
    Tags.of(scope).add(k, v);
  }
}

export function isEnvironment(env: string, appConfig: AppConfig) {
  return appConfig.ENVIRONMENT === env;
}

export function buildConfig(env: Record<string, string | undefined>): AppConfig {
  if (!env) throw new Error('process.env object is invalid');

  const errors: string[] = [];

  const getValueOf = (key: string) => {
    const v = env[key];
    if (!v) errors.push(`Missing ${key}`);
    return v || '';
  };

  const config: AppConfig = {
    AWS_ACCOUNT_ID: getValueOf('AWS_ACCOUNT_ID'),
    AWS_REGION: getValueOf('AWS_REGION'),
    ENVIRONMENT: getValueOf('ENVIRONMENT'),
    STACK_NAME: getValueOf('STACK_NAME'),
    GITHUB_REPOSITORY: getValueOf('GITHUB_REPOSITORY'),
    GITHUB_WEBHOOK_SECRET: getValueOf('GITHUB_WEBHOOK_SECRET'),
    NOTIFICATION_EMAIL: getValueOf('NOTIFICATION_EMAIL'),
    TAGS: {
      ENVIRONMENT: getValueOf('ENVIRONMENT'),
      SERVICE: getValueOf('SERVICE'),
      TEAM: getValueOf('TEAM'),
      COST_CENTER: getValueOf('COST_CENTER'),
    },
  };

  // Custom validations
  if (config.GITHUB_REPOSITORY && !config.GITHUB_REPOSITORY.includes('/')) {
    errors.push('GITHUB_REPOSITORY must be in format "owner/repo"');
  }
  if (config.NOTIFICATION_EMAIL && !config.NOTIFICATION_EMAIL.includes('@')) {
    errors.push('NOTIFICATION_EMAIL must be a valid email');
  }

  if (errors.length) throw new Error(errors.join('\n'));
  return config;
}
