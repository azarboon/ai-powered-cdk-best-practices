export const Environments = {
  DEV: 'DEV',
  TEST: 'TEST',
  PROD: 'PROD',
} as const;

export type StandardTags = {
  ENVIRONMENT: string;
  SERVICE: string;
  TEAM: string;
  COST_CENTER: string;
};
