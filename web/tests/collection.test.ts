import test from 'node:test'
import assert from 'node:assert/strict'
import { DataCollector, exportCSV, exportJSON, SAMPLE_TARGET, type CaptureFrame } from '../src/lib/collection.ts'
import { FEATURE_LENGTH, FEATURE_VERSION } from '../../shared/normalizeHand.ts'

function frame(t: number, handedness: 'Left' | 'Right' = 'Right'): CaptureFrame {
  return { t, aspect: 4 / 3, hands: [{ handedness, features: Array.from({ length: FEATURE_LENGTH }, (_, i) => i / 10), raw: Array.from({ length: 21 }, (_, i) => ({ x: i / 21, y: .5, z: .1 })) }] }
}
test('records only while armed and stops exactly at 100 samples per label', () => {
  const recorder = new DataCollector()
  recorder.capture(frame(0))
  assert.equal(recorder.getSnapshot().samples.length, 0)
  recorder.selectLabel('thumbs_up')
  recorder.start()
  for (let i = 0; i < 110; i++) recorder.capture(frame(i * 100))
  assert.equal(recorder.count('thumbs_up'), SAMPLE_TARGET)
  assert.equal(recorder.getSnapshot().recording, false)
  recorder.start()
  assert.equal(recorder.getSnapshot().recording, false)
  recorder.selectLabel('thumbs_down')
  recorder.start()
  recorder.capture(frame(12000))
  assert.equal(recorder.count('thumbs_down'), 1)
  assert.equal(recorder.count('thumbs_up'), 100)
})
test('ignores empty, ambiguous, malformed, repeated and too-frequent frames', () => {
  const recorder = new DataCollector()
  recorder.start()
  recorder.capture({ t: 0, aspect: 1, hands: [] })
  recorder.capture({ ...frame(0), hands: [...frame(0).hands, ...frame(0, 'Left').hands] })
  for (const features of [null, [1, 2], Array(63).fill(NaN), Array(63).fill(Infinity)]) {
    const invalid = frame(0); invalid.hands[0].features = features; recorder.capture(invalid)
  }
  const badRaw = frame(0); badRaw.hands[0].raw[0].x = NaN; recorder.capture(badRaw)
  recorder.capture({ ...frame(0), aspect: 0 })
  assert.equal(recorder.getSnapshot().samples.length, 0)
  recorder.capture(frame(100))
  recorder.capture(frame(100)); recorder.capture(frame(99)); recorder.capture(frame(150))
  assert.equal(recorder.getSnapshot().samples.length, 1)
  recorder.capture(frame(200))
  assert.equal(recorder.getSnapshot().samples.length, 2)
})
test('locks the label and hand during a take; pause/resume creates a new recording', () => {
  const recorder = new DataCollector()
  recorder.selectLabel('swipe_right'); recorder.start()
  recorder.selectLabel('thumbs_up'); recorder.selectHand('Left')
  recorder.capture(frame(100)); recorder.capture(frame(200, 'Left'))
  assert.equal(recorder.count('swipe_right'), 1)
  assert.equal(recorder.getSnapshot().hand, 'single')
  recorder.stop(); recorder.capture(frame(300))
  assert.equal(recorder.getSnapshot().samples.length, 1)
  recorder.start(); recorder.capture(frame(1, 'Left'))
  const samples = recorder.getSnapshot().samples
  assert.equal(samples.length, 2)
  assert.notEqual(samples[0].recording_id, samples[1].recording_id)
  assert.equal(samples[1].sample_index, 0)
})
test('explicit hand selection filters two-hand frames and copies the data', () => {
  const recorder = new DataCollector()
  recorder.selectHand('Left'); recorder.start()
  const input = frame(100, 'Left')
  input.hands.push(...frame(100).hands)
  recorder.capture(input)
  input.hands[0].features![0] = 999
  input.hands[0].raw[0].x = 999
  const sample = recorder.getSnapshot().samples[0]
  assert.equal(sample.handedness, 'Left')
  assert.equal(sample.features[0], 0)
  assert.equal(sample.raw[0].x, 0)
  assert.equal(sample.feature_version, FEATURE_VERSION)
})
test('none means a visible negative pose, not an invented zero vector', () => {
  const recorder = new DataCollector()
  recorder.start(); recorder.capture({ t: 0, aspect: 1, hands: [] }); recorder.capture(frame(100))
  assert.equal(recorder.count('none'), 1)
  assert.deepEqual(recorder.getSnapshot().samples[0].features, frame(100).hands[0].features)
})
test('JSON and CSV export all labels with the same ordered feature and raw columns', () => {
  const recorder = new DataCollector()
  recorder.start(); recorder.capture(frame(100)); recorder.stop()
  recorder.selectLabel('swipe_left'); recorder.start(); recorder.capture(frame(200)); recorder.stop()
  const samples = recorder.getSnapshot().samples
  const json = JSON.parse(exportJSON(samples))
  assert.equal(json.schema_version, 1); assert.equal(json.feature_length, 63)
  assert.equal(json.samples.length, 2); assert.deepEqual(json.samples, samples)
  const rows = exportCSV(samples).trim().split('\r\n')
  const header = rows[0].split(',')
  assert.equal(header.length, 9 + 63 + 63)
  assert.deepEqual(header.slice(9, 12), ['feature_0', 'feature_1', 'feature_2'])
  const cells = rows[1].split(',').map(cell => JSON.parse(cell))
  assert.equal(cells.length, header.length)
  assert.deepEqual(cells.slice(9, 72).map(Number), samples[0].features)
  assert.equal(rows.length, 3)
  assert.equal(recorder.getSnapshot().dirty, true)
  recorder.markExported(); assert.equal(recorder.getSnapshot().dirty, false)
  recorder.start(); recorder.capture(frame(300)); assert.equal(recorder.getSnapshot().dirty, true)
})
test('clear only removes the selected label and not while recording', () => {
  const recorder = new DataCollector()
  recorder.start(); recorder.capture(frame(100)); recorder.clearLabel()
  assert.equal(recorder.count('none'), 1)
  recorder.stop(); recorder.selectLabel('thumbs_up'); recorder.start(); recorder.capture(frame(200)); recorder.stop()
  recorder.clearLabel()
  assert.equal(recorder.count('thumbs_up'), 0); assert.equal(recorder.count('none'), 1)
})
