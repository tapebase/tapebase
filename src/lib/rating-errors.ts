export function ratingErrorMessage(error: { message?: string } | null, fallback: string) {
  return error?.message?.includes("rating_rate_limit_exceeded")
    ? "Wystawiłeś wiele ocen w krótkim czasie. Spróbuj ponownie za kilka minut."
    : fallback;
}
