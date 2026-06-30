import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

function uploadRoot(): string {
  if (process.env.VERCEL) return path.join("/tmp", "mebel-uploads");
  return path.join(process.cwd(), "uploads");
}

export async function saveUpload(
  file: File,
  subdir: string,
): Promise<{ filename: string; filepath: string }> {
  const dir = path.join(uploadRoot(), subdir);
  await mkdir(dir, { recursive: true });

  const ext = path.extname(file.name) || ".bin";
  const storedName = `${randomUUID()}${ext}`;
  const fullPath = path.join(dir, storedName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(fullPath, buffer);

  return {
    filename: file.name,
    filepath: path.join(subdir, storedName),
  };
}

export function uploadAbsolutePath(relativePath: string): string {
  return path.join(uploadRoot(), relativePath);
}

export async function deleteUpload(relativePath: string): Promise<void> {
  try {
    await unlink(uploadAbsolutePath(relativePath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export async function deleteUploads(relativePaths: string[]): Promise<void> {
  await Promise.all(relativePaths.map((p) => deleteUpload(p)));
}
