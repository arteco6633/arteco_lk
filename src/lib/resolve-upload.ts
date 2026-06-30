import { StorageProvider } from "@prisma/client";
import { saveFile } from "./storage";

export type ResolvedUpload = {
  filename: string;
  filepath: string;
  storageProvider: StorageProvider;
};

/** Файл из FormData или уже загруженный в Storage (прямая загрузка с клиента) */
export async function resolveUploadFromForm(
  formData: FormData,
  subdir: string,
): Promise<ResolvedUpload | null> {
  const filepath = String(formData.get("filepath") ?? "").trim();
  const filename = String(formData.get("filename") ?? "").trim();
  const providerRaw = String(formData.get("storageProvider") ?? "");

  if (filepath && filename) {
    return {
      filename,
      filepath,
      storageProvider: providerRaw === "SUPABASE" ? "SUPABASE" : "LOCAL",
    };
  }

  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    return saveFile(file, subdir);
  }

  return null;
}
