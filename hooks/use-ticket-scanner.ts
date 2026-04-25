"use client";

import { useState } from "react";
import Tesseract from "tesseract.js";

import type { TicketScannerData } from "../lib/ticket-scanner-types";
import {
  DOCUMENT_MAX_FILE_SIZE_BYTES,
  SCANNER_ALLOWED_MEDIA_TYPES,
} from "../lib/ticket-scanner-types";

type UseTicketScannerReturn = {
  scanning: boolean;
  progress: number;
  error: string | null;
  scanFile: (file: File) => Promise<TicketScannerData | null>;
};

export type TicketScanMode = "ocr" | "vision";

type UseTicketScannerOptions = {
  scanMode?: TicketScanMode;
};

async function toFileBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result ?? "");
      const payload = value.split(",")[1];
      if (!payload) {
        reject(new Error("No se pudo leer el archivo."));
        return;
      }
      resolve(payload);
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
}

export function useTicketScanner({
  scanMode = "ocr",
}: UseTicketScannerOptions = {}): UseTicketScannerReturn {
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const scanFile = async (file: File): Promise<TicketScannerData | null> => {
    setScanning(true);
    setError(null);
    setProgress(0);

    try {
      const allowedTypes = new Set<string>(SCANNER_ALLOWED_MEDIA_TYPES);
      if (!allowedTypes.has(file.type)) {
        throw new Error("Formato no soportado. Usa JPG, PNG o WEBP.");
      }

      if (file.size > DOCUMENT_MAX_FILE_SIZE_BYTES) {
        throw new Error("El archivo es demasiado grande. Maximo 10MB.");
      }

      const shouldUseVisionDirect =
        scanMode === "vision";
      let extractedText = "";

      if (!shouldUseVisionDirect) {
        setProgress(10);
        const ocrResult = await Tesseract.recognize(file, "spa+eng", {
          logger: (message) => {
            if (message.status === "recognizing text") {
              setProgress(Math.min(75, Math.round(10 + message.progress * 60)));
            }
          },
        });

        extractedText = ocrResult.data.text?.trim() ?? "";
        if (extractedText.length < 10) {
          throw new Error(
            "No se pudo extraer texto del archivo. Asegurate de que sea legible."
          );
        }
      } else {
        setProgress(65);
      }

      setProgress(80);
      const fileBase64 = await toFileBase64(file);

      const res = await fetch("/api/scan-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: extractedText,
          fileBase64,
          mediaType: file.type,
          fileName: file.name,
          scanMode,
        }),
      });

      const payload = (await res.json()) as {
        success?: boolean;
        data?: TicketScannerData;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(payload.error ?? "Error al procesar el archivo.");
      }

      if (!payload.success || !payload.data) {
        throw new Error(payload.error ?? "Error desconocido.");
      }

      setProgress(100);
      return payload.data;
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : "Error desconocido.";
      const message =
        /failed to fetch|networkerror|internet_disconnected|load failed/i.test(
          rawMessage
        )
          ? "Sin conexion a internet. Revisa tu red y vuelve a intentar."
          : rawMessage;
      setError(message);
      return null;
    } finally {
      setScanning(false);
    }
  };

  return { scanning, progress, error, scanFile };
}
