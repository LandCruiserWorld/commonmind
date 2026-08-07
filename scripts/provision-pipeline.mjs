#!/usr/bin/env node
/**
 * Provisions the Friday pipeline's AWS side: SNS topic, SQS fanout queue,
 * and its DLQ, wired together. Idempotent — CreateTopic/CreateQueue return
 * the existing resource when the name (and, for SQS, attributes) already
 * match, so re-running this is safe.
 *
 * Does NOT deploy the bridge/fanout Lambdas or run CREATE CHANGEFEED — this
 * only provisions the AWS resources those steps need. Run it, then deploy
 * dist/cdc/bridge.js behind a Lambda Function URL, then run the printed
 * CREATE CHANGEFEED statement against CockroachDB.
 */

import {
  SNSClient, CreateTopicCommand, SubscribeCommand,
} from '@aws-sdk/client-sns';
import {
  SQSClient, CreateQueueCommand, GetQueueAttributesCommand, SetQueueAttributesCommand,
} from '@aws-sdk/client-sqs';

const region = process.env.AWS_REGION ?? 'us-east-1';
const topicName = process.env.COMMONMIND_SNS_TOPIC_NAME ?? 'commonmind-memory-events';
const queueName = process.env.COMMONMIND_SQS_QUEUE_NAME ?? 'commonmind-fanout';
const dlqName = process.env.COMMONMIND_SQS_DLQ_NAME ?? 'commonmind-fanout-dlq';
const maxReceiveCount = Number(process.env.COMMONMIND_FANOUT_MAX_RECEIVES ?? '5');

const sns = new SNSClient({ region });
const sqs = new SQSClient({ region });

async function queueArn(queueUrl) {
  const { Attributes } = await sqs.send(new GetQueueAttributesCommand({
    QueueUrl: queueUrl,
    AttributeNames: ['QueueArn'],
  }));
  return Attributes.QueueArn;
}

async function main() {
  const dlq = await sqs.send(new CreateQueueCommand({ QueueName: dlqName }));
  const dlqArn = await queueArn(dlq.QueueUrl);

  const queue = await sqs.send(new CreateQueueCommand({
    QueueName: queueName,
    Attributes: {
      RedrivePolicy: JSON.stringify({ deadLetterTargetArn: dlqArn, maxReceiveCount }),
    },
  }));
  const queueUrl = queue.QueueUrl;
  const arn = await queueArn(queueUrl);

  const topic = await sns.send(new CreateTopicCommand({ Name: topicName }));
  const topicArn = topic.TopicArn;

  // Let the topic deliver into the queue.
  await sqs.send(new SetQueueAttributesCommand({
    QueueUrl: queueUrl,
    Attributes: {
      Policy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [{
          Effect: 'Allow',
          Principal: { Service: 'sns.amazonaws.com' },
          Action: 'sqs:SendMessage',
          Resource: arn,
          Condition: { ArnEquals: { 'aws:SourceArn': topicArn } },
        }],
      }),
    },
  }));

  await sns.send(new SubscribeCommand({
    TopicArn: topicArn,
    Protocol: 'sqs',
    Endpoint: arn,
    Attributes: { RawMessageDelivery: 'true' },
  }));

  console.log('Provisioned:');
  console.log(`  SNS topic:        ${topicArn}`);
  console.log(`  SQS fanout queue: ${queueUrl} (${arn})`);
  console.log(`  SQS DLQ:          ${dlq.QueueUrl} (${dlqArn}, maxReceiveCount=${maxReceiveCount})`);
  console.log('');
  console.log('Set in .env:');
  console.log(`  COMMONMIND_SNS_TOPIC_ARN=${topicArn}`);
  console.log('');
  console.log('After deploying the CDC bridge (dist/cdc/bridge.js) behind a Lambda Function URL,');
  console.log('run this against CockroachDB (webhook_auth_header is whatever the bridge checks):');
  console.log('');
  console.log(`  CREATE CHANGEFEED FOR TABLE memory_events`);
  console.log(`    INTO 'webhook-https://<bridge-function-url>'`);
  console.log(`    WITH updated, webhook_sink_config='{"Flush":{"Bytes":1,"Frequency":"200ms"}}';`);
  console.log('');
  console.log('Wire the fanout Lambda (dist/cdc/fanout.js, handler `handler`) to an SQS event source on:');
  console.log(`  ${queueUrl}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
