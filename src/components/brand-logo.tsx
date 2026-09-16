import Image from "next/image";
import Link from "next/link";

export function BrandLogo() {
  return <Link href="/" aria-label="TAPEBASE — strona główna" className="inline-flex shrink-0">
    <Image
      src="/tapebase-logo-dark-v2.png"
      alt=""
      aria-hidden="true"
      width={760}
      height={137}
      loading="eager"
      fetchPriority="high"
      className="brand-logo-dark-theme h-8 w-auto sm:h-9"
      sizes="(max-width: 640px) 169px, 190px"
    />
    <Image
      src="/tapebase-logo-light-v2.png"
      alt=""
      aria-hidden="true"
      width={760}
      height={137}
      loading="eager"
      className="brand-logo-light-theme h-8 w-auto sm:h-9"
      sizes="(max-width: 640px) 169px, 190px"
    />
  </Link>;
}
