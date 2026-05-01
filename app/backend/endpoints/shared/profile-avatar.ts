import { DOCUMENT_SIGNED_URL_TTL_SECONDS, DOCUMENTS_BUCKET } from "./document-storage";
import type { createClient } from "./supabase-server";
import {
  isDefaultProfileAvatar,
  isProfileAvatarStoragePath,
} from "../../../../lib/profile-avatar";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type ProfileAvatarRow = {
  id?: unknown;
  avatar_url?: unknown;
};

function toStringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

export async function resolveProfileAvatarUrlWithClient(
  supabase: SupabaseServerClient,
  input: { profileId: string; avatarUrl: string | null | undefined }
) {
  const avatarUrl = input.avatarUrl?.trim();

  if (!avatarUrl) {
    return null;
  }

  if (isDefaultProfileAvatar(avatarUrl)) {
    return avatarUrl;
  }

  if (!isProfileAvatarStoragePath(avatarUrl, input.profileId)) {
    return null;
  }

  const signedResult = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(avatarUrl, DOCUMENT_SIGNED_URL_TTL_SECONDS);

  return signedResult.data?.signedUrl ?? null;
}

export async function loadProfileAvatarUrlMapWithClient(
  supabase: SupabaseServerClient,
  profileIds: string[]
) {
  const uniqueProfileIds = Array.from(new Set(profileIds.filter(Boolean)));

  if (!uniqueProfileIds.length) {
    return new Map<string, string | null>();
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, avatar_url")
    .in("id", uniqueProfileIds);

  if (error || !Array.isArray(data)) {
    return new Map<string, string | null>();
  }

  const entries = await Promise.all(
    data.map(async (item) => {
      const row = item as ProfileAvatarRow;
      const profileId = toStringValue(row.id);
      const avatarUrl = await resolveProfileAvatarUrlWithClient(supabase, {
        profileId,
        avatarUrl: toStringValue(row.avatar_url),
      });

      return [profileId, avatarUrl] as const;
    })
  );

  return new Map(entries);
}
