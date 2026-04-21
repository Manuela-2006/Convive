import Groq from "groq-sdk";
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

import type { TicketScannerData } from "../../../lib/ticket-scanner-types";

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

function getStorageClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

function getPublicStorageBaseUrl() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!supabaseUrl) {
    return null;
  }

  return `${supabaseUrl}/storage/v1/object/public`;
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

function toSafeFileExtension(fileName?: string, mediaType?: string) {
  const extByMediaType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf",
  };

  const fromMediaType = mediaType ? extByMediaType[mediaType] : undefined;
  if (fromMediaType) {
    return fromMediaType;
  }

  const rawExtension = fileName?.split(".").pop()?.trim().toLowerCase();
  if (!rawExtension) {
    return "jpg";
  }

  return rawExtension.replace(/[^a-z0-9]/g, "") || "jpg";
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
    throw new Error("Respuesta JSON vacia o invalida.");
  }

  const payload = input as Record<string, unknown>;
  const tipo = payload.tipo;
  if (tipo !== "ticket" && tipo !== "factura" && tipo !== "desconocido") {
    throw new Error("El JSON no contiene un campo tipo valido.");
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

async function uploadOriginalFile(
  fileBase64: string,
  mediaType: string,
  fileName?: string
) {
  const storageClient = getStorageClient();
  const publicStorageBaseUrl = getPublicStorageBaseUrl();

  if (!storageClient || !publicStorageBaseUrl) {
    return null;
  }

  const extension = toSafeFileExtension(fileName, mediaType);
  const randomSlug = Math.random().toString(36).slice(2, 10);
  const filePath = `tickets/${Date.now()}-${randomSlug}.${extension}`;
  const fileBuffer = Buffer.from(fileBase64, "base64");

  const { error } = await storageClient.storage
    .from("tickets")
    .upload(filePath, fileBuffer, {
      contentType: mediaType,
      upsert: false,
    });

  if (error) {
    console.error("Error subiendo imagen a Storage:", error);
    return null;
  }

  return `${publicStorageBaseUrl}/tickets/${filePath}`;
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
    const { text, fileBase64, mediaType, fileName } = payload;
    const scanMode = payload.scanMode === "vision" ? "vision" : "ocr";

    if (!fileBase64 || !mediaType) {
      return Response.json(
        { success: false, error: "Faltan datos" },
        { status: 400 }
      );
    }

    const shouldUseVisionDirect =
      scanMode === "vision" && mediaType !== "application/pdf";
    if (!shouldUseVisionDirect && (!text || text.trim().length < 5)) {
      return Response.json(
        { success: false, error: "Falta texto OCR para procesar el documento." },
        { status: 400 }
      );
    }

    const systemPrompt =
      "Eres un asistente experto en extraer datos estructurados de tickets de compra y facturas. " +
      "Siempre devuelves unicamente JSON valido, sin texto adicional, sin bloques de codigo markdown.";
    const userPrompt = `Analiza este documento de ticket de compra o factura.
Puede haber errores de lectura. Interpreta con sentido comun.
Devuelve UNICAMENTE un objeto JSON valido, sin texto antes ni despues, sin bloques de codigo markdown.

Si es un ticket de compra:
{
  "tipo": "ticket",
  "comercio": "nombre del comercio o null",
  "fecha": "DD/MM/YYYY o null",
  "importe_total": numero o null,
  "articulos": [{ "nombre": "string", "precio": numero o null, "unidades": entero }]
}

Reglas obligatorias para "articulos" en tickets:
- Debes extraer SOLO las lineas de producto que aparezcan literalmente en el ticket.
- No inventes articulos ni completes huecos.
- No normalices ni corrijas nombres: copia el texto tal cual se ve.
- Excluye lineas que no sean productos (TOTAL, IVA, SUBTOTAL, CAMBIO, TARJETA, etc.).
- Si una linea de producto indica varias unidades, pon ese valor en "unidades".
- Si no se ve cantidad explicita, usa "unidades": 1.

Si es una factura (luz, agua, wifi, gas, alquiler):
{
  "tipo": "factura",
  "comercio": "nombre de la compania o null",
  "categoria": "luz | agua | wifi | gas | alquiler | otro",
  "fecha": "DD/MM/YYYY o null",
  "periodo": "descripcion del periodo o null",
  "importe_total": numero o null
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
          ] as any)
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

    const imageUrl = await uploadOriginalFile(fileBase64, mediaType, fileName);

    return Response.json({
      success: true,
      data: {
        ...data,
        imagen_url: imageUrl,
      } satisfies TicketScannerData,
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
