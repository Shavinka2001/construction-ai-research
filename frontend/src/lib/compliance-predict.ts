import type { CompliancePrediction } from "@/lib/compliance-types";

export type PredictCompliancePayload = {
  inspection_text: string;
};

export class CompliancePredictError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "CompliancePredictError";
    this.status = status;
  }
}

/**
 * Client-side helper — calls the Next.js proxy route (never the Python service
 * directly) so COMPLIANCE_SERVICE_URL stays server-side.
 */
export async function predictCompliance(
  inspectionText: string
): Promise<CompliancePrediction> {
  const response = await fetch("/api/predict-compliance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inspection_text: inspectionText } satisfies PredictCompliancePayload),
  });

  const body = (await response.json()) as CompliancePrediction & { error?: string };

  if (!response.ok) {
    throw new CompliancePredictError(
      body.error ?? "Compliance prediction failed",
      response.status
    );
  }

  return {
    label: body.label,
    confidence: body.confidence ?? null,
    probabilities: body.probabilities ?? null,
  };
}
