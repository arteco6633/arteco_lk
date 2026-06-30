import { NextResponse } from "next/server";
import { requireSessionFromDb } from "@/lib/session";
import { parseExcelFromFormData, runExcelImport } from "@/lib/excel-import";

export async function POST(request: Request) {
  try {
    await requireSessionFromDb();

    const contentType = request.headers.get("content-type") ?? "";
    let payload;

    if (contentType.includes("application/json")) {
      payload = await request.json();
    } else {
      const formData = await request.formData();
      const parsed = await parseExcelFromFormData(formData);
      if ("error" in parsed) {
        return NextResponse.json({ error: parsed.error }, { status: parsed.status });
      }
      payload = parsed.payload;
    }

    const result = await runExcelImport(payload);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.body);
  } catch (error) {
    console.error("Excel import failed:", error);
    const message =
      error instanceof Error ? error.message : "Неизвестная ошибка при импорте";
    const isPrismaSchema =
      message.includes("Unknown argument") || message.includes("PrismaClient");
    return NextResponse.json(
      {
        error: isPrismaSchema
          ? "Ошибка базы данных. Перезапустите сервер после обновления (npm run dev)."
          : message,
      },
      { status: 500 },
    );
  }
}
