import { formatEdgingCode, parseEdging } from "@/lib/edging";

function edgeActive(code: string | undefined): boolean {
  return Boolean(code?.trim());
}

function EdgeBar({
  code,
  label,
  vertical,
}: {
  code?: string;
  label: string;
  vertical?: boolean;
}) {
  const active = edgeActive(code);
  return (
    <div
      className={`flex items-center justify-center ${vertical ? "flex-col w-5 shrink-0" : "flex-row h-5 w-full"}`}
      title={active ? `${label}: кромка ${code}` : `${label}: без кромки`}
    >
      {vertical ? (
        <>
          <span
            className={`w-1.5 flex-1 min-h-[2.5rem] rounded-full ${active ? "bg-amber-500" : "bg-slate-200"}`}
          />
          {active && (
            <span className="text-[9px] font-bold text-amber-900 leading-none mt-0.5">{code}</span>
          )}
          <span className="text-[8px] font-medium text-slate-500 leading-none mt-0.5">{label}</span>
        </>
      ) : (
        <>
          <span className="text-[8px] font-medium text-slate-500 w-7 shrink-0">{label}</span>
          <span
            className={`h-1.5 flex-1 rounded-full ${active ? "bg-amber-500" : "bg-slate-200"}`}
          />
          {active && (
            <span className="text-[9px] font-bold text-amber-900 w-6 text-right shrink-0">{code}</span>
          )}
        </>
      )}
    </div>
  );
}

export function EdgingDisplay({
  edging,
  compact = false,
}: {
  edging: string | null | undefined;
  compact?: boolean;
}) {
  const parsed = parseEdging(edging);

  if (!parsed) {
    return <span className="text-slate-400">—</span>;
  }

  const { L1, L2, W1, W2 } = parsed.sides;

  if (compact) {
    const active = [L1, L2, W1, W2].filter(Boolean) as NonNullable<typeof L1>[];
    return (
      <div className="group relative inline-block">
        <EdgingDiagram L1={L1} L2={L2} W1={W1} W2={W2} small />
        <div className="pointer-events-none absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block group-focus-within:block">
          <div className="rounded-lg bg-slate-900 text-white text-xs px-2 py-1.5 whitespace-nowrap shadow-lg">
            {active.map((s) => formatEdgingCode(s)).join(" · ")}
            {parsed.extra.length > 0 && ` · ${parsed.extra.join(", ")}`}
            <div className="text-[10px] text-slate-300 mt-0.5 font-mono">{parsed.raw}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col items-stretch gap-0.5 min-w-[9rem]">
      <EdgeBar code={L2?.code} label="верх" />
      <div className="flex items-stretch gap-1">
        <EdgeBar code={W1?.code} label="лево" vertical />
        <div className="flex-1 min-w-[3.5rem] min-h-[3.5rem] rounded-md border border-slate-300 bg-slate-50 flex items-center justify-center">
          <span className="text-[10px] font-medium text-slate-500 text-center leading-tight px-1">
            лицевая
            <br />
            пласть
          </span>
        </div>
        <EdgeBar code={W2?.code} label="право" vertical />
      </div>
      <EdgeBar code={L1?.code} label="низ" />
      {parsed.extra.length > 0 && (
        <p className="text-[10px] font-medium text-slate-500 mt-0.5">{parsed.extra.join(" ")}</p>
      )}
      <p className="text-[10px] font-mono text-slate-400 mt-0.5" title="Как в Excel">
        {parsed.raw}
      </p>
    </div>
  );
}

function EdgingDiagram({
  L1,
  L2,
  W1,
  W2,
  small,
}: {
  L1?: { code: string };
  L2?: { code: string };
  W1?: { code: string };
  W2?: { code: string };
  small?: boolean;
}) {
  const box = small ? "w-10 h-8" : "w-20 h-14";
  const border = (active: boolean) =>
    active ? "border-amber-500 border-[3px]" : "border-slate-200 border";

  return (
    <div className={`relative ${box} bg-slate-50 rounded-sm ${border(false)}`}>
      <div
        className={`absolute top-0 left-0 right-0 h-0.5 ${edgeActive(L2?.code) ? "bg-amber-500" : "bg-slate-200"}`}
      />
      <div
        className={`absolute bottom-0 left-0 right-0 h-0.5 ${edgeActive(L1?.code) ? "bg-amber-500" : "bg-slate-200"}`}
      />
      <div
        className={`absolute top-0 bottom-0 left-0 w-0.5 ${edgeActive(W1?.code) ? "bg-amber-500" : "bg-slate-200"}`}
      />
      <div
        className={`absolute top-0 bottom-0 right-0 w-0.5 ${edgeActive(W2?.code) ? "bg-amber-500" : "bg-slate-200"}`}
      />
    </div>
  );
}
