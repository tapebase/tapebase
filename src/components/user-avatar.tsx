import Image from "next/image";

function avatarSource(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function UserAvatar({ username, src, size = "normal" }: { username: string; src: string | null; size?: "small" | "normal" | "large" }) {
  const image = avatarSource(src);
  const classes = size === "small" ? "h-9 w-9 text-sm" : size === "large" ? "h-28 w-28 text-3xl" : "h-14 w-14 text-xl";
  return <div className={`relative shrink-0 overflow-hidden rounded-full bg-zinc-100 ${classes}`}>
    {image ? <Image src={image} alt={`Avatar użytkownika ${username}`} fill unoptimized className="object-cover" sizes={size === "large" ? "112px" : size === "small" ? "36px" : "56px"} />
      : <div role="img" aria-label={`Avatar użytkownika ${username}`} className="flex h-full items-center justify-center font-black text-zinc-500">{username.slice(0, 1).toUpperCase()}</div>}
  </div>;
}
