import { NextResponse } from "next/server";
import path from "path";
import { StorageProvider } from "@prisma/client";
import { readFileBuffer } from "@/lib/storage";
import { requireSession } from "@/lib/session";

function contentTypeForPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  await requireSession();
  const segments = (await params).path;
  const relativePath = segments.join("/");

  if (relativePath.includes("..")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const providerRaw = searchParams.get("storage");
  const storageProvider: StorageProvider =
    providerRaw === "SUPABASE" ? "SUPABASE" : "LOCAL";

  try {
    const data = await readFileBuffer(relativePath, storageProvider);
    const type = contentTypeForPath(relativePath);

    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": type,
        "Content-Disposition": "inline",
        "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
