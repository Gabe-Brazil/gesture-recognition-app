# Training-data export format (schema 1)

The web collection mode records up to 100 valid hand samples per gesture at a maximum of 10 Hz. It consumes the existing `useHandTracking` callback; it does not change normalization or emit commands.

## JSON

The export is an object with:

- `schema_version`: `1` (this document).
- `feature_version`: the `FEATURE_VERSION` from `normalizeHand.ts` (currently `1`).
- `feature_length`: `63`.
- `exported_at`: ISO timestamp.
- `sample_interval_ms`: `100`, a minimum spacing, not a guaranteed frame interval.
- `labels`: the shared label IDs and names.
- `samples`: an array of sample objects in capture order, across all recorded labels.

Each sample contains:

| Field | Meaning |
|---|---|
| `label`, `label_id` | User-selected ground-truth label from `gesture_labels.json`; not a prediction. |
| `recording_id` | UUID generated every time Record is pressed. Use this to group one continuous take. |
| `sample_index` | Zero-based accepted sample index within that recording. |
| `captured_at` | Wall-clock milliseconds since Unix epoch. |
| `frame_timestamp_ms` | The callback's monotonic camera-frame timestamp. Compare within a recording; not across browser sessions. |
| `feature_version` | Normalizer version used for this sample. |
| `handedness` | MediaPipe's `Left` or `Right` label before normalization. |
| `aspect` | Source video width divided by height. |
| `features` | 63 finite normalized numbers, copied unchanged from the hook. See `feature-vector-format.md`. |
| `raw` | 21 copied `{x, y, z}` image-space landmarks before normalization. These are unmirrored by the UI. |

No image or video pixels are exported. Exports are downloaded locally; the recorder does not upload them.

## CSV

One header row and one row per sample, with CRLF line endings. Column order:

1. `label,label_id,recording_id,sample_index,captured_at,frame_timestamp_ms,feature_version,handedness,aspect`
2. `feature_0` through `feature_62` (same order as JSON `features`).
3. `raw_0_x,raw_0_y,raw_0_z` through `raw_20_x,raw_20_y,raw_20_z`.

There are 135 columns. Values are CSV quoted; a standard CSV reader should parse numeric fields as numbers as needed. The schema is fixed by this document; the normalizer version is present in every row.

## Capture behavior

- Only one matching hand is accepted per frame. The default rejects frames containing multiple hands; an explicit handedness selection can pick one of two hands.
- A take locks its handedness after the first valid sample. Switching hands requires pausing and starting a new take.
- Null, non-finite, or incorrectly sized vectors and invalid raw landmarks are rejected. Frames without a hand are skipped, including when the label is `none`.
- The `none` class represents a visible hand doing a neutral/unrelated gesture. It is not a synthetic all-zero vector.
- Switching modes or stopping the camera pauses capture. Existing samples remain until reload/close or confirmed clearing.
- A new recording resets frame timing and gets a new ID, even when resuming the same label after a camera restart.
- Normalization removes position and scale. For swipe classification, preserve and inspect raw landmark trajectories and ordered timestamps; isolated normalized frames do not encode translation. No sequence window or model architecture is assumed by this exporter.
- The 100-sample target is a collection milestone, not a claim that one take is enough training data. Collect varied poses, people, and sessions. Avoid placing near-identical frames from the same recording in both training and evaluation sets.
