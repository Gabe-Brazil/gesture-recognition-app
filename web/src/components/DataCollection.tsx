import { useSyncExternalStore } from 'react'
import { DataCollector, exportCSV, exportJSON, SAMPLE_INTERVAL_MS, SAMPLE_TARGET, type HandChoice } from '../lib/collection'
import { gestureLabels } from '../lib/gestureMappings'

export function DataCollection({ collector, cameraReady }: { collector: DataCollector; cameraReady: boolean }) {
  const state = useSyncExternalStore(collector.subscribe, collector.getSnapshot)
  const count = collector.count(state.label)
  function download(format: 'json' | 'csv') {
    const data = format === 'json' ? exportJSON(state.samples) : exportCSV(state.samples)
    const url = URL.createObjectURL(new Blob([data], { type: format === 'json' ? 'application/json' : 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `gesture-samples-${new Date().toISOString().replaceAll(':', '-')}.${format}`
    document.body.append(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    collector.markExported()
  }
  return <section className="panel collection-panel" aria-labelledby="collection-title">
    <div className="panel-heading"><div><span className="number">02</span><h2 id="collection-title">Collect training data</h2></div><span className="status">{state.recording ? '● Recording' : 'Ready'}</span></div>
    <p className="description">Record one hand at a time at up to {1000 / SAMPLE_INTERVAL_MS} samples/sec. Each sample contains 63 normalized values. Recording stops at {SAMPLE_TARGET} samples per gesture.</p>
    <div className="collection-fields">
      <label className="field-label">Gesture label<select value={state.label} disabled={state.recording} onChange={event => collector.selectLabel(event.target.value)}>{gestureLabels.map(label => <option key={label.id} value={label.name}>{label.name}</option>)}</select></label>
      <label className="field-label">Hand to record<select value={state.hand} disabled={state.recording} onChange={event => collector.selectHand(event.target.value as HandChoice)}><option value="single">Single visible hand</option><option value="Left">Left (MediaPipe label)</option><option value="Right">Right (MediaPipe label)</option></select></label>
    </div>
    <div className="collection-progress"><div><strong>{count} <small>/ {SAMPLE_TARGET}</small></strong><span>{state.label}</span></div><progress aria-label={`Samples for ${state.label}`} value={count} max={SAMPLE_TARGET} /></div>
    <div className="collection-actions"><button className="primary" disabled={!state.recording && (!cameraReady || count >= SAMPLE_TARGET)} onClick={() => state.recording ? collector.stop() : collector.start()}>{state.recording ? 'Pause recording' : 'Record samples'}</button><button className="secondary" disabled={state.recording || !count} onClick={() => { if (window.confirm(`Clear all ${count} samples for ${state.label}? Export first if you need to keep them.`)) collector.clearLabel() }}>Clear this label</button></div>
    <p className="collection-message" role="status">{!cameraReady ? 'Start the camera to record. Existing samples can still be exported.' : state.message}</p>
    <div className="collection-tip">For “none”, keep a hand visible in a neutral or unrelated pose. No-hand frames have no usable vector and are skipped. For swipes, record full movements; raw landmarks and ordered timestamps are included.</div>
    <ul className="label-counts" aria-label="Samples per gesture">{gestureLabels.map(label => <li key={label.id}><span>{label.name}</span><strong>{collector.count(label.name)} / {SAMPLE_TARGET}</strong></li>)}</ul>
    <div className="export-actions"><button className="secondary" disabled={state.recording || !state.samples.length} onClick={() => download('json')}>Export JSON</button><button className="secondary" disabled={state.recording || !state.samples.length} onClick={() => download('csv')}>Export CSV</button></div>
    <p className="collection-footnote">Exports include all {state.samples.length} collected samples. Data stays in this tab and is lost on reload; export before leaving. Collection never sends commands or samples to Ably.</p>
  </section>
}
