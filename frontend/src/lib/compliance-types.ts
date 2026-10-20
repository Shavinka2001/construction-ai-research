/** Semantic compliance labels returned by the ML classifier. */
export type ComplianceLabel =
  | "Compliant"
  | "Pending Approval"
  | "Minor Violation"
  | "High Risk Violation";

export type CompliancePrediction = {
  label: ComplianceLabel | string;
  confidence: number | null;
  probabilities: Record<string, number> | null;
};

export type ComplianceLabelTone = "success" | "warning" | "danger" | "neutral";

export const COMPLIANCE_LABEL_TONES: Record<string, ComplianceLabelTone> = {
  Compliant: "success",
  "Pending Approval": "warning",
  "Minor Violation": "warning",
  "High Risk Violation": "danger",
};

export function complianceLabelTone(label: string): ComplianceLabelTone {
  return COMPLIANCE_LABEL_TONES[label] ?? "neutral";
}

export function formatConfidence(confidence: number | null): string {
  if (confidence == null) return "—";
  return `${Math.round(confidence * 100)}%`;
}
