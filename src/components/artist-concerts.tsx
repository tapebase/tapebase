import type { ArtistConcert, ConcertOffer } from "@/lib/concerts";

function eventDate(concert: ArtistConcert) {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric", month: "long", year: "numeric",
    ...(concert.start_time_known ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: concert.timezone || "Europe/Warsaw",
  }).format(new Date(concert.starts_at));
}

function price(offer: ConcertOffer) {
  if (offer.price_min === null && offer.price_max === null) return null;
  const currency = offer.currency ?? "PLN";
  const format = (value: number) => new Intl.NumberFormat("pl-PL", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  if (offer.price_min !== null && offer.price_max !== null && offer.price_min !== offer.price_max) return `${format(offer.price_min)}–${format(offer.price_max)}`;
  return format(offer.price_min ?? offer.price_max!);
}

const statusNames: Record<string, string> = {
  cancelled: "Odwołany", postponed: "Przełożony", rescheduled: "Nowy termin", offsale: "Sprzedaż zakończona",
};

export function ArtistConcerts({ concerts }: { concerts: ArtistConcert[] }) {
  return <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8" aria-labelledby="artist-concerts-title">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Na żywo</p>
        <h2 id="artist-concerts-title" className="mt-1 text-2xl font-black">Najbliższe koncerty</h2>
      </div>
      <p className="text-sm text-zinc-500">Gdzie kupić bilety?</p>
    </div>
    {!concerts.length ? <p className="mt-6 rounded-2xl bg-[#f6f4ef] p-5 text-zinc-600">Brak zapowiedzianych koncertów w Polsce w aktualnie zsynchronizowanych danych.</p> :
      <ol className="mt-6 divide-y divide-zinc-200">{concerts.map(concert => {
        const disabled = concert.status === "cancelled";
        return <li key={concert.id} className="grid gap-4 py-5 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <time dateTime={concert.starts_at} className="font-black">{eventDate(concert)}</time>
              {concert.status !== "scheduled" && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">{statusNames[concert.status] ?? concert.status}</span>}
            </div>
            <h3 className="mt-1 truncate text-lg font-bold">{concert.title}</h3>
            <p className="text-sm text-zinc-600">{concert.venue_name} · {concert.city}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 md:justify-end">
            {concert.offers.map(offer => {
              const unavailable = disabled || offer.status === "offsale" || offer.status === "cancelled";
              return <div key={offer.id} className="text-right">
                {price(offer) && <p className="mb-1 text-xs text-zinc-500">{price(offer)}</p>}
                {unavailable ? <span className="inline-flex rounded-xl bg-zinc-200 px-4 py-2 text-sm font-bold text-zinc-600">{statusNames[concert.status] ?? statusNames[offer.status] ?? "Niedostępne"}</span> :
                  <a href={offer.url} target="_blank" rel="noreferrer sponsored" className="inline-flex rounded-xl bg-zinc-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-zinc-700">Kup bilet · Ticketmaster ↗</a>}
              </div>;
            })}
          </div>
        </li>;
      })}</ol>}
    <p className="mt-5 text-xs text-zinc-500">Terminy i dostępność biletów pochodzą z Ticketmaster. Przed zakupem sprawdź szczegóły u sprzedawcy.</p>
  </section>;
}
