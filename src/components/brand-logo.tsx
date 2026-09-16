import Image from "next/image";
import Link from "next/link";

export function BrandLogo() {
  return <Link href="/" aria-label="TAPEBASE — strona główna" className="inline-flex shrink-0">
    <Image
      src="/tapebase-logo.png"
      alt="TAPEBASE"
      width={1866}
      height={354}
      loading="eager"
      fetchPriority="high"
      className="h-8 w-auto sm:h-9"
      sizes="(max-width: 640px) 169px, 190px"
    />
  </Link>;
}
