"use client";

import Image from "next/image";
import { useState } from "react";

export function ParentChildPhotoFallback({
  src,
  name,
  compact = false,
}: {
  src?: string | null;
  name: string;
  compact?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    // The Child's name is adjacent to this decorative image in both cards.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" onError={() => setFailed(true)} />;
  }

  if (compact) {
    return <span className="parent-child-context-initial" aria-hidden="true">{name.trim().charAt(0) || "?"}</span>;
  }

  return <Image className="parent-child-illustration" src="/assets/gan-batuach-child-avatar.webp" alt="" width={240} height={240} />;
}
