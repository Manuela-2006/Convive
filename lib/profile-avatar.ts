export const PROFILE_AVATAR_DEFAULTS = [
  "/images/IconoperfilM.webp",
  "/images/IconoperfilH.webp",
] as const;

export function isDefaultProfileAvatar(value: string | null | undefined) {
  return PROFILE_AVATAR_DEFAULTS.some((avatar) => avatar === value);
}

export function buildProfileAvatarPath(input: {
  profileId: string;
  extension: string;
}) {
  return `profiles/${input.profileId}/avatar/${crypto.randomUUID()}.${input.extension}`;
}

export function isProfileAvatarStoragePath(
  value: string | null | undefined,
  profileId: string
) {
  if (!value) return false;

  return value.startsWith(`profiles/${profileId}/avatar/`);
}
