import Link from "next/link";

type AdminSection = "stats" | "submissions" | "import" | "concerts" | "comments" | "users" | "feedback";

export function AdminTabs({ active }: { active: AdminSection }) {
  const item = (selected: boolean) => `rounded-xl px-5 py-3 text-sm font-bold transition ${
    selected
      ? "bg-zinc-950 text-white shadow-sm"
      : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100"
  }`;

  return <nav aria-label="Sekcje panelu administratora" className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
    <Link href="/admin/statystyki" aria-current={active === "stats" ? "page" : undefined} className={item(active === "stats")}>
      Statystyki
    </Link>
    <Link href="/admin/zgloszenia" aria-current={active === "submissions" ? "page" : undefined} className={item(active === "submissions")}>
      Zgłoszenia
    </Link>
    <Link href="/admin/import" aria-current={active === "import" ? "page" : undefined} className={item(active === "import")}>
      Importer
    </Link>
    <Link href="/admin/koncerty" aria-current={active === "concerts" ? "page" : undefined} className={item(active === "concerts")}>
      Koncerty
    </Link>
    <Link href="/admin/komentarze" aria-current={active === "comments" ? "page" : undefined} className={item(active === "comments")}>
      Komentarze
    </Link>
    <Link href="/admin/uzytkownicy" aria-current={active === "users" ? "page" : undefined} className={item(active === "users")}>
      Użytkownicy
    </Link>
    <Link href="/admin/feedback" aria-current={active === "feedback" ? "page" : undefined} className={item(active === "feedback")}>
      Uwagi testerów
    </Link>
  </nav>;
}
