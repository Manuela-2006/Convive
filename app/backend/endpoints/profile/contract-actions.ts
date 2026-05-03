"use server";

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
