import test from 'node:test'
import assert from 'node:assert/strict'
import { commandOptions, defaultMappings, gestureLabels, parseMappings, validateMappings } from '../src/lib/gestureMappings.ts'

test('every shared label has a valid default, and none defaults to no command', () => {
  assert.deepEqual(Object.keys(defaultMappings), gestureLabels.map(label => label.name))
  assert.equal(defaultMappings.none, '')
  assert.equal(defaultMappings.thumbs_up, 'NEXT')
  for (const command of Object.values(defaultMappings)) assert.ok(command === '' || commandOptions.some(option => option.name === command))
})
test('saved custom mappings and no-command selections survive JSON round trips', () => {
  const custom = { ...defaultMappings, thumbs_up: 'FIRST', swipe_left: '' }
  assert.deepEqual(parseMappings(JSON.stringify(custom)), custom)
})
test('invalid storage falls back to defaults; unknown values cannot enter the mapping', () => {
  for (const input of [null, '{bad json', 'null', '[]', '42']) assert.deepEqual(parseMappings(input), defaultMappings)
  const result = validateMappings({ thumbs_up: 'DELETE', thumbs_down: 'LAST', none: false, unknown_gesture: 'NEXT' })
  assert.equal(result.thumbs_up, 'NEXT'); assert.equal(result.thumbs_down, 'LAST'); assert.equal(result.none, '')
  assert.equal('unknown_gesture' in result, false)
})
