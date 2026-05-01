export const PROFILE_AVATAR_DEFAULTS = [
  "/iconos/icono1.svg",
  "/iconos/icono2.svg",
  "/iconos/icono3.svg",
  "/iconos/icono4.svg",
  "/iconos/icono5.svg",
  "/iconos/icono6.svg",
  "/iconos/icono7.svg",
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
