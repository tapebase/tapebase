import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { Header } from "@/components/catalog";
import { Footer } from "@/components/footer";
import { BrandLogo } from "@/components/brand-logo";
import { JsonLd } from "@/components/json-ld";
import { DEFAULT_SOCIAL_IMAGE, SITE_DESCRIPTION, SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/seo";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "TAPEBASE – oceniaj albumy i artystów", template: "%s | TAPEBASE" },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "music",
  formatDetection: { telephone: false, email: false, address: false },
  openGraph: {
    title: "TAPEBASE – oceniaj albumy i artystów",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "pl_PL",
    type: "website",
    images: [{ url: DEFAULT_SOCIAL_IMAGE, width: 1200, height: 630, alt: "TAPEBASE – społecznościowa baza muzyki" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "TAPEBASE – oceniaj albumy i artystów",
    description: SITE_DESCRIPTION,
    images: [DEFAULT_SOCIAL_IMAGE],
  },
  icons: {
    icon: [
      { url: "/favicon-t-light-32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-t-light-64.png", type: "image/png", sizes: "64x64" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pl"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("tapebase-theme")==="light"?"light":"dark",u=function(){document.querySelectorAll('link[rel="icon"][href*="favicon-t-"]').forEach(function(f){var s=(f.getAttribute("sizes")||"64x64").split("x")[0];f.href="/favicon-t-"+t+"-"+s+".png"})};document.documentElement.classList.toggle("dark",t==="dark");document.documentElement.style.colorScheme=t;u();new MutationObserver(u).observe(document.head,{childList:true,subtree:true})}catch(e){}` }} />
      </head>
      <body className="min-h-full flex flex-col bg-[#f6f4ef] text-zinc-950">
        <JsonLd data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebSite",
              "@id": `${SITE_URL}/#website`,
              url: SITE_URL,
              name: SITE_NAME,
              description: SITE_DESCRIPTION,
              inLanguage: "pl-PL",
              publisher: { "@id": `${SITE_URL}/#organization` },
            },
            {
              "@type": "Organization",
              "@id": `${SITE_URL}/#organization`,
              name: SITE_NAME,
              url: SITE_URL,
              logo: absoluteUrl("/tapebase-logo-dark-v2.png"),
            },
          ],
        }} />
        <Suspense fallback={<header className="border-b border-zinc-200 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 sm:py-5"><BrandLogo /><span className="text-sm text-zinc-400">Ładowanie konta…</span></div></header>}>
          <Header />
        </Suspense>
        {children}
        <Footer />
      </body>
    </html>
  );
}
