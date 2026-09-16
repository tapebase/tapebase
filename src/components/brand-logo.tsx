import Image from "next/image";
import Link from "next/link";

export function BrandLogo() {
  return <Link href="/" aria-label="TAPEBASE — strona główna" className="inline-flex shrink-0 rounded-lg bg-[#09090b] px-2 py-1.5">
    <Image
      src="/tapebase-logo.png"
      alt="TAPEBASE"
      width={1866}
      height={354}
      loading="eager"
      fetchPriority="high"
      className="h-7 w-auto sm:h-8"
      sizes="(max-width: 640px) 148px, 169px"
    />
  </Link>;
}
