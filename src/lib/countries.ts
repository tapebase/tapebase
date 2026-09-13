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
  if (code === "ZZ") return "Zagranica";
  if (code && /^[A-Z]{2}$/.test(code)) {
    try { return new Intl.DisplayNames(["pl"], { type: "region" }).of(code) ?? "Zagranica"; }
    catch { return "Zagranica"; }
  }
  return "Kraj nieustalony";
}
