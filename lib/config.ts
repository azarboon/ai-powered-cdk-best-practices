export const Environments = {
  DEV: 'DEV',
  TEST: 'TEST',
  PROD: 'PROD',
} as const;

export type AppConfig = {
  AWS_ACCOUNT_ID: string;
  AWS_REGION: string;
  ENVIRONMENT: string;
  STACK_NAME: string;
  REPOSITORY: string;
  WEBHOOK_SECRET: string;
  NOTIFICATION_EMAIL: string;
  TAGS: {
    ENVIRONMENT: string;
    SERVICE: string;
    TEAM: string;
    COST_CENTER: string;
  };
};
