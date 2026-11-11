# Gesture Studio web app

A local demo of webcam hand tracking and presentation commands.

## Run locally

Use Node.js 22.12+ (or a newer supported LTS version).

```sh
cd web
npm ci
npm run dev
```

Open the localhost URL printed by Vite. Click **Start camera**, allow camera access, and hold one or two hands in view. **Stop camera** releases the camera and tracking model; **Cancel** also cleans up a pending start. The mirror setting changes the preview only.

The first tracking session downloads the versioned MediaPipe WASM runtime from jsDelivr and the hand-landmarker model from Google storage. Internet access is required for those assets. Webcam frames are processed locally and are not uploaded. Use localhost or HTTPS; ordinary HTTP on a LAN address does not provide webcam access in most browsers.

## Demo flow

1. Start the camera and show hand landmark overlays.
2. Point out the hand count, landmark count, and measured inference FPS.
3. Use Next, Previous, First, and Last to control the sample deck.
4. Toggle the black screen, then toggle it off.
5. Expand an activity entry to inspect its JSON payload, then clear the log.
6. Stop the camera and verify the browser camera indicator turns off.

The simulator uses commands from `../shared/command_list.json` and the fields documented in `../shared/message-format.md`. Manual messages have `gesture: "none"` and `confidence: 0`; they are not model predictions. The latest 30 messages are kept in memory and disappear on reload. Slide navigation clamps at the first and last slide.

## Implementation

- `src/hooks/useHandTracking.ts`: camera lifecycle, MediaPipe model loading, landmark rendering, and metrics. Each start gets a session identifier so canceled or obsolete requests cannot activate tracking. Inference is capped at 30 Hz and metrics update twice per second.
- `src/App.tsx`: dashboard, local sample deck, command generation, and log.
- `src/App.css`: responsive desktop/mobile layout.

Hand tracking uses MediaPipe's pretrained hand-landmark model, not the team's gesture classifier. Automatic gesture-to-command mapping, ONNX inference, and Ably publishing are not implemented here. No API keys are required for this demo. The Python presenter client is unchanged.

When updating `@mediapipe/tasks-vision`, update the matching WASM version in the tracking hook. Inference currently runs on the main thread; a worker is a future optimization for slower devices.

## Checks

```sh
npm run build
npm run lint
```

Manual checks: allow/deny camera permission; cancel while loading; start/stop repeatedly; disconnect the camera; verify zero, one, and two hands; toggle mirroring; try all five commands; check slide boundaries; expand and clear logs; inspect a narrow mobile viewport.

API reference: https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js
