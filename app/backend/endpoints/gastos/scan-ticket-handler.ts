import Groq from "groq-sdk";
import { NextRequest } from "next/server";

import type { TicketScannerData } from "../../../../lib/ticket-scanner-types";
import {
  DOCUMENT_MAX_FILE_SIZE_BYTES,
  SCANNER_ALLOWED_MEDIA_TYPES,
} from "../../../../lib/ticket-scanner-types";

type ScanTicketPayload = {
  text?: string;
  fileBase64?: string;
  mediaType?: string;
  fileName?: string;
  scanMode?: "ocr" | "vision";
};

export const runtime = "nodejs";

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  return new Groq({ apiKey });
}

function isGroqInvalidApiKeyError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const payload = error as {
    status?: number;
    error?: { error?: { code?: string } };
  };

  return (
    payload.status === 401 ||
    payload.error?.error?.code === "invalid_api_key"
  );
}

function extractJsonObject(raw: string): TicketScannerData {
  const cleanedRaw = raw.replace(/```json|```/gi, "").trim();

  try {
    return JSON.parse(cleanedRaw) as TicketScannerData;
  } catch {
    const firstBrace = cleanedRaw.indexOf("{");
    const lastBrace = cleanedRaw.lastIndexOf("}");

    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(
        cleanedRaw.slice(firstBrace, lastBrace + 1)
      ) as TicketScannerData;
    }

    throw new Error("Respuesta de IA no valida.");
  }
}

function normalizeGroqPayload(input: unknown): TicketScannerData {
  if (!input || typeof input !== "object") {
    throw new Error("Respuesta JSON vacía o inválida.");
  }

  const payload = input as Record<string, unknown>;
  const tipo = payload.tipo;
  if (tipo !== "ticket" && tipo !== "factura" && tipo !== "desconocido") {
    throw new Error("El JSON no contiene un campo tipo válido.");
  }

  return payload as unknown as TicketScannerData;
}

function expandTicketItemsByUnits(data: TicketScannerData): TicketScannerData {
  if (data.tipo !== "ticket" || !Array.isArray(data.articulos)) {
    return data;
  }

  const expanded = (data.articulos as Array<Record<string, unknown>>).flatMap(
    (rawItem) => {
      const nombre = String(rawItem?.nombre ?? "").trim();
      if (!nombre) {
        return [];
      }

      const rawPrecio = rawItem?.precio;
      const precio =
        typeof rawPrecio === "number" && Number.isFinite(rawPrecio)
          ? rawPrecio
          : 0;

      const rawUnidades = rawItem?.unidades;
      const unidades =
        typeof rawUnidades === "number" && Number.isFinite(rawUnidades)
          ? Math.max(1, Math.floor(rawUnidades))
          : 1;

      return Array.from({ length: unidades }, () => ({ nombre, precio }));
    }
  );

  return {
    ...data,
    articulos: expanded,
  };
}

export async function POST(req: NextRequest) {
  try {
    const groqClient = getGroqClient();
    if (!groqClient) {
      return Response.json(
        {
          success: false,
          error: "Falta GROQ_API_KEY en variables de entorno (.env.local).",
        },
        { status: 500 }
      );
    }

    const payload = (await req.json()) as ScanTicketPayload;
    const { text, fileBase64, mediaType } = payload;
    const scanMode = payload.scanMode === "vision" ? "vision" : "ocr";

    if (!fileBase64 || !mediaType) {
      return Response.json(
        { success: false, error: "Faltan datos" },
        { status: 400 }
      );
    }

    if (!(SCANNER_ALLOWED_MEDIA_TYPES as readonly string[]).includes(mediaType)) {
      return Response.json(
        { success: false, error: "Formato no permitido. Usa JPG, PNG o WEBP." },
        { status: 400 }
      );
    }

    const fileSize = Buffer.byteLength(fileBase64, "base64");
    if (fileSize <= 0 || fileSize > DOCUMENT_MAX_FILE_SIZE_BYTES) {
      return Response.json(
        { success: false, error: "El archivo es demasiado grande. Máximo 10MB." },
        { status: 400 }
      );
    }

    const shouldUseVisionDirect = scanMode === "vision";
    if (!shouldUseVisionDirect && (!text || text.trim().length < 5)) {
      return Response.json(
        { success: false, error: "Falta texto OCR para procesar el documento." },
        { status: 400 }
      );
    }

    const systemPrompt =
      "Eres un asistente experto en extraer datos estructurados de tickets de compra y facturas. " +
      "Siempre devuelves únicamente JSON válido, sin texto adicional, sin bloques de código markdown.";
    const userPrompt = `Analiza este documento de ticket de compra o factura.
Puede haber errores de lectura. Interpreta con sentido común.
Devuelve UNICAMENTE un objeto JSON válido, sin texto antes ni después, sin bloques de código markdown.

Si es un ticket de compra:
{
  "tipo": "ticket",
  "comercio": "nombre del comercio o null",
  "fecha": "DD/MM/YYYY o null",
  "importe_total": número o null,
  "articulos": [{ "nombre": "string", "precio": número o null, "unidades": entero }]
}

Reglas obligatorias para "articulos" en tickets:
- Debes extraer SOLO las líneas de producto que aparezcan literalmente en el ticket.
- No inventes articulos ni completes huecos.
- No normalices ni corrijas nombres: copia el texto tal cual se ve.
- Excluye líneas que no sean productos (TOTAL, IVA, SUBTOTAL, CAMBIO, TARJETA, etc.).
- Si una linea de producto indica varias unidades, pon ese valor en "unidades".
- Si no se ve cantidad explícita, usa "unidades": 1.

Si es una factura (luz, agua, wifi, gas, alquiler):
{
  "tipo": "factura",
  "comercio": "nombre de la compañía o null",
  "categoria": "luz | agua | wifi | gas | alquiler | otro",
  "fecha": "DD/MM/YYYY o null",
  "periodo": "descripción del periodo o null",
  "importe_total": número o null
}

Si no puedes determinar con seguridad un campo, devuelve null para ese campo.
Si el texto no corresponde a ticket ni factura, devuelve: { "tipo": "desconocido" }`;

    const completion = await groqClient.chat.completions.create({
      model: shouldUseVisionDirect
        ? "meta-llama/llama-4-scout-17b-16e-instruct"
        : "llama-3.3-70b-versatile",
      messages: shouldUseVisionDirect
        ? ([
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mediaType};base64,${fileBase64}`,
                  },
                },
                {
                  type: "text",
                  text: userPrompt,
                },
              ],
            },
          ] as never)
        : [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `${userPrompt}

Texto OCR del documento:
"""
${text}
"""`,
            },
          ],
      temperature: 0,
      max_tokens: 1400,
    });

    const rawText = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!rawText) {
      throw new Error("No se obtuvo respuesta.");
    }

    let data: TicketScannerData;
    try {
      const clean = rawText.replace(/```json|```/gi, "").trim();
      data = normalizeGroqPayload(JSON.parse(clean));
    } catch {
      data = normalizeGroqPayload(extractJsonObject(rawText));
    }
    data = expandTicketItemsByUnits(data);

    return Response.json({
      success: true,
      data: data satisfies TicketScannerData,
    });
  } catch (error) {
    console.error("Error en scan-ticket:", error);

    if (isGroqInvalidApiKeyError(error)) {
      return Response.json(
        {
          success: false,
          error:
            "La GROQ_API_KEY no es valida. Revisa .env.local, genera una clave nueva en Groq y reinicia el servidor.",
        },
        { status: 401 }
      );
    }

    const message = error instanceof Error ? error.message : "Error desconocido";

    return Response.json(
      { success: false, error: `No se pudo procesar el archivo: ${message}` },
      { status: 500 }
    );
  }
}

