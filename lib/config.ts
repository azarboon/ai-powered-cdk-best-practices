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
  GITHUB_REPOSITORY: string;
  GITHUB_WEBHOOK_SECRET: string;
  NOTIFICATION_EMAIL: string;
  tags: {
    ENVIRONMENT: string;
    SERVICE: string;
    TEAM: string;
    COST_CENTER: string;
  };
};

export function buildConfigFromEnv(env: Record<string, string | undefined>): AppConfig {
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
    tags: {
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

export type StandardTags = {
  ENVIRONMENT: string;
  SERVICE: string;
  TEAM: string;
  COST_CENTER: string;
};
