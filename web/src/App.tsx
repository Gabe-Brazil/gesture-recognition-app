import { useState } from 'react'
import { useHandTracking } from './hooks/useHandTracking'
import commands from '../../shared/command_list.json'
import './App.css'

interface Message { cmd: string; id: string; ts: number; gesture: 'none'; confidence: 0 }
function createMessage(cmd: string): Message {
  return { cmd, id: crypto.randomUUID(), ts: Date.now(), gesture: 'none', confidence: 0 }
}

const slides = [
  ['THE IDEA', 'Present with a little more freedom.', 'A hands-free presentation experience, built by AI Club.'],
  ['THE TRACKING', 'Your hands become the interface.', 'Live hand landmarks are the first step toward recognizing gestures.'],
  ['THE CONNECTION', 'Small signals. Clear actions.', 'Shared commands connect the browser to the presenter client.'],
  ['WHAT’S NEXT', 'Ready for the next step.', 'The camera and command pipeline are ready for model integration.'],
]
const labels: Record<string, string> = { NEXT: 'Next slide →', PREV: '← Previous slide', FIRST: '⇤ First slide', LAST: 'Last slide ⇥', BLACK_SCREEN: '◐ Toggle black screen' }

export default function App() {
  const { videoRef, canvasRef, status, error, hands, fps, start, stop } = useHandTracking()
  const [logs, setLogs] = useState<Message[]>([])
  const [slide, setSlide] = useState(0)
  const [black, setBlack] = useState(false)
  const [mirror, setMirror] = useState(true)
  const active = status === 'live'
  const loading = status === 'loading'
  function handleCommand(cmd: string) {
    const payload = createMessage(cmd)
    setLogs(previous => [payload, ...previous].slice(0, 30))
    if (cmd === 'BLACK_SCREEN') setBlack(value => !value)
    else setSlide(value => cmd === 'NEXT' ? Math.min(3, value + 1) : cmd === 'PREV' ? Math.max(0, value - 1) : cmd === 'FIRST' ? 0 : 3)
  }
  return <main>
    <header><a className="brand" href="#"><b>✳</b> gesture <span>/ studio</span></a><span className="badge">● AI CLUB · WEB LAB</span></header>
    <section className="intro"><div><p className="eyebrow">LESS CLICKING. MORE CONNECTING.</p><h1>Take the stage.</h1><p className="subtitle">Explore live hand tracking and test your presentation controls.</p></div><div className="mode">● Local demo<small>Commands stay in this browser</small></div></section>
    <div className="workspace">
      <section className="panel" aria-labelledby="camera-title">
        <div className="panel-heading"><div><span className="number">01</span><h2 id="camera-title">Camera & tracking</h2></div><span className="status">{loading ? 'Starting…' : active ? '● Live' : 'Camera off'}</span></div>
        <div className={`camera-stage ${mirror ? 'mirrored' : ''}`}><video ref={videoRef} autoPlay playsInline muted aria-label="Live webcam preview"/><canvas ref={canvasRef} aria-hidden="true"/>{!active && <div className="placeholder"><div className="camera-symbol">◎</div><h3>{loading ? 'Getting things ready' : 'Your next move starts here'}</h3><p>{loading ? 'Allow camera access while the tracker loads.' : 'Start your camera, then hold a hand in view.'}</p><span>UP TO 2 HANDS · 21 LANDMARKS EACH</span></div>}{active && <div className="camera-caption">● {hands ? 'Hand landmarks detected' : 'Hold a hand in view'}</div>}</div>
        <div className="camera-actions"><button className="primary" onClick={loading || active ? stop : start}>{loading ? 'Cancel' : active ? 'Stop camera ■' : 'Start camera ↗'}</button><label><input type="checkbox" checked={mirror} onChange={event => setMirror(event.target.checked)}/> Mirror preview</label></div>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="metrics" aria-live="polite"><div><span>HANDS DETECTED</span><strong>{hands}<small> / 2</small></strong></div><div><span>TRACKING RATE</span><strong>{fps}<small> fps</small></strong></div><div><span>LANDMARKS</span><strong>{hands * 21}<small> points</small></strong></div></div><p className="privacy">◈ Video is processed on your device. No frames are uploaded.</p>
      </section>
      <section className="panel" aria-labelledby="controls-title"><div className="panel-heading"><div><span className="number">02</span><h2 id="controls-title">Command simulator</h2></div><span className="status">Manual</span></div><p className="description">Try the controls on this sample deck. Each click creates a command in the activity log.</p>
        <div className={`slide-preview ${black ? 'blacked' : ''}`} aria-live="polite">{black ? <p>Black screen enabled</p> : <><span className="slide-tag">{slides[slide][0]}</span><h3>{slides[slide][1]}</h3><p>{slides[slide][2]}</p><span className="decoration" aria-hidden="true">✳</span></>}</div><div className="slide-position"><span>SAMPLE PRESENTATION</span><span>0{slide + 1} / 04</span></div>
        <div className="command-grid">{commands.commands.map(command => <button key={command.name} className={command.name === 'BLACK_SCREEN' ? 'wide' : ''} onClick={() => handleCommand(command.name)} aria-pressed={command.name === 'BLACK_SCREEN' ? black : undefined}>{labels[command.name]}</button>)}</div><div className="integration-note"><span>○</span><div><strong>Gesture classifier · upcoming</strong><p>Hand tracking is live. Automatic gestures and the Ably relay will connect in the next stage.</p></div></div>
      </section>
    </div>
    <section className="panel activity" aria-labelledby="activity-title"><div className="panel-heading"><div><span className="number">03</span><h2 id="activity-title">Activity log</h2><span className="count">{logs.length}</span></div><button className="text-button" disabled={!logs.length} onClick={() => setLogs([])}>Clear log</button></div><p className="log-help">Manual test messages use gesture “none” and confidence 0. Latest 30 commands are kept in memory.</p>{logs.length ? <div className="log-list">{logs.map(payload => <details key={payload.id}><summary><span className="log-command">{payload.cmd}</span><span className="log-source">Manual simulation</span><time>{new Date(payload.ts).toLocaleTimeString()}</time><span>⌄</span></summary><pre>{JSON.stringify(payload, null, 2)}</pre></details>)}</div> : <div className="empty-log"><span>↳</span><p>Your commands will appear here.<small>Try “Next slide” to see the shared message format in action.</small></p></div>}</section>
    <footer><span>GESTURE STUDIO / AI Club</span><span>Built for a more natural presentation.</span></footer>
  </main>
}
