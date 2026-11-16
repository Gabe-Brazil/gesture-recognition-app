import { useState } from 'react'
import { commandOptions, defaultMappings, gestureLabels, MAPPING_STORAGE_KEY, parseMappings, type GestureMappings } from '../lib/gestureMappings'

function loadSettings() {
  try { return { mappings: parseMappings(localStorage.getItem(MAPPING_STORAGE_KEY)), error: '' } }
  catch { return { mappings: { ...defaultMappings }, error: 'Browser storage is unavailable. Changes will last only for this visit.' } }
}

export function GestureSettings() {
  const [settings, setSettings] = useState(loadSettings)
  function save(mappings: GestureMappings) {
    let error = ''
    try { localStorage.setItem(MAPPING_STORAGE_KEY, JSON.stringify(mappings)) }
    catch { error = 'Could not save to browser storage. Changes will last only for this visit.' }
    setSettings({ mappings, error })
  }
  return <section className="panel settings-panel" aria-labelledby="settings-title">
    <div className="panel-heading"><h2 id="settings-title">Gesture settings</h2><button className="text-button" onClick={() => save({ ...defaultMappings })}>Restore defaults</button></div>
    <p className="description">Choose the command for each gesture. Saved on this browser for the future classifier; changing a mapping does not send a command.</p>
    <div className="mapping-grid">{gestureLabels.map(({ name }) => <label key={name} className="field-label"><span>{name.replaceAll('_', ' ')}</span><select value={settings.mappings[name]} onChange={event => save({ ...settings.mappings, [name]: event.target.value })}>
      <option value="">No command</option>{commandOptions.map(command => <option key={command.name} value={command.name}>{command.name} — {command.description}</option>)}
    </select></label>)}</div>
    {settings.error ? <p className="error" role="alert">{settings.error}</p> : <p className="settings-status" role="status">Mappings save automatically on this browser.</p>}
  </section>
}
