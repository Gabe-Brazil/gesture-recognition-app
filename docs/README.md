# Repository Structure

/web --> contains Vite App: Will record webcam, scan your hands/arms for gestures, turn each frame into mediapipe coordinates, plug coordinates into our completed AI model (which runs on browser) and relay detected gestures to the backend
<br><br>

/ml --> contains Jupyter notebooks; directory where we test and train our gesture classifier, final models will be exported as ONNX so it can be run in browser
<br><br>

/presenter-client --> contains a Python script: runs on the presenting computer and listens for gesture commands from our backend service and performs key presses/clicks.
<br><br>

/shared --> contains the files that more than one part of the project depends on (gesture labels, command list, message format, normalization test files), so everyone works from the same definitions.
<br><br>

/data --> contains our recordings (hand/arm gestures) and landmarked data for training/testing (will be .gitignored & stored locally). Will also contain small sample data for demos (will not be .gitignored)
<br><br>

/docs --> contains architecture notes
<br><br>

**Note:** We will use a simple lightweight backend service called `Ably`, which essentially functions as an "online chat" server for our presenting device and our web app.
