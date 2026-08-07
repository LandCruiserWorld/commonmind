import assert from 'node:assert/strict';
import test from 'node:test';
import { handleChangefeedBatch, SnsMemoryEventPublisher, type ChangefeedRow, type MemoryEventPublisher } from '../src/cdc/bridge.js';
import { deliverMemoryEvent } from '../src/cdc/fanout.js';

test('bridge hands every batch row to the publisher, in order', async () => {
  const published: ChangefeedRow[] = [];
  const publisher: MemoryEventPublisher = { publish: async (row) => { published.push(row); } };

  const count = await handleChangefeedBatch({
    payload: [
      { after: { entity_type: 'notification', entity_id: 'n1', action: 'created' } },
      { after: null }, // resolved-timestamp marker
      { after: { entity_type: 'decision', entity_id: 'd1', action: 'created' } },
    ],
  }, publisher);

  assert.equal(count, 3);
  assert.equal(published.length, 3);
  assert.equal(published[0].after?.entity_id, 'n1');
  assert.equal(published[1].after, null);
  assert.equal(published[2].after?.entity_id, 'd1');
});

test('SnsMemoryEventPublisher skips deletes/resolved markers and publishes the row unchanged', async () => {
  const sent: Array<{ TopicArn?: string; Message?: string }> = [];
  const fakeSns = { send: async (command: { input: { TopicArn?: string; Message?: string } }) => {
    sent.push(command.input);
    return {};
  } };

  const publisher = new SnsMemoryEventPublisher(fakeSns, 'arn:aws:sns:us-east-1:000000000000:commonmind-memory-events');

  await publisher.publish({ after: null });
  assert.equal(sent.length, 0, 'resolved-timestamp markers never reach SNS');

  await publisher.publish({ after: { entity_type: 'notification', entity_id: 'n1', action: 'created' } });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].TopicArn, 'arn:aws:sns:us-east-1:000000000000:commonmind-memory-events');
  assert.deepEqual(JSON.parse(sent[0].Message ?? '{}'), { entity_type: 'notification', entity_id: 'n1', action: 'created' });
});

test('bridge rejects a payload that is not the changefeed batch shape', async () => {
  await assert.rejects(
    () => handleChangefeedBatch({ notPayload: [] }, { publish: async () => {} }),
    /Malformed changefeed payload/,
  );
});

test('fanout only delivers `notification` events, and only touches `notifications`', async () => {
  const updates: Array<{ text: string; params: unknown[] }> = [];
  const fakePool = {
    query: async (text: string, params: unknown[]) => {
      updates.push({ text, params });
      return { rowCount: 1 };
    },
  };

  const delivered = await deliverMemoryEvent(
    { entity_type: 'notification', entity_id: 'n1', action: 'created' },
    fakePool,
  );

  assert.equal(delivered, true);
  assert.equal(updates.length, 1);
  assert.match(updates[0].text, /UPDATE notifications/);
  assert.doesNotMatch(updates[0].text, /memory_records|memory_embeddings|memory_events/);
  assert.deepEqual(updates[0].params, ['n1']);
});

test('fanout no-ops (does not query) for non-notification memory events', async () => {
  let queried = false;
  const fakePool = { query: async () => { queried = true; return { rowCount: 0 }; } };

  const delivered = await deliverMemoryEvent(
    { entity_type: 'decision', entity_id: 'd1', action: 'created' },
    fakePool,
  );

  assert.equal(delivered, false);
  assert.equal(queried, false);
});
