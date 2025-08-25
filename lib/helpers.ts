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
