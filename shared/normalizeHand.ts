// shared/normalizeHand.ts
//
// Pure functions for turning MediaPipe hand landmarks into a camera-independent
// feature vector. No React, DOM, or MediaPipe imports, so it can be used by the
// live hook, the training-data recorder, and Node scripts alike.
//
// Bump FEATURE_VERSION whenever the output of normalizeHand changes, and store
// it alongside every recorded sample.

export const FEATURE_VERSION = 1
export const LANDMARK_COUNT = 21
export const FEATURE_LENGTH = LANDMARK_COUNT * 3 // 63

export type Pt = { x: number; y: number; z: number }
export type Handedness = 'Left' | 'Right'

// Landmark indices
const WRIST = 0
const MIDDLE_MCP = 9
const PALM_IDS = [0, 5, 9, 13, 17] as const

/** Copy only x/y/z so we never hold references to MediaPipe's internal objects. */
export function toPts(landmarks: ReadonlyArray<{ x: number; y: number; z: number }>): Pt[] {
  return landmarks.map(({ x, y, z }) => ({ x, y, z }))
}

/** Scale x (and z) by aspect ratio so all axes share the same units (image heights). */
function aspectCorrect(landmarks: ReadonlyArray<Pt>, aspect: number): Pt[] {
  return landmarks.map(l => ({ x: l.x * aspect, y: l.y, z: l.z * aspect }))
}

/** Palm size: wrist -> middle-finger knuckle distance, in aspect-corrected units. */
export function palmSize(landmarks: ReadonlyArray<Pt>, aspect: number): number {
  const w = landmarks[WRIST]
  const m = landmarks[MIDDLE_MCP]
  return Math.hypot((m.x - w.x) * aspect, m.y - w.y)
}

/** Palm center (average of wrist + the four finger knuckles), aspect-corrected. */
export function palmCenter(landmarks: ReadonlyArray<Pt>, aspect: number): { x: number; y: number } {
  let x = 0
  let y = 0
  for (const i of PALM_IDS) {
    x += landmarks[i].x * aspect
    y += landmarks[i].y
  }
  return { x: x / PALM_IDS.length, y: y / PALM_IDS.length }
}

/**
 * Normalize one hand's landmarks into a 63-number feature vector.
 *
 * Steps:
 *  1. Aspect-correct x/z so distances mean the same on any camera.
 *  2. Translate so the wrist is the origin (position invariant).
 *  3. Divide by palm size (scale / distance-from-camera invariant).
 *  4. Mirror left hands so every hand looks like a right hand.
 *
 * Rotation is intentionally NOT normalized: hand orientation carries meaning
 * for slide gestures (pointing up vs. sideways).
 *
 * @param landmarks  21 points from result.landmarks[i]
 * @param aspect     video.videoWidth / video.videoHeight
 * @param handedness result.handedness[i][0].categoryName
 * @returns          [x0, y0, z0, x1, y1, z1, ...] or null if the input is unusable
 */
export function normalizeHand(
  landmarks: ReadonlyArray<Pt>,
  aspect: number,
  handedness: Handedness,
): number[] | null {
  if (landmarks.length !== LANDMARK_COUNT || !Number.isFinite(aspect) || aspect <= 0) return null

  const p = aspectCorrect(landmarks, aspect)
  const w = p[WRIST]

  const size = Math.hypot(p[MIDDLE_MCP].x - w.x, p[MIDDLE_MCP].y - w.y)
  if (!Number.isFinite(size) || size < 1e-6) return null // degenerate / collapsed hand

  const flip = handedness === 'Left' ? -1 : 1 // mirror left hands so all hands look like right hands

  const out = new Array<number>(FEATURE_LENGTH)
  for (let i = 0; i < LANDMARK_COUNT; i++) {
    out[i * 3] = (((p[i].x - w.x) / size) * flip) || 0 // `|| 0` avoids -0
    out[i * 3 + 1] = (p[i].y - w.y) / size
    out[i * 3 + 2] = (p[i].z - w.z) / size
  }
  return out
}