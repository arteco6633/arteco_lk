import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { uploadAbsolutePath } from "@/lib/uploads";
import { requireSessionFromDb } from "@/lib/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  await requireSessionFromDb();
  const segments = (await params).path;
  const relativePath = segments.join("/");

  if (relativePath.includes("..")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const fullPath = uploadAbsolutePath(relativePath);
    const data = await readFile(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    const type =
      ext === ".pdf"
        ? "application/pdf"
        : ext === ".png"
          ? "image/png"
          : ext === ".jpg" || ext === ".jpeg"
            ? "image/jpeg"
            : "application/octet-stream";

    return new NextResponse(data, {
      headers: {
        "Content-Type": type,
        "Content-Disposition": ext === ".pdf" ? "inline" : "inline",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
