export function welcomePath(next: string) {
  return `/witaj?next=${encodeURIComponent(next)}`;
}
