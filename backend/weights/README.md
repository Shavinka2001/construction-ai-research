# Land-Boundary Segmentation Weights (Module 1)

Place the fine-tuned YOLOv8 **segmentation** model here:

```
backend/weights/land_segmentation.pt
```

Override the path with `YOLO_SEG_WEIGHTS_PATH` in `.env` if you keep it elsewhere.

## Fallback chain

`survey_digitization_service.py` resolves a model in this order:

1. `weights/land_segmentation.pt` — your fine-tuned survey-plan model.
2. `yolov8n-seg.pt` — generic COCO segmentation, auto-downloaded by Ultralytics
   (`YOLO_SEG_FALLBACK` in `.env`).
3. Pure-OpenCV contour extraction — used when `ultralytics` / `torch` are not
   installed or produce no usable mask. Still returns a boundary polygon.

Run `python scripts/setup_assets.py` to pre-fetch the fallback and print status.

This file and `*.pt` are git-ignored.
