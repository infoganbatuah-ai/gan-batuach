export function Avatar({ name, src, size = "md" }: { name?: string | null; src?: string | null; size?: "sm" | "md" | "lg" }) {
  const initials = String(name ?? "?").split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("") || "?";
  return (
    <span className={`avatar avatar-${size}`} aria-label={name ?? "משתמש"}>
      {src ? <img src={src} alt={name ?? "תמונה"} /> : <strong>{initials}</strong>}
    </span>
  );
}
