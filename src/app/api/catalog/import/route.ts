import { NextResponse } from "next/server";
import { requireSessionFromDb } from "@/lib/session";
import { canAccess } from "@/lib/constants";
import { parseCatalogFromFormData, runCatalogImport } from "@/lib/catalog-import";

export async function POST(request: Request) {
  try {
    const session = await requireSessionFromDb();
    if (!canAccess(session.role, ["ADMIN", "MANAGER"])) {
      return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
    }

    const formData = await request.formData();
    const parsed = await parseCatalogFromFormData(formData);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

    const result = await runCatalogImport({
      buffer: parsed.buffer,
      filename: parsed.filename,
      mode: parsed.mode,
      importedBy: session.name,
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.body);
  } catch (error) {
    console.error("Catalog import failed:", error);
    const message = error instanceof Error ? error.message : "Ошибка импорта";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
