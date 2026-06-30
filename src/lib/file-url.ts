import type { StorageProvider } from "@prisma/client";

/** URL для скачивания/просмотра файла через API (безопасно для client components) */
export function fileApiUrl(
  filepath: string,
  storageProvider: StorageProvider = "LOCAL",
): string {
  const base = `/api/files/${filepath}`;
  return storageProvider === "SUPABASE" ? `${base}?storage=SUPABASE` : base;
}
