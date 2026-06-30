import { mkdir, unlink, writeFile, readFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { StorageProvider } from "@prisma/client";
import {
  createSupabaseAdmin,
  DOCUMENTS_BUCKET,
  isSupabaseStorageEnabled,
} from "./supabase-server";

function uploadRoot(): string {
  if (process.env.VERCEL) return path.join("/tmp", "mebel-uploads");
  return path.join(process.cwd(), "uploads");
}

export type SavedFile = {
  filename: string;
  filepath: string;
  storageProvider: StorageProvider;
};

export async function saveFile(file: File, subdir: string): Promise<SavedFile> {
  const ext = path.extname(file.name) || ".bin";
  const storedName = `${randomUUID()}${ext}`;
  const filepath = path.posix.join(subdir, storedName);
  const buffer = Buffer.from(await file.arrayBuffer());

  if (isSupabaseStorageEnabled()) {
    const supabase = createSupabaseAdmin();
    const { error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(filepath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (error) throw new Error(`Supabase Storage: ${error.message}`);
    return { filename: file.name, filepath, storageProvider: "SUPABASE" };
  }

  const dir = path.join(uploadRoot(), subdir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, storedName), buffer);
  return { filename: file.name, filepath, storageProvider: "LOCAL" };
}

export async function readFileBuffer(
  filepath: string,
  storageProvider: StorageProvider = "LOCAL",
): Promise<Buffer> {
  if (storageProvider === "SUPABASE" && isSupabaseStorageEnabled()) {
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .download(filepath);
    if (error || !data) {
      throw new Error(error?.message ?? "Файл не найден в Storage");
    }
    return Buffer.from(await data.arrayBuffer());
  }

  const fullPath = path.join(uploadRoot(), filepath);
  return readFile(fullPath);
}

export async function deleteFile(
  filepath: string,
  storageProvider: StorageProvider = "LOCAL",
): Promise<void> {
  if (storageProvider === "SUPABASE" && isSupabaseStorageEnabled()) {
    const supabase = createSupabaseAdmin();
    const { error } = await supabase.storage.from(DOCUMENTS_BUCKET).remove([filepath]);
    if (error) throw new Error(error.message);
    return;
  }

  try {
    await unlink(path.join(uploadRoot(), filepath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export async function deleteFiles(
  files: { filepath: string; storageProvider?: StorageProvider }[],
): Promise<void> {
  const localPaths: string[] = [];
  const supabasePaths: string[] = [];

  for (const f of files) {
    if (f.storageProvider === "SUPABASE" && isSupabaseStorageEnabled()) {
      supabasePaths.push(f.filepath);
    } else {
      localPaths.push(f.filepath);
    }
  }

  if (supabasePaths.length > 0 && isSupabaseStorageEnabled()) {
    const supabase = createSupabaseAdmin();
    await supabase.storage.from(DOCUMENTS_BUCKET).remove(supabasePaths);
  }

  await Promise.all(localPaths.map((p) => deleteFile(p, "LOCAL")));
}

/** @deprecated use saveFile */
export async function saveUpload(file: File, subdir: string) {
  const saved = await saveFile(file, subdir);
  return { filename: saved.filename, filepath: saved.filepath };
}

/** @deprecated use readFileBuffer */
export function uploadAbsolutePath(relativePath: string): string {
  return path.join(uploadRoot(), relativePath);
}

/** @deprecated use deleteFile */
export async function deleteUpload(relativePath: string): Promise<void> {
  await deleteFile(relativePath, "LOCAL");
}

/** @deprecated use deleteFiles */
export async function deleteUploads(relativePaths: string[]): Promise<void> {
  await Promise.all(relativePaths.map((p) => deleteFile(p, "LOCAL")));
}
