import Image from "next/image";

import { PROFILE_AVATAR_DEFAULTS } from "../../lib/profile-avatar";

type ProfileAvatarProps = {
  src?: string | null;
  alt?: string;
  width: number;
  height: number;
  className?: string;
};

export function ProfileAvatar({
  src,
  alt = "",
  width,
  height,
  className,
}: ProfileAvatarProps) {
  const fallbackSrc = PROFILE_AVATAR_DEFAULTS[0];
  const resolvedSrc = src || fallbackSrc;

  if (resolvedSrc.startsWith("/")) {
    return (
      <Image
        src={resolvedSrc}
        alt={alt}
        width={width}
        height={height}
        className={className}
        style={{ borderRadius: "999px", objectFit: "cover" }}
      />
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
      style={{ borderRadius: "999px", objectFit: "cover" }}
    />
  );
}
