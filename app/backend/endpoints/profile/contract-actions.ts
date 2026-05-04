"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { getAuthenticatedProfileContext } from "../auth/queries";
import type { ActionResult } from "../shared/action-result";
import { toActionError } from "../shared/action-result";
import {
  buildHouseMemberContractPath,
  DOCUMENT_SIGNED_URL_TTL_SECONDS,
  DOCUMENTS_BUCKET,
  validatePdfUploadPayload,
} from "../shared/document-storage";
import { revalidatePaths } from "../shared/revalidate";
import type { DocumentUploadPayload } from "../../../../lib/document-upload-types";

type UploadContractInput = {
  houseCode: string;
  dashboardPath: string;
  document: DocumentUploadPayload;
};

type ViewContractInput = {
  houseCode: string;
};

type AskContractQuestionInput = {
  houseCode: string;
  question: string;
};

function revalidateContractPaths(dashboardPath: string) {
  revalidatePaths([
    dashboardPath,
    `${dashboardPath}/ajustes`,
    `${dashboardPath}/completar-perfil`,
  ]);
}

function readHouseId(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const house = (value as { house?: unknown }).house;
  if (!house || typeof house !== "object" || Array.isArray(house)) {
    return null;
  }

  const id = (house as { id?: unknown }).id;
  return typeof id === "string" && id ? id : null;
}

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  return new GoogleGenerativeAI(apiKey);
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

  // Emails
  output = output.replace(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    "[dato sensible oculto]"
  );
  // Spanish phone numbers
  output = output.replace(
    /(?<!\d)(?:\+34\s*)?(?:6|7|8|9)\d(?:[\s.-]?\d){7}(?!\d)/g,
    "[dato sensible oculto]"
  );
  // DNI/NIE
  output = output.replace(
    /\b(?:\d{8}[A-HJ-NP-TV-Z]|[XYZ]\d{7}[A-HJ-NP-TV-Z])\b/gi,
    "[dato sensible oculto]"
  );
  // IBAN (ES + generic long IBAN-like)
  output = output.replace(
    /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}\b/g,
    "[dato sensible oculto]"
  );
  // Long account-like numeric sequences
  output = output.replace(/\b\d{10,24}\b/g, "[dato sensible oculto]");
  // Signature references
  output = output.replace(/\bfirma(?:s)?\b/gi, "[dato sensible oculto]");

  return output;
}

export async function uploadContractDocumentAction(
  input: UploadContractInput
): Promise<ActionResult<{ storagePath: string; signedUrl: string }>> {
  let uploadedPath: string | null = null;

  try {
    const { supabase, profile } = await getAuthenticatedProfileContext();
    const houseContextResult = await supabase.rpc("get_accessible_house_context", {
      p_user_hash_id: profile.user_hash_id,
      p_house_public_code: input.houseCode,
    });
    const houseId = readHouseId(houseContextResult.data);

    if (houseContextResult.error || !houseId) {
      return {
        success: false,
        error: houseContextResult.error?.message ?? "No se pudo validar el piso.",
      };
    }

    const { buffer } = validatePdfUploadPayload(input.document);
    const storagePath = buildHouseMemberContractPath({
      houseId,
      profileId: profile.id,
    });

    const uploadResult = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(storagePath, buffer, {
        contentType: input.document.mediaType,
        upsert: false,
      });

    if (uploadResult.error) {
      return { success: false, error: uploadResult.error.message };
    }

    uploadedPath = storagePath;

    const { error } = await supabase.rpc("set_own_house_member_contract", {
      p_house_public_code: input.houseCode,
      p_contract_file_path: storagePath,
    });

    if (error) {
      await supabase.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
      uploadedPath = null;
      return { success: false, error: error.message };
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

    uploadedPath = null;
    revalidateContractPaths(input.dashboardPath);

    return {
      success: true,
      data: {
        storagePath,
        signedUrl: signedResult.data.signedUrl,
      },
    };
  } catch (error) {
    if (uploadedPath) {
      try {
        const { supabase } = await getAuthenticatedProfileContext();
        await supabase.storage.from(DOCUMENTS_BUCKET).remove([uploadedPath]);
      } catch {
        // Keep the original error for the caller.
      }
    }

    return { success: false, error: toActionError(error) };
  }
}

export async function getContractDocumentSignedUrlAction(
  input: ViewContractInput
): Promise<ActionResult<{ signedUrl: string }>> {
  try {
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

    return { success: true, data: { signedUrl: signedResult.data.signedUrl } };
  } catch (error) {
    return { success: false, error: toActionError(error) };
  }
}

export async function askContractQuestionAction(
  input: AskContractQuestionInput
): Promise<ActionResult<{ answer: string }>> {
  try {
    const question = normalizeQuestion(input.question);
    if (!question || question.length < 3) {
      return { success: false, error: "Escribe una pregunta válida." };
    }

    if (containsSensitiveIntent(question)) {
      return {
        success: true,
        data: {
          answer:
            "No puedo ayudar con datos sensibles del contrato (DNI, cuentas, teléfonos, firmas o datos personales identificativos).",
        },
      };
    }

    const gemini = getGeminiClient();
    if (!gemini) {
      return {
        success: false,
        error: "Falta GEMINI_API_KEY en variables de entorno.",
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
      return { success: false, error: "El contrato está vacío." };
    }

    const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
Eres un asistente legal de contratos de alquiler.
Responde EXCLUSIVAMENTE con información contenida en el contrato aportado.
Si la respuesta no aparece en el contrato, responde exactamente:
"No aparece en el contrato."

Reglas críticas de privacidad:
- NUNCA reveles ni cites datos sensibles: DNI/NIE/pasaporte, cuentas bancarias/IBAN, teléfonos, firmas, correos personales u otros datos identificativos.
- Si la pregunta solicita alguno de esos datos, responde exactamente:
"No puedo compartir datos sensibles del contrato."
- No devuelvas fragmentos textuales que incluyan datos sensibles.

Pregunta del usuario:
${question}
`.trim();

    const result = await model.generateContent([
      {
        inlineData: {
          data: fileBuffer.toString("base64"),
          mimeType: "application/pdf",
        },
      },
      { text: prompt },
    ]);

    const rawText = result.response.text().trim();
    const safeAnswer = sanitizeSensitiveData(rawText).trim();

    if (!safeAnswer) {
      return { success: false, error: "No se pudo generar una respuesta." };
    }

    return { success: true, data: { answer: safeAnswer } };
  } catch (error) {
    return { success: false, error: toActionError(error) };
  }
}
