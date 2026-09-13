import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import Link from "next/link";
import "./globals.css";
import { Header } from "@/components/catalog";
import { Footer } from "@/components/footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "TAPEBASE — polska baza albumów", template: "%s | TAPEBASE" },
  description: "Albumy polskiego rapu, wykonawcy i tracklisty. Odkrywaj katalog TAPEBASE.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pl"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("tapebase-theme")==="dark"?"dark":"light";document.documentElement.classList.toggle("dark",t==="dark");document.documentElement.style.colorScheme=t}catch(e){}` }} />
      </head>
      <body className="min-h-full flex flex-col bg-[#f6f4ef] text-zinc-950">
        <Suspense fallback={<header className="border-b border-zinc-200 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5"><Link href="/" className="text-2xl font-black tracking-tight">TAPEBASE</Link><span className="text-sm text-zinc-400">Ładowanie konta…</span></div></header>}>
          <Header />
        </Suspense>
        {children}
        <Footer />
      </body>
    </html>
  );
}
