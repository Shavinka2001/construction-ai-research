import { NextResponse } from "next/server";
import type { CompliancePrediction } from "@/lib/compliance-types";

const SERVICE_URL =
  process.env.COMPLIANCE_SERVICE_URL ?? "http://localhost:8002";

export async function POST(request: Request) {
  let body: { inspection_text?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const inspectionText = body.inspection_text?.trim();
  if (!inspectionText) {
    return NextResponse.json(
      { error: "inspection_text is required" },
      { status: 422 }
    );
  }

  try {
    const upstream = await fetch(`${SERVICE_URL}/api/predict-compliance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inspection_text: inspectionText }),
      cache: "no-store",
    });

    const data = (await upstream.json()) as CompliancePrediction & {
      detail?: string | { msg?: string }[];
    };

    if (!upstream.ok) {
      const detail =
        typeof data.detail === "string"
          ? data.detail
          : Array.isArray(data.detail)
            ? data.detail[0]?.msg
            : "Upstream compliance service error";

      return NextResponse.json({ error: detail ?? "Prediction failed" }, {
        status: upstream.status,
      });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      {
        error:
          "Compliance ML service is unavailable. Start it with: uvicorn main:app --reload --port 8002",
      },
      { status: 503 }
    );
  }
}
