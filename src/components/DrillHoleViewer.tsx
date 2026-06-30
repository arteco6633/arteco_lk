"use client";

import { useEffect, useMemo, useState } from "react";
import type { DetailPageDrilling, DrillingHole } from "@/lib/drilling-types";

const HOLE_TYPE_LABELS = {
  through: "сквозное",
  face: "в лицевую",
  unknown: "",
};

export function DrillHoleViewer({
  drilling,
  partName,
}: {
  drilling: DetailPageDrilling;
  partName: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const holes = drilling.holes;
  const activeHole = holes[activeIndex];

  const panelW = drilling.panelWidth ?? 500;
  const panelH = drilling.panelHeight ?? 2095;

  useEffect(() => {
    if (!playing || holes.length === 0) return;
    const timer = setInterval(() => {
      setActiveIndex((i) => (i + 1 < holes.length ? i + 1 : 0));
    }, 1500);
    return () => clearInterval(timer);
  }, [playing, holes.length]);

  const viewBox = useMemo(() => `0 0 ${panelW} ${panelH}`, [panelW, panelH]);

  if (holes.length === 0) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-medium text-black">
        Не удалось распознать отверстия на стр. {drilling.pageNumber}. Откройте PDF
        деталировки ниже.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <p className="font-bold text-black">{partName}</p>
          <p className="text-sm font-medium text-black">
            Стр. {drilling.pageNumber} · {drilling.summary || `${holes.length} отв.`} ·{" "}
            {panelW}×{panelH} мм
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="rounded-lg bg-slate-900 text-white px-3 py-2 text-sm font-bold"
          >
            {playing ? "Пауза" : "▶ Анимация"}
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_280px] gap-0">
        <div className="bg-slate-100 p-4 flex items-center justify-center min-h-[320px]">
          <svg
            viewBox={viewBox}
            className="max-h-[min(60vh,520px)] w-full bg-white border border-slate-300"
            style={{ maxWidth: "100%" }}
          >
            <rect x={0} y={0} width={panelW} height={panelH} fill="#f8fafc" stroke="#334155" strokeWidth={2} />
            {holes.map((hole) => (
              <HoleMarker
                key={hole.index}
                hole={hole}
                panelH={panelH}
                active={hole.index === activeHole?.index}
              />
            ))}
          </svg>
        </div>

        <div className="border-t lg:border-t-0 lg:border-l border-slate-200 p-4 space-y-2 max-h-[520px] overflow-y-auto">
          {holes.map((hole, i) => (
            <button
              key={hole.index}
              type="button"
              onClick={() => {
                setActiveIndex(i);
                setPlaying(false);
              }}
              className={`w-full text-left rounded-lg px-3 py-2 text-sm font-medium border ${
                i === activeIndex
                  ? "border-blue-500 bg-blue-50 text-black"
                  : "border-slate-200 bg-white text-black hover:bg-slate-50"
              }`}
            >
              <span className="font-bold">№{hole.index}</span> · Ø{hole.diameter}
              {hole.depth ? `×${hole.depth}` : ""} · X={hole.x} Y={hole.y}
              {HOLE_TYPE_LABELS[hole.holeType] && (
                <span className="block text-xs mt-0.5">{HOLE_TYPE_LABELS[hole.holeType]}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {activeHole && (
        <div className="px-4 py-3 bg-amber-50 border-t border-amber-200 text-sm font-medium text-black">
          Сейчас: отверстие <strong>№{activeHole.index}</strong> — Ø{activeHole.diameter}
          {activeHole.depth ? `×${activeHole.depth}` : ""} мм, координаты X={activeHole.x}, Y=
          {activeHole.y}
          {HOLE_TYPE_LABELS[activeHole.holeType]
            ? ` (${HOLE_TYPE_LABELS[activeHole.holeType]})`
            : ""}
        </div>
      )}
    </div>
  );
}

function HoleMarker({
  hole,
  panelH,
  active,
}: {
  hole: DrillingHole;
  panelH: number;
  active: boolean;
}) {
  // Базис: начало координат снизу слева → в SVG y сверху
  const cx = hole.x;
  const cy = panelH - hole.y;
  const r = Math.max(hole.diameter * 1.2, 8);

  return (
    <g>
      {active && (
        <circle cx={cx} cy={cy} r={r + 10} fill="none" stroke="#f59e0b" strokeWidth={3} opacity={0.9}>
          <animate attributeName="r" values={`${r + 6};${r + 14};${r + 6}`} dur="1.2s" repeatCount="indefinite" />
        </circle>
      )}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={active ? "#ef4444" : "#64748b"}
        stroke={active ? "#b91c1c" : "#334155"}
        strokeWidth={active ? 2 : 1}
      />
      <text
        x={cx}
        y={cy + 4}
        textAnchor="middle"
        fontSize={Math.max(r, 10)}
        fill="white"
        fontWeight="bold"
      >
        {hole.index}
      </text>
    </g>
  );
}
