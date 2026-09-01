from pydantic import BaseModel, Field


class PredictRequest(BaseModel):
    inspection_text: str = Field(
        ...,
        min_length=1,
        max_length=8000,
        description="Free-text site inspection notes for the ML classifier",
    )


class PredictResponse(BaseModel):
    label: str
    confidence: float | None = None
    probabilities: dict[str, float] | None = None
