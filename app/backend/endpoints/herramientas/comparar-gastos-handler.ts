import Groq from "groq-sdk";
import { NextRequest } from "next/server";

import { getFacturasByCategoria } from "../../services/facturas-service";

type CategoriaComparador = "luz" | "agua" | "wifi";

type Payload = {
  pisoId?: string;
  houseCode?: string;
  categoria?: CategoriaComparador;
};

type GroqErrorShape = {
  status?: number;
  error?: { error?: { code?: string } };
};

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

  const payload = error as GroqErrorShape;

  return (
    payload.status === 401 ||
    payload.error?.error?.code === "invalid_api_key"
  );
}

function extractJsonObject(raw: string) {
  const cleanedRaw = raw.replace(/```json|```/gi, "").trim();

  const firstBrace = cleanedRaw.indexOf("{");
  const lastBrace = cleanedRaw.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return cleanedRaw.slice(firstBrace, lastBrace + 1);
  }

  return cleanedRaw;
}

function asNumber(value: number | string) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function POST(req: NextRequest) {
  try {
    const groq = getGroqClient();
    if (!groq) {
      return Response.json(
        { success: false, error: "Falta GROQ_API_KEY en .env.local" },
        { status: 500 }
      );
    }

    const body = (await req.json()) as Payload;
    const houseCode = (body.houseCode ?? body.pisoId ?? "").trim();
    const categoria = body.categoria;

    if (!houseCode || !categoria) {
      return Response.json(
        { success: false, error: "Faltan datos para comparar gastos." },
        { status: 400 }
      );
    }

    if (!["luz", "agua", "wifi"].includes(categoria)) {
      return Response.json(
        { success: false, error: "Categoria no valida." },
        { status: 400 }
      );
    }

    const facturas = await getFacturasByCategoria(houseCode, categoria);

    if (!facturas.length) {
      return Response.json({
        success: false,
        error: `No hay facturas de ${categoria} registradas en el piso`,
      });
    }

    const importePromedio =
      facturas.reduce((acc, factura) => acc + asNumber(factura.importe_total), 0) /
      facturas.length;
    const comercioActual = facturas[0]?.comercio || "proveedor actual";
    const numMeses = facturas.length;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `Eres un experto en tarifas de servicios del hogar en Espana.
Conoces las tarifas actuales de las principales compañías espanolas de luz, agua y telecomunicaciones.
Siempre respondes en espanol con datos concretos y utiles.
Respondes UNICAMENTE con JSON válido, sin texto adicional ni markdown.`,
        },
        {
          role: "user",
          content: `El piso esta pagando actualmente por ${categoria}:
- Proveedor actual: ${comercioActual}
- Importe promedio mensual: ${importePromedio.toFixed(2)} EUR
- Basado en ${numMeses} facturas registradas
- Historial: ${JSON.stringify(facturas)}

Compara con otras compañías del mercado espanol que ofrecen ${categoria} y devuelve SOLO este JSON:
{
  "categoria": "${categoria}",
  "proveedor_actual": {
    "nombre": "nombre del proveedor",
    "importe_mensual": número,
    "valoracion": "descripción breve"
  },
  "alternativas": [
    {
      "nombre": "nombre compañía",
      "importe_estimado": número,
      "ahorro_mensual": número,
      "ahorro_anual": número,
      "ventajas": "descripción breve de ventajas",
      "url_referencia": "web oficial"
    }
  ],
  "recomendacion": "texto de recomendacion final en 2-3 frases",
  "nota_legal": "Precios orientativos basados en tarifas de referencia. Consulta las condiciones exactas con cada proveedor."
}

Incluye entre 2 y 4 alternativas reales del mercado espanol.
Para luz: Endesa, Iberdrola, Naturgy, Holaluz, Octopus Energy.
Para agua: depende de la ciudad, menciona las principales gestoras.
Para wifi: Movistar, Vodafone, Orange, MasMovil, Digi.`,
        },
      ],
      temperature: 0.2,
      max_tokens: 1500,
    });

    const rawText = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!rawText) {
      throw new Error("No se obtuvo respuesta de Groq");
    }

    const jsonText = extractJsonObject(rawText);
    const data = JSON.parse(jsonText) as unknown;

    return Response.json({ success: true, data });
  } catch (error) {
    console.error("Error en comparador:", error);

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
      { success: false, error: `No se pudo generar la comparativa: ${message}` },
      { status: 500 }
    );
  }
}

