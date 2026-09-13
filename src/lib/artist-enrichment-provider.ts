export type EnrichmentFacts = {
  name: string;
  realName: string | null;
  birthDate: string | null;
  birthDatePrecision: "day" | "month" | "year" | null;
  birthPlace: string | null;
  countryCode: string | null;
  description: string | null;
};

export type EnrichmentCandidate = EnrichmentFacts & {
  source: "wikidata" | "musicbrainz";
  sourceId: string;
  sourceUrl: string;
  confidence: number;
  evidence: Record<string, unknown>;
};

type Fetcher = typeof fetch;
type BindingValue = { value?: unknown };
type Binding = Record<string, BindingValue | undefined>;

const requestHeaders = {
  Accept: "application/json",
  "User-Agent": "TAPEBASE/0.1 (artist metadata enrichment; contact via tapebase.pl)",
};
let nextMusicBrainzRequestAt = 0;

async function musicBrainzRequest(url: URL, fetcher: Fetcher) {
  if (fetcher === fetch) {
    const wait = nextMusicBrainzRequestAt - Date.now();
    if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
    nextMusicBrainzRequestAt = Date.now() + 1100;
  }
  return fetcher(url, { headers: requestHeaders, signal: AbortSignal.timeout(15_000), cache: "no-store" });
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function string(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalized(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pl-PL")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

function binding(row: Binding, key: string) {
  return string(row[key]?.value);
}

function parseWikidataDate(value: string | null): Pick<EnrichmentFacts, "birthDate" | "birthDatePrecision"> {
  if (!value) return { birthDate: null, birthDatePrecision: null };
  const match = value.match(/^[+-]?(\d{4})-(\d{2})-(\d{2})/);
  if (!match || Number(match[1]) < 1) return { birthDate: null, birthDatePrecision: null };
  const [, year, month, day] = match;
  if (month === "00") return { birthDate: `${year}-01-01`, birthDatePrecision: "year" };
  if (day === "00") return { birthDate: `${year}-${month}-01`, birthDatePrecision: "month" };
  return { birthDate: `${year}-${month}-${day}`, birthDatePrecision: "day" };
}

function shortBio(name: string, sourceDescription: string | null, facts: Pick<EnrichmentFacts, "realName" | "birthDate" | "birthDatePrecision" | "birthPlace" | "countryCode">) {
  const sentences: string[] = [];
  if (sourceDescription) {
    const clean = sourceDescription.replace(/\s+/g, " ").replace(/[.!?]+$/, "").slice(0, 220);
    if (clean && normalized(clean) !== normalized(name)) sentences.push(`${name} to ${clean.charAt(0).toLocaleLowerCase("pl-PL")}${clean.slice(1)}.`);
  }
  if (facts.realName && normalized(facts.realName) !== normalized(name)) sentences.push(`Naprawdę nazywa się ${facts.realName}.`);
  if (facts.birthDate) {
    const date = facts.birthDatePrecision === "year" ? facts.birthDate.slice(0, 4)
      : facts.birthDatePrecision === "month" ? facts.birthDate.slice(0, 7) : facts.birthDate;
    sentences.push(`Data urodzenia: ${date}${facts.birthPlace ? `, miejsce urodzenia: ${facts.birthPlace}` : ""}.`);
  } else if (facts.birthPlace) sentences.push(`Miejsce pochodzenia lub urodzenia: ${facts.birthPlace}.`);
  return sentences.join(" ") || null;
}

function wikidataQuery(filter: string) {
  return `SELECT DISTINCT ?item ?itemLabel ?itemDescription ?birthDate ?birthPlaceLabel ?birthName ?countryCode WHERE {
    ${filter}
    OPTIONAL { ?item wdt:P569 ?birthDate. }
    OPTIONAL { ?item wdt:P19 ?birthPlace. }
    OPTIONAL { ?item wdt:P1477 ?birthName. FILTER(LANG(?birthName) = "" || LANG(?birthName) = "pl") }
    OPTIONAL { ?item wdt:P27|wdt:P495 ?country. OPTIONAL { ?country wdt:P297 ?countryCode. } }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "pl,en". }
  } LIMIT 20`;
}

async function wikidataSparql(query: string, fetcher: Fetcher): Promise<Binding[]> {
  const url = new URL("https://query.wikidata.org/sparql");
  url.searchParams.set("query", query);
  url.searchParams.set("format", "json");
  const response = await fetcher(url, { headers: requestHeaders, signal: AbortSignal.timeout(15_000), cache: "no-store" });
  if (!response.ok) throw new Error(`Wikidata zwróciła HTTP ${response.status}.`);
  const rows = object(object(await response.json()).results).bindings;
  if (!Array.isArray(rows)) throw new Error("Wikidata zwróciła nieprawidłową odpowiedź.");
  return rows.map(value => object(value) as Binding);
}

function wikidataCandidate(rows: Binding[], spotifyIdMatched: boolean): EnrichmentCandidate | null {
  const first = rows[0];
  if (!first) return null;
  const rawItemUrl = binding(first, "item");
  const sourceId = rawItemUrl?.match(/\/entity\/(Q\d+)$/)?.[1];
  const name = binding(first, "itemLabel");
  if (!rawItemUrl || !sourceId || !name) return null;
  const itemUrl = `https://www.wikidata.org/wiki/${sourceId}`;
  const date = parseWikidataDate(binding(first, "birthDate"));
  const base = {
    realName: binding(first, "birthName"),
    ...date,
    birthPlace: binding(first, "birthPlaceLabel"),
    countryCode: binding(first, "countryCode")?.toUpperCase() ?? null,
  };
  return {
    source: "wikidata", sourceId, sourceUrl: itemUrl, name, ...base,
    description: shortBio(name, binding(first, "itemDescription"), base),
    confidence: spotifyIdMatched ? 1 : 0.55,
    evidence: spotifyIdMatched ? { spotifyId: "exact" } : { name: "search-result-only" },
  };
}

export async function findExactWikidata(spotifyId: string, fetcher: Fetcher = fetch) {
  const safeId = spotifyId.replace(/[^A-Za-z0-9]/g, "");
  const rows = await wikidataSparql(wikidataQuery(`?item wdt:P1902 "${safeId}".`), fetcher);
  const ids = new Set(rows.map(row => binding(row, "item")).filter(Boolean));
  return ids.size === 1 ? wikidataCandidate(rows, true) : null;
}

export async function getWikidataByQid(qid: string, fetcher: Fetcher = fetch) {
  if (!/^Q\d+$/.test(qid)) throw new Error("Nieprawidłowy identyfikator Wikidata.");
  const rows = await wikidataSparql(wikidataQuery(`VALUES ?item { wd:${qid} }`), fetcher);
  return wikidataCandidate(rows, false);
}

export async function wikidataNameCandidates(name: string, fetcher: Fetcher = fetch): Promise<EnrichmentCandidate[]> {
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.search = new URLSearchParams({ action: "wbsearchentities", search: name, language: "pl", uselang: "pl", type: "item", limit: "5", format: "json", origin: "*" }).toString();
  const response = await fetcher(url, { headers: requestHeaders, signal: AbortSignal.timeout(15_000), cache: "no-store" });
  if (!response.ok) throw new Error(`Wikidata Search zwróciła HTTP ${response.status}.`);
  const search = object(await response.json()).search;
  if (!Array.isArray(search)) return [];
  return search.slice(0, 5).flatMap(item => {
    const row = object(item), id = string(row.id), label = string(row.label);
    if (!id?.match(/^Q\d+$/) || !label) return [];
    const sourceDescription = string(row.description);
    const context = normalized(sourceDescription ?? "");
    const plausible = ["raper", "muzyk", "piosenkar", "wokalist", "producent muzyczny", "kompozytor", "didzej", "dj", "zespol muzyczny", "musician", "rapper", "singer", "songwriter", "record producer", "composer", "musical group", "band", "youtuber", "influencer"]
      .some(term => context.includes(normalized(term)));
    if (!plausible) return [];
    const exactName = normalized(label) === normalized(name);
    return [{
      source: "wikidata" as const, sourceId: id, sourceUrl: `https://www.wikidata.org/wiki/${id}`,
      name: label, realName: null, birthDate: null, birthDatePrecision: null, birthPlace: null, countryCode: null,
      description: sourceDescription, confidence: exactName ? 0.65 : 0.35,
      evidence: { name: exactName ? "exact" : "similar", searchOnly: true },
    }];
  });
}

export async function findExactMusicBrainz(spotifyId: string, fetcher: Fetcher = fetch): Promise<EnrichmentCandidate | null> {
  const url = new URL("https://musicbrainz.org/ws/2/url");
  url.searchParams.set("resource", `https://open.spotify.com/artist/${spotifyId}`);
  url.searchParams.set("inc", "artist-rels");
  url.searchParams.set("fmt", "json");
  const response = await musicBrainzRequest(url, fetcher);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`MusicBrainz zwrócił HTTP ${response.status}.`);
  const relations = object(await response.json()).relations;
  if (!Array.isArray(relations)) return null;
  const artists = relations.map(relation => object(object(relation).artist)).filter(artist => string(artist.id));
  if (artists.length !== 1) return null;
  const linked = artists[0], mbid = string(linked.id)!;
  const detailUrl = new URL(`https://musicbrainz.org/ws/2/artist/${mbid}`);
  detailUrl.searchParams.set("inc", "aliases"); detailUrl.searchParams.set("fmt", "json");
  const detailResponse = await musicBrainzRequest(detailUrl, fetcher);
  if (!detailResponse.ok) throw new Error(`MusicBrainz zwrócił HTTP ${detailResponse.status}.`);
  const detail = object(await detailResponse.json());
  const name = string(detail.name) ?? string(linked.name);
  if (!name) return null;
  const life = object(detail["life-span"]), area = object(detail["begin-area"]), begin = string(life.begin);
  const date = begin?.match(/^\d{4}(-\d{2})?(-\d{2})?$/);
  const birthDate = date ? `${date[1] ? begin : `${begin}-01-01`}${date[1] && !date[2] ? "-01" : ""}` : null;
  const precision = date ? (date[2] ? "day" : date[1] ? "month" : "year") as EnrichmentFacts["birthDatePrecision"] : null;
  const facts = { realName: null, birthDate, birthDatePrecision: precision, birthPlace: string(area.name), countryCode: string(detail.country)?.toUpperCase() ?? null };
  return {
    source: "musicbrainz", sourceId: mbid, sourceUrl: `https://musicbrainz.org/artist/${mbid}`,
    name, ...facts, description: shortBio(name, string(detail.disambiguation), facts),
    confidence: 0.98, evidence: { spotifyUrl: "exact" },
  };
}

export async function findArtistEnrichment(artist: { name: string; spotifyId: string }, fetcher: Fetcher = fetch) {
  const wikidata = await findExactWikidata(artist.spotifyId, fetcher);
  if (wikidata) return { exact: wikidata, candidates: [] as EnrichmentCandidate[] };
  let musicbrainz: EnrichmentCandidate | null = null;
  let musicbrainzError: unknown;
  try { musicbrainz = await findExactMusicBrainz(artist.spotifyId, fetcher); }
  catch (error) { musicbrainzError = error; }
  if (musicbrainz) return { exact: musicbrainz, candidates: [] as EnrichmentCandidate[] };
  const candidates = await wikidataNameCandidates(artist.name, fetcher);
  if (!candidates.length && musicbrainzError) throw musicbrainzError;
  return { exact: null, candidates };
}
