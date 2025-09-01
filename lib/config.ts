export const ENVIRONMENTS = {
  DEV: 'DEV',
  TEST: 'TEST',
  PROD: 'PROD',
} as const;

export function getEnvironment() {
  return process.env.ENVIRONMENT;
}

export function isEnvironment(env: string) {
  return getEnvironment() === env;
}

export function validateEnvironment() {
  const env = getEnvironment();
  if (!env || !Object.values(ENVIRONMENTS).includes(env as any)) {
    throw new Error(
      `Invalid ENVIRONMENT: ${env}. Must be one of: ${Object.values(ENVIRONMENTS).join(', ')}`
    );
  }
}
