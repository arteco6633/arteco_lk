import { NextResponse } from "next/server";
import path from "path";
import { randomUUID } from "crypto";
import { createSupabaseAdmin, DOCUMENTS_BUCKET, isSupabaseStorageEnabled } from "@/lib/supabase-server";
import { requireSessionFromDb } from "@/lib/session";

export async function POST(request: Request) {
  try {
    await requireSessionFromDb();

    if (!isSupabaseStorageEnabled()) {
      return NextResponse.json(
        { error: "Прямая загрузка недоступна — используйте обычный upload" },
        { status: 503 },
      );
    }

    const body = await request.json();
    const subdir = String(body.subdir ?? "").replace(/\.\./g, "");
    const filename = String(body.filename ?? "file.bin");
    const contentType = String(body.contentType ?? "application/octet-stream");

    if (!subdir) {
      return NextResponse.json({ error: "subdir обязателен" }, { status: 400 });
    }

    const ext = path.extname(filename) || ".bin";
    const storedName = `${randomUUID()}${ext}`;
    const filepath = path.posix.join(subdir, storedName);

    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUploadUrl(filepath);

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Не удалось создать ссылку для загрузки" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      filepath,
      signedUrl: data.signedUrl,
      token: data.token,
      contentType,
      storageProvider: "SUPABASE",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Нужно войти в систему" }, { status: 401 });
    }
    console.error("Signed upload error:", error);
    return NextResponse.json({ error: "Ошибка подготовки загрузки" }, { status: 500 });
  }
}
