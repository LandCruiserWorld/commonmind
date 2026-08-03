/**
 * Context configuration.
 * Loads env vars with safe defaults. Secrets come from the environment,
 * never from source control (see .env.example).
 */

export interface Config {
  dbUrl: string;
  apiToken: string;
  embedProvider: 'local' | 'bedrock';
  awsRegion?: string;
  bedrockEmbedModelId?: string;
  snsTopicArn?: string;
}

const required = (name: string, fallback?: string): string => {
  const v = process.env[name];
  if (v && v.trim().length > 0) return v;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required env var: ${name}`);
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    dbUrl: required('COCKROACH_DB_URL', 'postgresql://root@127.0.0.1:26257/cortex?sslmode=disable'),
    apiToken: required('CORTEX_API_TOKEN', 'dev'),
    embedProvider: (env.EMBED_PROVIDER === 'bedrock' ? 'bedrock' : 'local') as Config['embedProvider'],
    awsRegion: env.AWS_REGION ?? 'us-east-1',
    bedrockEmbedModelId: env.BEDROCK_EMBED_MODEL_ID ?? 'amazon.titan-embed-text-v2:0',
    snsTopicArn: env.CORTEX_SNS_TOPIC_ARN ?? '',
  };
}