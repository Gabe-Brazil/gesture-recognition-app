# Feature Vector Format

`normalizeHand` (`shared/normalizeHand.ts`) turns one hand in one frame into a 63-number feature vector (`FEATURE_VERSION = 1`): 21 MediaPipe landmarks × (x, y, z), flattened as `[x0, y0, z0, x1, y1, z1, ...]`.

Landmark `i` is at positions `3i` (x), `3i + 1` (y), `3i + 2` (z). The wrist is the origin (meaning index 0,1,2 is 0,0,0 (x,y,z)) and one unit is one palm length (wrist to middle knuckle). Left hands are mirrored so every hand looks like a right hand.

## Index map (positions refers to the index of the array 0-62)

| Landmark | Point | Positions |
|---|---|---|
| 0 | Wrist | 0-2 |
| 1 | Thumb CMC | 3-5 |
| 2 | Thumb MCP | 6-8 |
| 3 | Thumb IP | 9-11 |
| 4 | Thumb tip | 12-14 |
| 5 | Index MCP | 15-17 |
| 6 | Index PIP | 18-20 |
| 7 | Index DIP | 21-23 |
| 8 | Index tip | 24-26 |
| 9 | Middle MCP | 27-29 |
| 10 | Middle PIP | 30-32 |
| 11 | Middle DIP | 33-35 |
| 12 | Middle tip | 36-38 |
| 13 | Ring MCP | 39-41 |
| 14 | Ring PIP | 42-44 |
| 15 | Ring DIP | 45-47 |
| 16 | Ring tip | 48-50 |
| 17 | Pinky MCP | 51-53 |
| 18 | Pinky PIP | 54-56 |
| 19 | Pinky DIP | 57-59 |
| 20 | Pinky tip | 60-62 |
