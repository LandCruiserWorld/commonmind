/**
 * CDC bridge — the changefeed's HTTP sink.
 *
 * CockroachDB's `webhook-https` changefeed POSTs batches of committed
 * `memory_events` rows here. Each row is republished to SNS unchanged. This
 * is the only hop between "row committed" and "push pipeline started" — no
 * application code decides to fire a push; the committed row does.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { loadConfig } from '../config.js';

/** One row of a CockroachDB `webhook-https` changefeed batch. */
export interface ChangefeedRow {
  after: Record<string, unknown> | null;
  key?: unknown;
  updated?: string;
}

export interface MemoryEventPublisher {
  publish(row: ChangefeedRow): Promise<void>;
}

/** Publishes each changed `memory_events` row to SNS, unchanged. */
export class SnsMemoryEventPublisher implements MemoryEventPublisher {
  constructor(
    private readonly client: Pick<SNSClient, 'send'>,
    private readonly topicArn: string,
  ) {}

  async publish(row: ChangefeedRow): Promise<void> {
    if (!row.after) return; // deletes / resolved-timestamp markers carry no row
    await this.client.send(new PublishCommand({
      TopicArn: this.topicArn,
      Message: JSON.stringify(row.after),
      MessageAttributes: {
        entityType: { DataType: 'String', StringValue: String(row.after.entity_type ?? 'unknown') },
        action: { DataType: 'String', StringValue: String(row.after.action ?? 'unknown') },
      },
    }));
  }
}

/** Publish every row in one changefeed batch. Returns the row count published. */
export async function handleChangefeedBatch(body: unknown, publisher: MemoryEventPublisher): Promise<number> {
  const rows = parseBatch(body);
  for (const row of rows) await publisher.publish(row);
  return rows.length;
}

function parseBatch(body: unknown): ChangefeedRow[] {
  const payload = (body as { payload?: unknown } | null)?.payload;
  if (!Array.isArray(payload)) {
    throw new Error('Malformed changefeed payload: expected { payload: [...] }');
  }
  return payload as ChangefeedRow[];
}

function requireTopicArn(): string {
  const arn = loadConfig().snsTopicArn;
  if (!arn) throw new Error('Missing COMMONMIND_SNS_TOPIC_ARN');
  return arn;
}

let defaultPublisher: MemoryEventPublisher | null = null;
function getDefaultPublisher(): MemoryEventPublisher {
  if (!defaultPublisher) {
    defaultPublisher = new SnsMemoryEventPublisher(
      new SNSClient({ region: loadConfig().awsRegion }),
      requireTopicArn(),
    );
  }
  return defaultPublisher;
}

/** AWS Lambda Function URL handler — the changefeed's `webhook-https` target. */
export const handler = async (
  event: { body?: string; isBase64Encoded?: boolean },
): Promise<{ statusCode: number; body: string }> => {
  const raw = event.body
    ? (event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body)
    : '{}';
  const published = await handleChangefeedBatch(JSON.parse(raw), getDefaultPublisher());
  return { statusCode: 200, body: JSON.stringify({ published }) };
};

/** Local dev server with the same contract as the Lambda handler, for testing without a deploy. */
export function createBridgeServer(publisher: MemoryEventPublisher = getDefaultPublisher()): Server {
  return createServer(async (request: IncomingMessage, response: ServerResponse) => {
    if (request.method !== 'POST') {
      response.writeHead(405, { Allow: 'POST' }).end();
      return;
    }
    try {
      const body = await readJson(request);
      const published = await handleChangefeedBatch(body, publisher);
      response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ published }));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Invalid request';
      response.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: message }));
    }
  });
}

export async function serveBridge(port = Number(process.env.COMMONMIND_CDC_BRIDGE_PORT ?? '3335')): Promise<void> {
  const server = createBridgeServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  console.error(`CommonMind CDC bridge listening at http://127.0.0.1:${port}/`);
  await new Promise<void>((resolve) => server.once('close', resolve));
}

function readJson(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk: string) => { body += chunk; });
    request.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    request.on('error', reject);
  });
}
