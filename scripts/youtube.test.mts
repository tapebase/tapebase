import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyChannel,
  parseYouTubeChannelId,
  parseYouTubeDuration,
  parseYouTubeVideoId,
  scoreVideoCandidate,
  type VideoCandidate,
} from "../src/lib/youtube.ts";

const video: VideoCandidate = {
  videoId: "abcdefghijk",
  title: "Quebonafide - Candy (official music video)",
  thumbnailUrl: null,
  channelId: "UCabcdefghijklmnopqrstuv",
  channelTitle: "QueQuality",
  publishedAt: "2020-01-01T00:00:00Z",
  viewCount: 1000000,
  durationSeconds: 240,
  embeddable: true,
  available: true,
  live: false,
};

test("parses YouTube IDs only from supported addresses", () => {
  assert.equal(parseYouTubeVideoId("https://youtu.be/abcdefghijk"), "abcdefghijk");
  assert.equal(parseYouTubeVideoId("https://www.youtube.com/watch?v=abcdefghijk&t=2"), "abcdefghijk");
  assert.equal(parseYouTubeVideoId("https://www.youtube.com/shorts/abcdefghijk"), "abcdefghijk");
  assert.equal(parseYouTubeVideoId("https://example.com/watch?v=abcdefghijk"), null);
  assert.equal(parseYouTubeChannelId("https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv"), "UCabcdefghijklmnopqrstuv");
  assert.equal(parseYouTubeChannelId("@artist"), null);
});

test("parses ISO 8601 video durations", () => {
  assert.equal(parseYouTubeDuration("PT4M5S"), 245);
  assert.equal(parseYouTubeDuration("PT1H2M3S"), 3723);
  assert.equal(parseYouTubeDuration("invalid"), null);
});

test("auto-approves a matching track only on a verified channel", () => {
  const match = scoreVideoCandidate({
    video, artistName: "Quebonafide", tracks: [{ id: 7, title: "Candy" }], verifiedChannel: true,
  });
  assert.equal(match.rejected, false);
  assert.equal(match.autoApprove, true);
  assert.equal(match.matchedTrackId, 7);

  const uncertain = scoreVideoCandidate({
    video, artistName: "Quebonafide", tracks: [{ id: 7, title: "Candy" }], verifiedChannel: false,
  });
  assert.equal(uncertain.autoApprove, false);
});

test("rejects audio, live, reaction and unavailable results", () => {
  for (const title of ["Candy (Official Audio)", "Candy live", "Reaction to Candy", "Candy lyric video"]) {
    assert.equal(scoreVideoCandidate({
      video: { ...video, title }, artistName: "Quebonafide", tracks: [{ id: 7, title: "Candy" }], verifiedChannel: true,
    }).rejected, true, title);
  }
  assert.equal(scoreVideoCandidate({
    video: { ...video, embeddable: false }, artistName: "Quebonafide", tracks: [], verifiedChannel: true,
  }).rejected, true);
});

test("recognizes common publisher channel types", () => {
  assert.equal(classifyChannel("ArtistVEVO"), "vevo");
  assert.equal(classifyChannel("XYZ Records"), "label");
  assert.equal(classifyChannel("Artist Official"), "publisher");
});
