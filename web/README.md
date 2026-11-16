# Gesture Studio web app

Browser camera tracking, slideshow controls, and training-data collection.

## Run locally

Use Node.js 22.18+ or a newer supported LTS version (the test runner uses built-in TypeScript support).

```sh
cd web
npm ci
npm run dev
```

Open the localhost URL printed by Vite. Click **Start camera**, allow camera access, and hold one or two hands in view. **Stop camera** releases the camera and model; **Cancel** cleans up a pending start. Mirror preview only changes the display, not the collected coordinates.

Tracking downloads the versioned MediaPipe WASM runtime from jsDelivr and the hand-landmarker model from Google storage. Internet access is required for those assets. Frames are processed locally. Use localhost or HTTPS for webcam access.

The existing Ably integration reads `ABLY_API_KEY` from the repository-root `.env` and connects to `slideshow:main` on startup. Without that key the relay reports failure, but camera tracking, mappings, and collection still work. The existing Vite configuration exposes this key to the browser, so use only a restricted demo credential; do not publish a private server key or commit `.env`. Production authentication should use server-issued tokens.

## Workspace modes

- **Demo:** camera and sample slideshow side by side. Manual controls update the sample slides and publish commands through the existing Ably relay.
- **Present:** hides the right-side sample slideshow and expands the camera area. This mode does not start PowerPoint or Google Slides; the presenter client and a focused slideshow are still required. Automatic gesture detection remains pending the ML model.
- **Collect data:** replaces the slideshow with a labeled sample recorder. Collection does not publish commands or send samples to Ably. Switching modes pauses recording but keeps collected samples in memory.

## Gesture settings (step 3)

Open **Gesture settings** to choose a command for every label from `shared/gesture_labels.json`. Options come from `shared/command_list.json`, plus **No command**. Changes save immediately under `gesture-studio.mappings.v1` in local storage. Restore defaults resets all mappings. Invalid saved commands are discarded; missing labels receive defaults. If storage is blocked, a visible warning explains that changes are temporary.

Defaults: `none` → no command, `thumbs_up` / `swipe_right` → `NEXT`, `thumbs_down` / `swipe_left` → `PREV`.

These mappings are configuration for the future classifier, not predictions. The future command handler can read `parseMappings(localStorage.getItem(MAPPING_STORAGE_KEY))` from `src/lib/gestureMappings.ts`. An empty command means no action. Manual simulator buttons retain their explicit commands.

## Data collection (step 7)

1. Choose **Collect data** and start the camera.
2. Select a gesture label and which hand to collect. **Single visible hand** requires exactly one hand. Explicit Left/Right uses MediaPipe's handedness label, independent of display mirroring.
3. Click **Record samples**. Hold the labeled pose or perform the full labeled movement; vary position, orientation, and distance naturally.
4. The recorder samples at most 10 times per second and automatically stops at 100 samples for that label. No-hand, ambiguous, and invalid-vector frames are skipped. A recording keeps the same handedness; pause and resume to use the other hand.
5. Pause to change labels or export. Each new recording gets its own ID. Samples remain when you change modes or stop the camera.
6. Export **JSON** or **CSV**. Either download includes every collected label. Export before closing or reloading the tab; samples are held in memory, not local storage. An unload warning appears for unexported changes. **Clear this label** confirms before discarding that label's samples.

For `none`, record a visible hand in neutral/unrelated poses. Empty frames cannot supply 63-value hand vectors and are not fabricated into zero samples.

See [the training-data format](../shared/training-data-format.md) for fields and column ordering. Raw landmarks and frame timestamps are retained to support future sequence analysis: normalized features alone remove translation, so individual normalized frames do not capture the full motion of a swipe. Recording IDs identify takes, not people; train/test splitting should also account for participants and sessions when combining files.

## Implementation

- `src/hooks/useHandTracking.ts`: camera lifecycle and frame callbacks containing Gabe's normalized feature vectors.
- `src/lib/collection.ts`: bounded recorder, sample validation, and JSON/CSV serialization.
- `src/components/DataCollection.tsx`: label selection, progress, recording controls, and downloads.
- `src/lib/gestureMappings.ts` and `src/components/GestureSettings.tsx`: defaults, validation, persistence, and mapping menu.
- `src/App.tsx`: mode selection, recording lifecycle, sample deck, and existing relay integration.

The trained ONNX classifier, confidence thresholds, consecutive-frame confirmation, and cooldown are future ML integration work. The existing normalizer and Python presenter client are unchanged.

## Verification

```sh
npm test
npm run build
npm run lint
```

Tests cover recorder limits, pause/resume, invalid frames, hand selection, label isolation, export ordering, default mappings, and malformed storage.

Manual checks: start/stop the camera; collect 100 valid samples; pause/resume; switch modes while recording; inspect both downloads; change mappings and reload; restore defaults; use a narrow phone viewport. Camera permissions and actual hand tracking require a camera-enabled browser.
