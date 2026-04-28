import Groq from "groq-sdk";
import { NextRequest } from "next/server";

import { getFacturasActivasByPiso } from "../../services/facturas-service";
import { getMiembrosByPiso } from "../../services/miembros-service";
import { getPresupuestoMensualByPiso } from "../../services/piso-service";
import { getGastosMesActual } from "../../services/tickets-service";

type TipoEscenario = "entra_alguien" | "sale_alguien" | "cambiar_condiciones";

type Payload = {
  pisoId?: string;
  houseCode?: string;
  tipoEscenario?: TipoEscenario;
  parametros?: Record<string, unknown>;
};

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  return new Groq({ apiKey });
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
    const tipoEscenario = body.tipoEscenario;
    const parametros = body.parametros ?? {};

    if (!houseCode || !tipoEscenario) {
      return Response.json(
        { success: false, error: "Faltan datos para simular el escenario." },
        { status: 400 }
      );
    }

    const [miembros, facturas, gastoTotal, presupuesto] = await Promise.all([
      getMiembrosByPiso(houseCode),
      getFacturasActivasByPiso(houseCode),
      getGastosMesActual(houseCode),
      getPresupuestoMensualByPiso(houseCode),
    ]);

    const contexto = `
Datos actuales del piso:
- Numero de miembros: ${miembros.length}
- Miembros: ${JSON.stringify(miembros)}
- Facturas activas: ${JSON.stringify(facturas)}
- Gasto total este mes (tickets): ${gastoTotal} EUR
- Presupuesto mensual: ${presupuesto.budget_amount} EUR (${presupuesto.budget_month})

Escenario a simular: ${tipoEscenario}
Parametros del escenario: ${JSON.stringify(parametros)}
`;

    const prompts: Record<TipoEscenario, string> = {
      entra_alguien: `${contexto}
Simula como cambiaria la situación economica del piso si entrara una persona nueva.
Ten en cuenta:
- Se reparte entre más miembros.
- Puede subir consumo de suministros.
- El alquiler puede repartirse entre más personas.

Responde en espanol, claro y estructurado:
1) Situacion actual
2) Situacion simulada
3) Diferencia por persona
4) Conclusion y recomendacion`,
      sale_alguien: `${contexto}
Simula como cambiaria la situación economica del piso si saliera un miembro.
Ten en cuenta:
- Se reparte entre menos miembros.
- Puede bajar algo el consumo.
- Puede existir liquidacion pendiente.

Responde en espanol, claro y estructurado:
1) Situacion actual
2) Situacion simulada
3) Liquidacion estimada de quien sale
4) Diferencia por persona
5) Conclusion y recomendacion`,
      cambiar_condiciones: `${contexto}
Simula como afectaria al piso el cambio de condiciones indicado.

Responde en espanol, claro y estructurado:
1) Situacion actual
2) Impacto inmediato
3) Impacto en presupuesto mensual por persona
4) Recomendaciones para minimizar impacto`,
    };

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "Eres un asistente financiero experto en pisos compartidos. Das respuestas concretas, numericas y utiles. Siempre respondes en espanol.",
        },
        {
          role: "user",
          content: prompts[tipoEscenario],
        },
      ],
      temperature: 0.3,
      max_tokens: 1500,
    });

    const respuesta = completion.choices[0]?.message?.content ?? "";

    return Response.json({ success: true, respuesta });
  } catch (error) {
    console.error("Error en simulador:", error);
    return Response.json(
      { success: false, error: "No se pudo generar la simulacion" },
      { status: 500 }
    );
  }
}

