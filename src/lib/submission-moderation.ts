const editionWords = "deluxe|expanded|anniversary|remaster(?:ed)?|reissue|bonus|special|collector(?:s)?|limited|edition|wersja|edycja|instrumental|clean|explicit";

function plain(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function albumEditionKey(title: string) {
  return plain(title)
    .replace(new RegExp(`\\s*[([][^)\\]]*(?:${editionWords})[^)\\]]*[)\\]]\\s*$`, "i"), "")
    .replace(new RegExp(`\\s*[-–—:]\\s*(?:${editionWords}).*$`, "i"), "")
    .replace(new RegExp(`\\s+(?:${editionWords})(?:\\s+(?:version|edition|wersja|edycja))?\\s*$`, "i"), "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isPossibleAlbumEdition(submittedTitle: string, catalogTitle: string) {
  const submitted = albumEditionKey(submittedTitle);
  const catalog = albumEditionKey(catalogTitle);
  return submitted.length >= 2 && submitted === catalog;
}
