import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";

export async function exportBackupFile(
  text: string,
  extension: "json" | "csv",
) {
  const file = new File(
    Paths.cache,
    `clocked-paid-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`,
  );
  try {
    file.write(text);
    if (!(await Sharing.isAvailableAsync()))
      throw new Error("File sharing is not available on this device.");
    await Sharing.shareAsync(file.uri, {
      mimeType: extension === "json" ? "application/json" : "text/csv",
      UTI:
        extension === "json"
          ? "public.json"
          : "public.comma-separated-values-text",
    });
  } finally {
    if (file.exists) file.delete();
  }
}
export async function pickBackupFile() {
  const result = await DocumentPicker.getDocumentAsync({
    type: [
      "application/json",
      "text/csv",
      "text/comma-separated-values",
      "public.comma-separated-values-text",
    ],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0]!;
  const file = new File(asset.uri);
  try {
    if (file.size > 10 * 1024 * 1024)
      throw new Error("Backup exceeds the 10 MB limit.");
    return { name: asset.name, text: await file.text() };
  } finally {
    if (asset.uri.startsWith(Paths.cache.uri) && file.exists) file.delete();
  }
}
