import test from "node:test";
import assert from "node:assert/strict";

import {
  canonicalizeEvidenceUrl,
  groupEvidenceRecords,
} from "../src/evidence.js";

test("canonicalizes evidence URLs without changing non-root paths", () => {
  assert.equal(
    canonicalizeEvidenceUrl(
      "HTTPS://Example.COM:443/guides/fertilizer/?z=9&a=1#page=4",
    ),
    "https://example.com/guides/fertilizer?a=1&z=9",
  );
  assert.equal(
    canonicalizeEvidenceUrl("http://EXAMPLE.com:80/"),
    "http://example.com/",
  );
  assert.equal(canonicalizeEvidenceUrl("not a URL"), null);
  assert.equal(canonicalizeEvidenceUrl(), null);
  assert.equal(canonicalizeEvidenceUrl("javascript:alert(1)"), null);
  assert.equal(canonicalizeEvidenceUrl("ftp://example.com/source"), null);
  assert.equal(canonicalizeEvidenceUrl("ws://example.com/source"), null);
});

test("groups equivalent URLs in stable first-seen order and retains every record", () => {
  const records = [
    {
      id: "fertilizer-1",
      url: "https://BARC.gov.bd/guide/?crop=mustard&year=2024#page=5",
      publisher: "BARC",
      title: "Fertilizer guide",
      text: "Record one",
    },
    {
      id: "calendar-1",
      url: "https://fao.org/calendar",
      publisher: "FAO",
      title: "Crop calendar",
    },
    {
      id: "fertilizer-2",
      sourceUrl: "https://barc.gov.bd:443/guide?year=2024&crop=mustard",
      publisher: "BARC updated",
      title: "Second fertilizer record",
      text: "Record two",
    },
  ];

  const groups = groupEvidenceRecords(records);

  assert.equal(groups.length, 2);
  assert.deepEqual(
    groups.map((group) => group.canonicalUrl),
    [
      "https://barc.gov.bd/guide?crop=mustard&year=2024",
      "https://fao.org/calendar",
    ],
  );
  assert.equal(groups[0].publisher, "BARC");
  assert.equal(groups[0].title, "Fertilizer guide");
  assert.equal(groups[0].count, 2);
  assert.deepEqual(groups[0].records, [records[0], records[2]]);
  assert.equal(groups[1].count, 1);
});

test("groups invalid and missing URLs by evidence ID instead of dropping records", () => {
  const records = [
    { id: "local-1", url: "invalid", publisher: "Field note", title: "One" },
    { id: "local-2", publisher: "Field note", title: "Two" },
    { id: "local-1", url: "still invalid", publisher: "Field note", title: "Three" },
  ];

  const groups = groupEvidenceRecords(records);

  assert.equal(groups.length, 2);
  assert.equal(groups[0].canonicalUrl, null);
  assert.equal(groups[0].count, 2);
  assert.deepEqual(groups[0].records, [records[0], records[2]]);
  assert.equal(groups[1].canonicalUrl, null);
  assert.deepEqual(groups[1].records, [records[1]]);
});

test("retains URL-less records without IDs as separate first-seen groups", () => {
  const records = [
    { publisher: "Farmer observation", title: "North field" },
    { publisher: "Farmer observation", title: "South field" },
  ];

  const groups = groupEvidenceRecords(records);

  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map((group) => group.count), [1, 1]);
  assert.deepEqual(groups.flatMap((group) => group.records), records);
});

test("groups forbidden URL schemes by evidence ID", () => {
  const records = [
    { id: "unsafe-1", url: "ftp://example.com/source", title: "FTP record" },
    { id: "unsafe-2", url: "ftp://example.com/source", title: "Second FTP record" },
    { id: "unsafe-1", url: "javascript:alert(1)", title: "Script record" },
  ];

  const groups = groupEvidenceRecords(records);

  assert.equal(groups.length, 2);
  assert.equal(groups[0].canonicalUrl, null);
  assert.deepEqual(groups[0].records, [records[0], records[2]]);
  assert.equal(groups[1].canonicalUrl, null);
  assert.deepEqual(groups[1].records, [records[1]]);
});
