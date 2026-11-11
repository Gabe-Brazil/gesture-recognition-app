import { useCallback, useEffect, useRef, useState } from 'react'
import { DrawingUtils, FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'

// Match the runtime version pinned in package-lock.json.
const wasmUrl = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.0/wasm'
const modelUrl = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
function describeError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') return 'Camera access was denied. Allow camera access in your browser settings, then try again.'
    if (error.name === 'NotFoundError') return 'No camera was found. Connect a camera, then try again.'
    if (error.name === 'NotReadableError') return 'Your camera is unavailable. Close other apps using it, then try again.'
  }
  return 'Could not start hand tracking. Check your camera and internet connection, then try again. The model needs to download on first use.'
}
export function useHandTracking() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const session = useRef(0)
  const streamRef = useRef<MediaStream | null>(null)
  const modelRef = useRef<HandLandmarker | null>(null)
  const frameRef = useRef(0)
  const [status, setStatus] = useState<'idle' | 'loading' | 'live'>('idle')
  const [error, setError] = useState('')
  const [hands, setHands] = useState(0)
  const [fps, setFps] = useState(0)
  const release = useCallback(() => {
    session.current += 1
    cancelAnimationFrame(frameRef.current)
    streamRef.current?.getTracks().forEach(track => { track.onended = null; track.stop() })
    streamRef.current = null
    modelRef.current?.close()
    modelRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    const canvas = canvasRef.current
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
  }, [])
  const stop = useCallback(() => { release(); setStatus('idle'); setHands(0); setFps(0) }, [release])
  useEffect(() => release, [release])
  async function start() {
    release()
    const token = session.current
    setError(''); setHands(0); setFps(0)
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access requires localhost or HTTPS and a browser with webcam support.')
      setStatus('idle'); return
    }
    setStatus('loading')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 960 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false })
      if (session.current !== token) { stream.getTracks().forEach(track => track.stop()); return }
      streamRef.current = stream
      stream.getVideoTracks().forEach(track => { track.onended = () => { stop(); setError('Camera disconnected. Reconnect it and start again.') } })
      const video = videoRef.current!
      video.srcObject = stream
      await video.play()
      if (session.current !== token) return
      const vision = await FilesetResolver.forVisionTasks(wasmUrl)
      if (session.current !== token) return
      const model = await HandLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: modelUrl }, runningMode: 'VIDEO', numHands: 2, minHandDetectionConfidence: 0.5, minTrackingConfidence: 0.5 })
      if (session.current !== token) { model.close(); return }
      modelRef.current = model
      setStatus('live')
      let lastVideoTime = -1
      let lastDetection = 0
      let lastReport = performance.now()
      let frames = 0
      function tick(now: number) {
        if (session.current !== token) return
        try {
          // Limit synchronous inference to 30 Hz so controls remain responsive.
          if (video.readyState >= 2 && video.currentTime !== lastVideoTime && now - lastDetection >= 33) {
            lastVideoTime = video.currentTime; lastDetection = now
            const result = model.detectForVideo(video, now)
            const canvas = canvasRef.current!
            if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) { canvas.width = video.videoWidth; canvas.height = video.videoHeight }
            const context = canvas.getContext('2d')!
            context.clearRect(0, 0, canvas.width, canvas.height)
            const drawing = new DrawingUtils(context)
            for (const landmarks of result.landmarks) {
              drawing.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, { color: '#c5f277', lineWidth: 3 })
              drawing.drawLandmarks(landmarks, { color: '#ffffff', fillColor: '#567c30', radius: 3, lineWidth: 1 })
            }
            frames += 1
            if (now - lastReport >= 500) { setHands(result.landmarks.length); setFps(Math.round(frames * 1000 / (now - lastReport))); frames = 0; lastReport = now }
          }
          frameRef.current = requestAnimationFrame(tick)
        } catch (failure) { stop(); setError(describeError(failure)) }
      }
      frameRef.current = requestAnimationFrame(tick)
    } catch (failure) {
      if (session.current !== token) return
      stop(); setError(describeError(failure))
    }
  }
  return { videoRef, canvasRef, status, error, hands, fps, start, stop }
}
