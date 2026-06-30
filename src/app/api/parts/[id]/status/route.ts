import { NextResponse } from "next/server";
import { PartStatus } from "@prisma/client";
import { requireSessionFromDb } from "@/lib/session";
import { transitionPartStatus } from "@/lib/parts";
import { saveUpload } from "@/lib/uploads";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireSessionFromDb();
  const { id } = await params;
  const formData = await request.formData();
  const status = formData.get("status") as PartStatus;
  const comment = String(formData.get("comment") ?? "") || undefined;
  const photo = formData.get("photo");

  let drillPhotoPath: string | undefined;
  if (photo instanceof File && photo.size > 0) {
    const saved = await saveUpload(photo, `drill/${id}`);
    drillPhotoPath = saved.filepath;
  }

  try {
    await transitionPartStatus({
      partId: id,
      user,
      toStatus: status,
      comment,
      drillPhotoPath,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка" },
      { status: 400 },
    );
  }
}
