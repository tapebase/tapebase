const LOCAL_ORIGINS = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

function origin(value: string | null | undefined) {
  if (!value) return null;

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.origin
      : null;
  } catch {
    return null;
  }
}

export function siteUrl(requestOrigin?: string | null) {
  const configured =
    origin(process.env.NEXT_PUBLIC_SITE_URL?.trim()) ?? "http://localhost:3000";
  const requested = origin(requestOrigin);

  if (requested === configured) return requested;
  if (LOCAL_ORIGINS.has(configured) && requested && LOCAL_ORIGINS.has(requested)) {
    return requested;
  }

  return configured;
}
