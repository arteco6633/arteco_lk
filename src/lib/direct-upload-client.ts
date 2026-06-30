"use client";

import type { StorageProvider } from "@prisma/client";

export type DirectUploadResult = {
  filename: string;
  filepath: string;
  storageProvider: StorageProvider;
};

/** Загрузка через Supabase signed URL — обходит лимит 4.5 MB Vercel */
export async function uploadFileDirect(
  file: File,
  subdir: string,
): Promise<DirectUploadResult | null> {
  const signRes = await fetch("/api/upload/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subdir,
      filename: file.name,
      contentType: file.type || "application/octet-stream",
    }),
  });

  if (signRes.status === 503) return null;

  const signData = await signRes.json().catch(() => ({}));
  if (!signRes.ok) {
    throw new Error(signData.error ?? "Не удалось подготовить загрузку");
  }

  const putRes = await fetch(signData.signedUrl, {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": signData.contentType || file.type || "application/octet-stream",
    },
  });

  if (!putRes.ok) {
    throw new Error(`Ошибка загрузки в Storage (${putRes.status})`);
  }

  return {
    filename: file.name,
    filepath: signData.filepath,
    storageProvider: "SUPABASE",
  };
}

export async function uploadFileWithFallback(
  file: File,
  subdir: string,
  fallbackUrl: string,
  extraForm?: Record<string, string>,
): Promise<{ ok: boolean; usedDirect: boolean }> {
  try {
    const direct = await uploadFileDirect(file, subdir);
    if (direct) {
      const formData = new FormData();
      formData.append("filename", direct.filename);
      formData.append("filepath", direct.filepath);
      formData.append("storageProvider", direct.storageProvider);
      if (extraForm) {
        for (const [k, v] of Object.entries(extraForm)) formData.append(k, v);
      }
      const res = await fetch(fallbackUrl, { method: "POST", body: formData });
      return { ok: res.ok, usedDirect: true };
    }
  } catch {
    // fallback below
  }

  const formData = new FormData();
  formData.append("file", file);
  if (extraForm) {
    for (const [k, v] of Object.entries(extraForm)) formData.append(k, v);
  }
  const res = await fetch(fallbackUrl, { method: "POST", body: formData });
  return { ok: res.ok, usedDirect: false };
}
