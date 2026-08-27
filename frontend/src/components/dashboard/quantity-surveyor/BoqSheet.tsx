"use client";

type BoqRow = {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitRate: number;
};

const BOQ_ROWS: BoqRow[] = [
  {
    id: "1",
    description: "Earth Excavation",
    quantity: 450,
    unit: "m³",
    unitRate: 8500,
  },
  {
    id: "2",
    description: "Reinforced Concrete",
    quantity: 280,
    unit: "m³",
    unitRate: 32000,
  },
  {
    id: "3",
    description: "Brickwork",
    quantity: 1200,
    unit: "sqft",
    unitRate: 2850,
  },
  {
    id: "4",
    description: "Doors & Joinery",
    quantity: 24,
    unit: "Nos",
    unitRate: 93750,
  },
];

function formatLkr(value: number): string {
  return value.toLocaleString("en-LK");
}

export function BoqSheet() {
  const grandTotal = BOQ_ROWS.reduce(
    (sum, row) => sum + row.quantity * row.unitRate,
    0
  );

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-luxury">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Automated Take-off
          </p>
          <h2 className="mt-1 text-lg font-bold text-slate-900">
            Bill of Quantities
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            AI-generated BOQ with live market rates
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gold-dark">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold/50" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
          </span>
          Live Pricing Feed Active
        </span>
      </div>

      <div className="flex-1 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Description
              </th>
              <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Quantity
              </th>
              <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Unit
              </th>
              <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Unit Rate (LKR)
              </th>
              <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Total Amount (LKR)
              </th>
            </tr>
          </thead>
          <tbody>
            {BOQ_ROWS.map((row) => {
              const total = row.quantity * row.unitRate;
              return (
                <tr
                  key={row.id}
                  className="border-b border-slate-50 transition-colors hover:bg-gold/[0.03]"
                >
                  <td className="px-5 py-3.5 font-medium text-slate-900">
                    {row.description}
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-slate-700">
                    {formatLkr(row.quantity)}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                      {row.unit}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-slate-600">
                    {formatLkr(row.unitRate)}
                  </td>
                  <td className="px-5 py-3.5 text-right font-semibold tabular-nums text-slate-900">
                    {formatLkr(total)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-900">
              <td
                colSpan={4}
                className="px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-gold"
              >
                Estimated CAPEX Total
              </td>
              <td className="px-5 py-3.5 text-right text-base font-bold tabular-nums text-white">
                <span className="mr-1.5 text-xs font-semibold text-gold">
                  LKR
                </span>
                {formatLkr(grandTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
