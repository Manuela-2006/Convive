import type { DocumentUploadPayload } from "./document-upload-types";

export async function fileToDocumentUploadPayload(
  file: File
): Promise<DocumentUploadPayload> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
  const base64 = dataUrl.split(",")[1];

  if (!base64) {
    throw new Error("No se pudo preparar el archivo.");
  }

  return {
    base64,
    mediaType: file.type,
    size: file.size,
  };
}
