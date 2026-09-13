import test from "node:test";
import assert from "node:assert/strict";
import { duration, releaseDate } from "../src/lib/catalog-format.ts";
import { automaticMinimumVotes, rankingMinimum } from "../src/lib/rankings.ts";

test("partial dates do not invent days; full dates stay stable across time zones", () => {
  assert.equal(releaseDate({ release_date_raw: "2015", release_date_precision: "year", release_date: null }), "2015");
  assert.equal(releaseDate({ release_date_raw: "2015-02", release_date_precision: "month", release_date: null }), "luty 2015");
  assert.equal(releaseDate({ release_date_raw: "2017-06-14", release_date_precision: "day", release_date: "2017-06-14" }), "14 czerwca 2017");
  assert.equal(releaseDate({ release_date_raw: null, release_date_precision: null, release_date: null }), "Data nieznana");
});
test("track durations distinguish unknown from zero and round down to seconds", () => {
  assert.equal(duration(null), "—");
  assert.equal(duration(0), "0:00");
  assert.equal(duration(262999), "4:22");
});
test("ranking minimum grows with activity and validates manual filters", () => {
  assert.deepEqual([0, 49, 50, 249, 250, 999, 1000, 4999, 5000].map(automaticMinimumVotes), [1, 1, 3, 3, 5, 5, 10, 10, 25]);
  assert.deepEqual(rankingMinimum("5", 12), { value: 5, automatic: false });
  assert.deepEqual(rankingMinimum("0", 60), { value: 3, automatic: true });
  assert.deepEqual(rankingMinimum("abc", 1000), { value: 10, automatic: true });
});
