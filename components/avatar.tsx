import Image from "next/image";

export function Avatar({ name, src, fallbackSrc, size = "md" }: { name?: string | null; src?: string | null; fallbackSrc?: string | null; size?: "sm" | "md" | "lg" }) {
  const initials = String(name ?? "?").split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("") || "?";
  return (
    <span className={`avatar avatar-${size}`} aria-label={name ?? "משתמש"}>
      {src ? <img src={src} alt={name ?? "תמונה"} /> : fallbackSrc ? <Image className="avatar-illustration" src={fallbackSrc} alt="" width={96} height={96} /> : <strong>{initials}</strong>}
    </span>
  );
}
