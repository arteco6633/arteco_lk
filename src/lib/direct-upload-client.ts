"use client";

import { createClient } from "@supabase/supabase-js";
import type { StorageProvider } from "@prisma/client";

export type DirectUploadResult = {
  filename: string;
  filepath: string;
  storageProvider: StorageProvider;
};

const DOCUMENTS_BUCKET = "documents";

function createBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key);
}

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

  const supabase = createBrowserSupabase();
  const token = String(signData.token ?? "");
  const filepath = String(signData.filepath ?? "");

  if (!supabase || !token || !filepath) {
    throw new Error("Storage не настроен для прямой загрузки");
  }

  const contentType = signData.contentType || file.type || "application/octet-stream";

  const { error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .uploadToSignedUrl(filepath, token, file, {
      contentType,
      cacheControl: "3600",
      upsert: true,
    });

  if (error) {
    throw new Error(error.message);
  }

  return {
    filename: file.name,
    filepath,
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
