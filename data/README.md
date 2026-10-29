Only `samples` is NOT git ignored in /data

/samples holds a few tiny landmark recordings used for tests, demos, and trying the code without downloading the full dataset.

/raw is where you download the full set of landmark recordings (JSON) from the shared drive. The ML code in /ml reads training and test data from here.

/videos is where you download the matching video files from the shared drive, used for debugging, checking labels, and re-extracting landmarks.