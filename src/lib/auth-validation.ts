export type AuthFormState = {
  message?: string;
  success?: boolean;
  errors?: { username?: string; email?: string; password?: string };
};

export function safeNextPath(value: FormDataEntryValue | string | null, fallback = "/") {
  const path = typeof value === "string" ? value : "";
  return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
}

export function validateEmail(value: FormDataEntryValue | null) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function validateUsername(value: FormDataEntryValue | null) {
  const username = typeof value === "string" ? value.trim() : "";
  return /^[A-Za-z0-9_]{3,24}$/.test(username) ? username : null;
}

export function validatePassword(value: FormDataEntryValue | null) {
  const password = typeof value === "string" ? value : "";
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password)
    ? password
    : null;
}
