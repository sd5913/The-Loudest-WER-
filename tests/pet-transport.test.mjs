import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const PetTransport = runInNewContext(
  readFileSync(new URL('../pet-transport.js', import.meta.url), 'utf8') + '\nPetTransport'
);

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, String(actual));
const hitsAt = (transport, time) => Array.from(transport.read(time).hits);

function setup(looping = true) {
  const transport = new PetTransport(10, .5, 4, looping);
  const events = [];
  let voice = 'cat';
  const enqueue = (step, loop, time) => {
    const event = { step, loop, time, voice, cancelled: false };
    events.push(event);
    return { hits: [voice], cancel: () => { event.cancelled = true; } };
  };
  return { transport, events, enqueue, editVoice: name => { voice = name; } };
}

test('look-ahead commits exact audio times and the playhead waits for each hit', () => {
  const { transport, events, enqueue } = setup();
  transport.fill(10, enqueue);
  const first = events[0].time;
  near(first, 10.035);
  assert.equal(transport.read(first - .001).step, -1);
  assert.deepEqual(hitsAt(transport, first - .001), []);
  assert.deepEqual(hitsAt(transport, first), ['cat']);
  assert.deepEqual(hitsAt(transport, first + .02), []);
  transport.fill(10.42, enqueue);
  transport.fill(10.50, enqueue); // Timer callback slips but the next beat is already queued.
  assert.equal(events.length, 2);
  near(events[1].time - first, .5);
  assert.equal(transport.read(10.53).step, 0);
  assert.equal(transport.read(10.54).step, 1);
});

test('a long stall skips elapsed steps and stale hit animations without changing phase', () => {
  const { transport, events, enqueue } = setup();
  transport.fill(10, enqueue);
  transport.fill(11.45, enqueue);
  assert.deepEqual(events.map(event => event.step), [0, 3]);
  assert.deepEqual(hitsAt(transport, 11.45), []);
  assert.equal(transport.read(11.45).step, 2);
  near(events[1].time, 11.535);
  assert.deepEqual(hitsAt(transport, 11.54), ['cat']);
});

test('edits replace a pending event on its original beat and leave a due note alone', () => {
  const { transport, events, enqueue, editVoice } = setup();
  transport.fill(10, enqueue);
  transport.fill(10.46, enqueue);
  editVoice('dog');
  transport.update(10.47, .5, 4, true);
  transport.fill(10.47, enqueue);
  assert.equal(events[0].cancelled, false);
  assert.equal(events[1].cancelled, true);
  assert.equal(events[2].voice, 'dog');
  near(events[1].time, events[2].time);
  assert.deepEqual(hitsAt(transport, 10.54), ['dog']);
});

test('tempo changes preserve fractional beat and loop index and reschedule future hits', () => {
  const { transport, events, enqueue } = setup();
  transport.fill(10, enqueue);
  transport.fill(10.45, enqueue);
  transport.update(10.48, .25, 4, true);
  transport.fill(10.48, enqueue);
  assert.equal(transport.read(10.49).step, 0);
  assert.equal(events[1].cancelled, true);
  near(events[2].time, 10.51);
  assert.equal(events[2].step, 1);
  transport.fill(11.16, enqueue);
  assert.equal(events[3].loop, 1);
  assert.equal(events[3].step, 0);
  near(events[3].time, 11.26);
});

test('tempo edit inside the scheduling margin keeps the committed beat', () => {
  const { transport, events, enqueue } = setup();
  transport.fill(10, enqueue);
  transport.fill(10.45, enqueue);
  transport.update(10.533, .25, 4, true);
  transport.fill(10.533, enqueue);
  assert.equal(events[1].cancelled, false);
  assert.equal(transport.read(10.534).step, 0);
  assert.deepEqual(hitsAt(transport, 10.535), ['cat']);
  transport.fill(10.70, enqueue);
  assert.equal(events[2].step, 2);
  near(events[2].time, 10.7865);
});

test('loop count advances across skipped cycles and one-shot never queues loop zero twice', () => {
  const { transport, events, enqueue } = setup();
  transport.fill(14, enqueue);
  assert.equal(events[0].loop, 2);
  assert.equal(events[0].step, 0);
  transport.update(14.01, .5, 4, false);
  assert.equal(events[0].cancelled, true);
  assert.equal(transport.read(14.02).finished, true);

  const once = setup(false);
  once.transport.fill(11.45, once.enqueue);
  once.transport.fill(11.96, once.enqueue);
  assert.deepEqual(once.events.map(event => event.step), [3]);
  assert.equal(once.transport.read(12.034).finished, false);
  assert.equal(once.transport.read(12.035).finished, true);
});

test('stop cancels pending hits, and a restart starts a fresh audio timeline', () => {
  const first = setup();
  first.transport.fill(10, first.enqueue);
  first.transport.cancel();
  assert.ok(first.events[0].cancelled);
  assert.deepEqual(hitsAt(first.transport, 10.05), []);
  const restarted = new PetTransport(10.25, .5, 4, true);
  restarted.fill(10.25, first.enqueue);
  assert.equal(first.events[1].step, 0);
  assert.equal(first.events[1].loop, 0);
  near(first.events[1].time, 10.285);
});

test('an edit exactly at the look-ahead margin never duplicates a beat', () => {
  const transport = new PetTransport(50176 / 48000, .75, 16, true);
  const now = (50176 + 855 * 128) / 48000;
  const events = [];
  const enqueue = step => {
    const event = { step, cancelled: false };
    events.push(event);
    return { hits: [], cancel: () => { event.cancelled = true; } };
  };
  transport.fill(now - .05, enqueue);
  transport.update(now, .75, 16, true);
  transport.fill(now, enqueue);
  assert.deepEqual(events.filter(event => !event.cancelled).map(event => event.step), [3]);
});
