import Link from "next/link";

const groups = [
  {
    title: "Katalog",
    links: [
      ["Albumy", "/album"],
      ["Artyści", "/artist"],
      ["Rankingi", "/rankingi"],
      ["Ostatnio dodane", "/#ostatnio-dodane"],
    ],
  },
  {
    title: "Społeczność",
    links: [
      ["Zgłoś album / artystę", "/zglos"],
      ["Zgłoś błąd / pomysł", "/feedback"],
      ["Powiadomienia", "/powiadomienia"],
    ],
  },
  {
    title: "Informacje",
    links: [
      ["O projekcie", "/o-projekcie"],
      ["Kontakt", "/kontakt"],
      ["Regulamin", "/regulamin"],
      ["Polityka prywatności", "/polityka-prywatnosci"],
    ],
  },
] as const;

export function Footer() {
  return <footer className="mt-auto border-t border-zinc-200 bg-white">
    <div className="mx-auto grid w-full max-w-7xl gap-10 px-6 py-10 sm:grid-cols-3">
      {groups.map(group => <nav key={group.title} aria-label={group.title}>
        <h2 className="text-sm font-black uppercase tracking-widest text-zinc-500">{group.title}</h2>
        <ul className="mt-4 space-y-3 text-sm font-semibold">
          {group.links.map(([label, href]) => <li key={href}><Link href={href} className="hover:underline">{label}</Link></li>)}
        </ul>
      </nav>)}
    </div>
    <div className="border-t border-zinc-200">
      <div className="mx-auto w-full max-w-7xl px-6 py-6 text-center text-xs text-zinc-500">
        <p>© {new Date().getFullYear()} TAPEBASE</p>
      </div>
    </div>
  </footer>;
}
