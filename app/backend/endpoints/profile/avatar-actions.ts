"use server";

import { getAuthenticatedProfileContext } from "../auth/queries";
import type { ActionResult } from "../shared/action-result";
import { toActionError } from "../shared/action-result";
import {
  DOCUMENT_SIGNED_URL_TTL_SECONDS,
  DOCUMENTS_BUCKET,
  validateDocumentUploadPayload,
} from "../shared/document-storage";
import { revalidatePaths } from "../shared/revalidate";
import type { DocumentUploadPayload } from "../../../../lib/document-upload-types";
import {
  buildProfileAvatarPath,
  isDefaultProfileAvatar,
  isProfileAvatarStoragePath,
} from "../../../../lib/profile-avatar";

type UploadProfileAvatarInput = {
  dashboardPath: string;
  document: DocumentUploadPayload;
};

type SelectProfileAvatarInput = {
  dashboardPath: string;
  avatarUrl: string;
};

type GetProfileAvatarSignedUrlInput = {
  storagePath: string;
};

type ProfileAvatarRow = {
  avatar_storage_path?: string | null;
};

function revalidateAvatarPaths(dashboardPath: string) {
  revalidatePaths([
    dashboardPath,
    `${dashboardPath}/ajustes`,
    `${dashboardPath}/area-grupal`,
    `${dashboardPath}/area-personal`,
  ]);
}

export async function uploadProfileAvatarAction(
  input: UploadProfileAvatarInput
): Promise<ActionResult<{ storagePath: string; signedUrl: string }>> {
  let uploadedPath: string | null = null;

  try {
    const { supabase, profile } = await getAuthenticatedProfileContext();
    const { buffer, extension } = validateDocumentUploadPayload(input.document);
    const storagePath = buildProfileAvatarPath({
      profileId: profile.id,
      extension,
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

    const { error: profileError } = await supabase.rpc("set_own_profile_avatar", {
      p_avatar_url: storagePath,
      p_avatar_storage_path: storagePath,
    });

    if (profileError) {
      await supabase.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
      uploadedPath = null;
      return { success: false, error: profileError.message };
    }

    const signedResult = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(storagePath, DOCUMENT_SIGNED_URL_TTL_SECONDS);

    if (signedResult.error || !signedResult.data?.signedUrl) {
      return {
        success: false,
        error: signedResult.error?.message ?? "No se pudo cargar el avatar.",
      };
    }

    uploadedPath = null;
    revalidateAvatarPaths(input.dashboardPath);

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

export async function selectProfileAvatarAction(
  input: SelectProfileAvatarInput
): Promise<ActionResult<{ avatarUrl: string }>> {
  try {
    const { supabase, profile } = await getAuthenticatedProfileContext();
    const avatarUrl = input.avatarUrl.trim();

    if (isDefaultProfileAvatar(avatarUrl)) {
      const { error } = await supabase.rpc("set_own_profile_avatar", {
        p_avatar_url: avatarUrl,
        p_avatar_storage_path: null,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      revalidateAvatarPaths(input.dashboardPath);
      return { success: true, data: { avatarUrl } };
    }

    if (!isProfileAvatarStoragePath(avatarUrl, profile.id)) {
      return { success: false, error: "Avatar no permitido." };
    }

    const { data, error: readError } = await supabase
      .from("profiles")
      .select("avatar_storage_path")
      .eq("id", profile.id)
      .maybeSingle();

    if (readError) {
      return { success: false, error: readError.message };
    }

    const row = data as ProfileAvatarRow | null;
    if (row?.avatar_storage_path !== avatarUrl) {
      return { success: false, error: "La foto seleccionada no pertenece a tu perfil." };
    }

    const { error } = await supabase.rpc("set_own_profile_avatar", {
      p_avatar_url: avatarUrl,
      p_avatar_storage_path: null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidateAvatarPaths(input.dashboardPath);
    return { success: true, data: { avatarUrl } };
  } catch (error) {
    return { success: false, error: toActionError(error) };
  }
}

export async function getProfileAvatarSignedUrlAction(
  input: GetProfileAvatarSignedUrlInput
): Promise<ActionResult<{ signedUrl: string }>> {
  try {
    const { supabase, profile } = await getAuthenticatedProfileContext();
    const storagePath = input.storagePath.trim();

    if (!isProfileAvatarStoragePath(storagePath, profile.id)) {
      return { success: false, error: "Avatar no permitido." };
    }

    const { data, error: readError } = await supabase
      .from("profiles")
      .select("avatar_storage_path")
      .eq("id", profile.id)
      .maybeSingle();

    if (readError) {
      return { success: false, error: readError.message };
    }

    const row = data as ProfileAvatarRow | null;
    if (row?.avatar_storage_path !== storagePath) {
      return { success: false, error: "La foto no pertenece a tu perfil." };
    }

    const signedResult = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(storagePath, DOCUMENT_SIGNED_URL_TTL_SECONDS);

    if (signedResult.error || !signedResult.data?.signedUrl) {
      return {
        success: false,
        error: signedResult.error?.message ?? "No se pudo cargar el avatar.",
      };
    }

    return { success: true, data: { signedUrl: signedResult.data.signedUrl } };
  } catch (error) {
    return { success: false, error: toActionError(error) };
  }
}
