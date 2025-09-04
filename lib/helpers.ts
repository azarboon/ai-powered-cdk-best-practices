import { StandardTags, AppConfig } from './config';
import { Tags } from 'aws-cdk-lib';
import { IConstruct } from 'constructs';

export function applyTags(scope: IConstruct, tags: StandardTags) {
  for (const [k, v] of Object.entries(tags)) {
    Tags.of(scope).add(k, v);
  }
}

export function isEnvironment(env: string, appConfig: AppConfig) {
  return appConfig.ENVIRONMENT === env;
}
