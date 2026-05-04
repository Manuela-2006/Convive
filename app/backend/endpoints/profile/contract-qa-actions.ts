"use server";

import Groq from "groq-sdk";
import pdfParse from "pdf-parse";
import { getAuthenticatedProfileContext } from "../auth/queries";
import type { ActionResult } from "../shared/action-result";
import { toActionError } from "../shared/action-result";
import {
  DOCUMENT_SIGNED_URL_TTL_SECONDS,
  DOCUMENTS_BUCKET,
} from "../shared/document-storage";

type AskContractQuestionInput = {
  houseCode: string;
  question: string;
};

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  return new Groq({ apiKey });
}

function normalizeQuestion(raw: string) {
  return raw.trim().replace(/\s+/g, " ");
}

function containsSensitiveIntent(text: string) {
  const value = text.toLowerCase();
  const patterns = [
    "dni",
    "nie",
    "pasaporte",
    "iban",
    "cuenta bancaria",
    "numero de cuenta",
    "número de cuenta",
    "telefono",
    "teléfono",
    "firma",
    "firmas",
    "correo",
    "email",
    "documento identidad",
    "identidad",
  ];
  return patterns.some((pattern) => value.includes(pattern));
}

function sanitizeSensitiveData(text: string) {
  let output = text;
  output = output.replace(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    "[dato sensible oculto]"
  );
  output = output.replace(
    /(?<!\d)(?:\+34\s*)?(?:6|7|8|9)\d(?:[\s.-]?\d){7}(?!\d)/g,
    "[dato sensible oculto]"
  );
  output = output.replace(
    /\b(?:\d{8}[A-HJ-NP-TV-Z]|[XYZ]\d{7}[A-HJ-NP-TV-Z])\b/gi,
    "[dato sensible oculto]"
  );
  output = output.replace(
    /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}\b/g,
    "[dato sensible oculto]"
  );
  output = output.replace(/\b\d{10,24}\b/g, "[dato sensible oculto]");
  output = output.replace(/\bfirma(?:s)?\b/gi, "[dato sensible oculto]");
  return output;
}

export async function askContractQuestionAction(
  input: AskContractQuestionInput
): Promise<ActionResult<{ answer: string }>> {
  try {
    const question = normalizeQuestion(input.question);
    if (!question || question.length < 3) {
      return { success: false, error: "Escribe una pregunta valida." };
    }

    if (containsSensitiveIntent(question)) {
      return {
        success: true,
        data: {
          answer:
            "No puedo compartir datos sensibles del contrato (DNI, cuentas, telefonos, firmas o datos identificativos).",
        },
      };
    }

    const groq = getGroqClient();
    if (!groq) {
      return {
        success: false,
        error: "Falta GROQ_API_KEY en variables de entorno.",
      };
    }

    const { supabase } = await getAuthenticatedProfileContext();
    const { data, error } = await supabase.rpc("get_own_house_member_contract", {
      p_house_public_code: input.houseCode,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const storagePath =
      data && typeof data === "object" && !Array.isArray(data)
        ? (data as { contract_file_path?: unknown }).contract_file_path
        : null;

    if (typeof storagePath !== "string" || !storagePath.trim()) {
      return { success: false, error: "No hay contrato guardado." };
    }

    const signedResult = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(storagePath, DOCUMENT_SIGNED_URL_TTL_SECONDS);

    if (signedResult.error || !signedResult.data?.signedUrl) {
      return {
        success: false,
        error: signedResult.error?.message ?? "No se pudo abrir el contrato.",
      };
    }

    const fileResponse = await fetch(signedResult.data.signedUrl);
    if (!fileResponse.ok) {
      return { success: false, error: "No se pudo leer el contrato." };
    }

    const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());
    if (!fileBuffer.length) {
      return { success: false, error: "El contrato esta vacio." };
    }

    const parsed = await pdfParse(fileBuffer);
    const contractText = sanitizeSensitiveData((parsed.text ?? "").trim());
    if (!contractText) {
      return {
        success: false,
        error:
          "No pude extraer texto del PDF. Asegurate de que el contrato tenga texto seleccionable.",
      };
    }

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0,
      max_tokens: 700,
      messages: [
        {
          role: "system",
          content:
            "Eres un asistente de contratos de alquiler. Responde solo con informacion contenida en el contrato. Si no aparece en el contrato, responde exactamente: 'No aparece en el contrato.'. Nunca proporciones datos sensibles ni identificativos.",
        },
        {
          role: "user",
          content: `Contrato (texto ya anonimizado):\n\n${contractText}\n\nPregunta: ${question}`,
        },
      ],
    });

    const rawAnswer = completion.choices[0]?.message?.content?.trim() ?? "";
    const safeAnswer = sanitizeSensitiveData(rawAnswer);
    if (!safeAnswer) {
      return { success: false, error: "No se pudo generar una respuesta." };
    }

    return { success: true, data: { answer: safeAnswer } };
  } catch (error) {
    return { success: false, error: toActionError(error) };
  }
}
