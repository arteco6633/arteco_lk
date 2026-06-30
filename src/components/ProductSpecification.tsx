import { StatusBadge } from "@/components/StatusBadge";
import { EdgingDisplay } from "@/components/EdgingDisplay";
import type { PartStatus } from "@prisma/client";
import {
  groupPartsByMaterialSection,
  type SpecificationPart,
} from "@/lib/specification-groups";

function PartsTable({ parts }: { parts: SpecificationPart[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left font-bold text-black border-b">
            <th className="py-2 pr-4">№</th>
            <th className="py-2 pr-4">Поз.</th>
            <th className="py-2 pr-4">Наименование</th>
            <th className="py-2 pr-4">Длина</th>
            <th className="py-2 pr-4">Ширина</th>
            <th className="py-2 pr-4">Кол-во</th>
            <th className="py-2 pr-4">Облицовка</th>
            <th className="py-2 pr-4">Паз</th>
            <th className="py-2 pr-4">Прямоуг.</th>
            <th className="py-2">Статус</th>
          </tr>
        </thead>
        <tbody>
          {parts.map((part) => (
            <tr key={part.id} className="border-b border-slate-100">
              <td className="py-2 pr-4 font-medium text-black">{part.specNumber ?? "—"}</td>
              <td className="py-2 pr-4 font-medium text-black">{part.code ?? "—"}</td>
              <td className="py-2 pr-4 font-medium text-black">{part.name}</td>
              <td className="py-2 pr-4 font-medium text-black">{part.length ?? "—"}</td>
              <td className="py-2 pr-4 font-medium text-black">{part.width ?? "—"}</td>
              <td className="py-2 pr-4 font-medium text-black">{part.quantity}</td>
              <td className="py-2 pr-4 font-medium text-black align-top">
                <EdgingDisplay edging={part.edging} />
              </td>
              <td className="py-2 pr-4 font-medium text-black">{part.groove ?? "—"}</td>
              <td className="py-2 pr-4 font-medium text-black">{part.rectangular ?? "—"}</td>
              <td className="py-2">
                <StatusBadge status={part.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ProductSpecification({
  parts,
}: {
  parts: SpecificationPart[];
}) {
  const sections = groupPartsByMaterialSection(parts);

  if (sections.length === 0) return null;

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <div key={`${section.sectionOrder}-${section.material}`} className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-100 px-4 py-3 border-b border-slate-200">
            <h3 className="font-bold text-black">{section.title}</h3>
            <p className="text-sm font-medium text-black mt-0.5">{section.parts.length} деталей</p>
          </div>
          <div className="p-3">
            <PartsTable parts={section.parts} />
          </div>
        </div>
      ))}

    </div>
  );
}
