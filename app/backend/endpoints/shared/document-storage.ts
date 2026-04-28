import { DOCUMENT_MAX_FILE_SIZE_BYTES } from "../../../../lib/ticket-scanner-types";
import type { DocumentUploadPayload } from "../../../../lib/document-upload-types";

export const DOCUMENTS_BUCKET = "convive-documents";
export const DOCUMENT_SIGNED_URL_TTL_SECONDS = 5 * 60;

const EXTENSION_BY_MEDIA_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function getDocumentFileExtension(mediaType: string) {
  return EXTENSION_BY_MEDIA_TYPE[mediaType] ?? null;
}

export function validateDocumentUploadPayload(document: DocumentUploadPayload) {
  const extension = getDocumentFileExtension(document.mediaType);
  if (!extension) {
    throw new Error("Formato no permitido. Usa JPG, PNG o WEBP.");
  }

  if (
    !Number.isFinite(document.size) ||
    document.size <= 0 ||
    document.size > DOCUMENT_MAX_FILE_SIZE_BYTES
  ) {
    throw new Error("El archivo es demasiado grande. Máximo 10MB.");
  }

  const buffer = Buffer.from(document.base64, "base64");
  if (!buffer.length || buffer.length > DOCUMENT_MAX_FILE_SIZE_BYTES) {
    throw new Error("El archivo no es válido o supera el tamano máximo.");
  }

  if (Math.abs(buffer.length - document.size) > 8) {
    throw new Error("El tamano del archivo no coincide con el contenido.");
  }

  if (!hasExpectedImageSignature(buffer, document.mediaType)) {
    throw new Error("El contenido del archivo no coincide con el tipo indicado.");
  }

  return {
    buffer,
    extension,
  };
}

export function buildTicketDocumentPath(input: {
  houseId: string;
  expenseId: string;
  extension: string;
}) {
  return `house/${input.houseId}/expenses/${input.expenseId}/ticket/${crypto.randomUUID()}.${input.extension}`;
}

export function buildInvoiceDocumentPath(input: {
  houseId: string;
  expenseId: string;
  extension: string;
}) {
  return `house/${input.houseId}/invoices/${input.expenseId}/invoice/${crypto.randomUUID()}.${input.extension}`;
}

function hasExpectedImageSignature(buffer: Buffer, mediaType: string) {
  if (mediaType === "image/jpeg" || mediaType === "image/jpg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (mediaType === "image/png") {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  if (mediaType === "image/webp") {
    return (
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP"
    );
  }

  return false;
}

