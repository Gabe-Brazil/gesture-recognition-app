import { FEATURE_LENGTH, FEATURE_VERSION, LANDMARK_COUNT, type Handedness, type Pt } from '../../../shared/normalizeHand.ts'
import { gestureLabels } from './gestureMappings.ts'

export const SAMPLE_TARGET = 100
export const SAMPLE_INTERVAL_MS = 100
export type HandChoice = 'single' | Handedness
export interface CaptureFrame { t: number; aspect: number; hands: { handedness: Handedness; features: number[] | null; raw: Pt[] }[] }
export interface Sample {
  label: string
  label_id: number
  recording_id: string
  sample_index: number
  captured_at: number
  frame_timestamp_ms: number
  feature_version: number
  handedness: Handedness
  aspect: number
  features: number[]
  raw: Pt[]
}
export interface CollectionSnapshot {
  samples: readonly Sample[]
  recording: boolean
  label: string
  hand: HandChoice
  message: string
  dirty: boolean
}

/** One bounded in-memory dataset, consumed by React and the frame callback. */
export class DataCollector {
  private snapshot: CollectionSnapshot = { samples: [], recording: false, label: gestureLabels[0].name, hand: 'single', message: 'Start the camera, choose a label, then record.', dirty: false }
  private listeners = new Set<() => void>()
  private lastFrame = -Infinity
  private recordingId = ''
  private sampleIndex = 0
  private lockedHand: Handedness | null = null

  getSnapshot = () => this.snapshot
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private update(change: Partial<CollectionSnapshot>) {
    this.snapshot = { ...this.snapshot, ...change }
    this.listeners.forEach(listener => listener())
  }
  count(label: string) { return this.snapshot.samples.filter(sample => sample.label === label).length }
  selectLabel(label: string) {
    if (!this.snapshot.recording && gestureLabels.some(entry => entry.name === label)) this.update({ label })
  }
  selectHand(hand: HandChoice) { if (!this.snapshot.recording) this.update({ hand }) }
  start() {
    if (this.snapshot.recording || this.count(this.snapshot.label) >= SAMPLE_TARGET) return
    this.lastFrame = -Infinity
    this.recordingId = crypto.randomUUID()
    this.sampleIndex = 0
    this.lockedHand = null
    this.update({ recording: true, message: 'Recording. Hold one hand in view and vary the pose naturally.' })
  }
  stop(message = 'Recording paused. Your samples are kept.') {
    if (this.snapshot.recording) this.update({ recording: false, message })
  }
  clearLabel() {
    if (this.snapshot.recording) return
    const samples = this.snapshot.samples.filter(sample => sample.label !== this.snapshot.label)
    this.update({ samples, dirty: samples.length > 0, message: 'Samples for this label cleared.' })
  }
  markExported() { this.update({ dirty: false, message: 'Export downloaded. Your samples remain available in this tab.' }) }
  private waiting(message: string) { if (this.snapshot.message !== message) this.update({ message }) }
  capture = (frame: CaptureFrame) => {
    if (!this.snapshot.recording || !Number.isFinite(frame.t) || frame.t <= this.lastFrame || frame.t - this.lastFrame < SAMPLE_INTERVAL_MS) return
    if (!Number.isFinite(frame.aspect) || frame.aspect <= 0) return
    const candidates = this.snapshot.hand === 'single' ? frame.hands : frame.hands.filter(hand => hand.handedness === this.snapshot.hand)
    if (candidates.length !== 1) {
      this.waiting(candidates.length ? 'Multiple matching hands: show only one hand to avoid mixing samples.' : 'Waiting for a matching hand. No empty frames are recorded.')
      return
    }
    const hand = candidates[0]
    if (this.lockedHand && hand.handedness !== this.lockedHand) { this.waiting('Use the same hand for this recording, or pause and start a new take.'); return }
    if (!hand.features || hand.features.length !== FEATURE_LENGTH || !hand.features.every(Number.isFinite)
      || hand.raw.length !== LANDMARK_COUNT || !hand.raw.every(point => [point.x, point.y, point.z].every(Number.isFinite))) {
      this.waiting('Waiting for valid hand landmarks. Invalid vectors are skipped.'); return
    }
    this.lastFrame = frame.t
    this.lockedHand = hand.handedness
    const sample: Sample = {
      label: this.snapshot.label, label_id: gestureLabels.find(label => label.name === this.snapshot.label)!.id,
      recording_id: this.recordingId, sample_index: this.sampleIndex++, captured_at: Date.now(),
      frame_timestamp_ms: frame.t, feature_version: FEATURE_VERSION, handedness: hand.handedness, aspect: frame.aspect,
      features: [...hand.features], raw: hand.raw.map(point => ({ ...point })),
    }
    const complete = this.count(sample.label) + 1 >= SAMPLE_TARGET
    this.update({ samples: [...this.snapshot.samples, sample], recording: !complete, dirty: true,
      message: complete ? `100 samples collected for ${sample.label}. Choose another label or export your data.` : `Recording ${sample.label} · ${hand.handedness.toLowerCase()} hand` })
  }
}

export function exportJSON(samples: readonly Sample[]) {
  return JSON.stringify({ schema_version: 1, feature_version: FEATURE_VERSION, feature_length: FEATURE_LENGTH,
    exported_at: new Date().toISOString(), sample_interval_ms: SAMPLE_INTERVAL_MS, labels: gestureLabels, samples }, null, 2)
}
function csvCell(value: string | number) { return `"${String(value).replaceAll('"', '""')}"` }
export function exportCSV(samples: readonly Sample[]) {
  const metadata = ['label', 'label_id', 'recording_id', 'sample_index', 'captured_at', 'frame_timestamp_ms', 'feature_version', 'handedness', 'aspect'] as const
  const columns = [...metadata, ...Array.from({ length: FEATURE_LENGTH }, (_, i) => `feature_${i}`),
    ...Array.from({ length: LANDMARK_COUNT }, (_, i) => ['x', 'y', 'z'].map(axis => `raw_${i}_${axis}`)).flat()]
  return [columns.join(','), ...samples.map(sample => [...metadata.map(key => sample[key]), ...sample.features,
    ...sample.raw.flatMap(point => [point.x, point.y, point.z])].map(csvCell).join(','))].join('\r\n') + '\r\n'
}
