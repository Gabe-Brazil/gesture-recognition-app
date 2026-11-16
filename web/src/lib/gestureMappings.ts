import gestures from '../../../shared/gesture_labels.json' with { type: 'json' }
import commands from '../../../shared/command_list.json' with { type: 'json' }

export const MAPPING_STORAGE_KEY = 'gesture-studio.mappings.v1'
export type GestureMappings = Record<string, string>
export const gestureLabels = gestures.labels
export const commandOptions = commands.commands
const suggested: GestureMappings = {
  none: '', thumbs_up: 'NEXT', thumbs_down: 'PREV', swipe_right: 'NEXT', swipe_left: 'PREV',
}
const validCommands = new Set(commands.commands.map(command => command.name))
export const defaultMappings = Object.fromEntries(gestureLabels.map(({ name }) => [
  name, validCommands.has(suggested[name]) ? suggested[name] : '',
]))

/** Discard unknown labels/commands and fill missing values from current defaults. */
export function validateMappings(value: unknown): GestureMappings {
  const result = { ...defaultMappings }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result
  for (const { name } of gestureLabels) {
    const command = (value as Record<string, unknown>)[name]
    if (typeof command === 'string' && (command === '' || validCommands.has(command))) result[name] = command
  }
  return result
}

export function parseMappings(value: string | null): GestureMappings {
  try { return validateMappings(value ? JSON.parse(value) : null) }
  catch { return { ...defaultMappings } }
}
