export function automaticMinimumVotes(totalVotes: number) {
  if (totalVotes >= 5000) return 25;
  if (totalVotes >= 1000) return 10;
  if (totalVotes >= 250) return 5;
  if (totalVotes >= 50) return 3;
  return 1;
}

export function rankingMinimum(value: string | string[] | undefined, totalVotes: number) {
  if (typeof value === "string" && /^\d{1,3}$/.test(value)) {
    const parsed = Number(value);
    if (parsed >= 1 && parsed <= 999) return { value: parsed, automatic: false };
  }
  return { value: automaticMinimumVotes(totalVotes), automatic: true };
}
