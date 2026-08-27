# YOLOv8 Architectural Weights

Place your trained clash-detection weights here:

```
backend/app/models/yolov8_architect.pt
```

The clash-detection service loads this file first. If it is missing, the
pipeline falls back to Ultralytics `yolov8n.pt` plus an OpenCV contour
heuristic so local development still works.
