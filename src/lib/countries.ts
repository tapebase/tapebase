export type CountryFilter = "all" | "PL" | "INT";

export function submissionCountryCode(value: unknown) {
  return value === "INT" || value === "ZZ" ? "ZZ" : "PL";
}

export function countryFilter(value: unknown): CountryFilter {
  if (value === "all" || value === "INT") return value;
  return "PL";
}

export function countryLabel(code: string | null | undefined) {
  if (code === "PL") return "Polska";
  if (code) return "Zagranica";
  return "Kraj nieustalony";
}
