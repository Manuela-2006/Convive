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

const AVATAR_EXTENSION_BY_MEDIA_TYPE: Record<string, string> = {
  ...EXTENSION_BY_MEDIA_TYPE,
  "image/svg+xml": "svg",
};

const PDF_EXTENSION_BY_MEDIA_TYPE: Record<string, string> = {
  "application/pdf": "pdf",
};

export function getDocumentFileExtension(mediaType: string) {
  return EXTENSION_BY_MEDIA_TYPE[mediaType] ?? null;
}

export function validateDocumentUploadPayload(document: DocumentUploadPayload) {
  return validateImageUploadPayload(document, {
    extensionByMediaType: EXTENSION_BY_MEDIA_TYPE,
    invalidFormatMessage: "Formato no permitido. Usa JPG, PNG o WEBP.",
  });
}

export function validateProfileAvatarUploadPayload(document: DocumentUploadPayload) {
  return validateImageUploadPayload(document, {
    extensionByMediaType: AVATAR_EXTENSION_BY_MEDIA_TYPE,
    invalidFormatMessage: "Formato no permitido. Usa JPG, PNG, WEBP o SVG.",
  });
}

export function validatePdfUploadPayload(document: DocumentUploadPayload) {
  return validateImageUploadPayload(document, {
    extensionByMediaType: PDF_EXTENSION_BY_MEDIA_TYPE,
    invalidFormatMessage: "Formato no permitido. Usa PDF.",
  });
}

function validateImageUploadPayload(
  document: DocumentUploadPayload,
  options: {
    extensionByMediaType: Record<string, string>;
    invalidFormatMessage: string;
  }
) {
  const extension = options.extensionByMediaType[document.mediaType] ?? null;
  if (!extension) {
    throw new Error(options.invalidFormatMessage);
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

export function buildHouseMemberContractPath(input: {
  houseId: string;
  profileId: string;
}) {
  return `house/${input.houseId}/members/${input.profileId}/contract/${crypto.randomUUID()}.pdf`;
}

function hasExpectedImageSignature(buffer: Buffer, mediaType: string) {
  if (mediaType === "application/pdf") {
    return buffer.toString("ascii", 0, 5) === "%PDF-";
  }

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

  if (mediaType === "image/svg+xml") {
    const svgText = buffer.toString("utf8").trimStart();
    const normalizedSvgText = svgText.toLowerCase();

    return (
      (normalizedSvgText.startsWith("<svg") ||
        (normalizedSvgText.startsWith("<?xml") &&
          normalizedSvgText.includes("<svg"))) &&
      !normalizedSvgText.includes("<script") &&
      !/\son[a-z]+\s*=/.test(normalizedSvgText) &&
      !normalizedSvgText.includes("javascript:")
    );
  }

  return false;
}

