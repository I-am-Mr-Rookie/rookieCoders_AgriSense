import test from "node:test";
import assert from "node:assert/strict";

import { clearWeatherCache, getWeather } from "../server/weather.js";

function jsonResponse(data) {
  return { ok: true, status: 200, json: async () => data };
}

function createFetch() {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    if (String(url).includes("geocoding-api")) {
      return jsonResponse({ results: [{ name: "Gazipur", admin1: "Dhaka", latitude: 24, longitude: 90 }] });
    }
    return jsonResponse({
      current: { temperature_2m: 27, precipitation: 0 },
      daily: {
        time: ["2026-07-25"],
        temperature_2m_mean: [26],
        precipitation_sum: [12],
      },
    });
  };
  return { calls, fetchImpl };
}

test("weather cache avoids both remote calls for a repeated normalized location", async () => {
  clearWeatherCache();
  const remote = createFetch();
  const first = await getWeather(" Gazipur ", { fetchImpl: remote.fetchImpl, now: () => 1_000 });
  const second = await getWeather("gazipur", { fetchImpl: remote.fetchImpl, now: () => 2_000 });

  assert.equal(remote.calls.length, 2);
  assert.deepEqual(second, first);
});

test("weather cache expires after the bounded TTL", async () => {
  clearWeatherCache();
  const remote = createFetch();
  await getWeather("Gazipur", { fetchImpl: remote.fetchImpl, now: () => 1_000, cacheTtlMs: 10 });
  await getWeather("Gazipur", { fetchImpl: remote.fetchImpl, now: () => 1_011, cacheTtlMs: 10 });

  assert.equal(remote.calls.length, 4);
});

test("concurrent requests for the same location share one in-flight weather lookup", async () => {
  clearWeatherCache();
  const remote = createFetch();

  const [first, second] = await Promise.all([
    getWeather("Gazipur", { fetchImpl: remote.fetchImpl, now: () => 1_000 }),
    getWeather("gazipur", { fetchImpl: remote.fetchImpl, now: () => 1_000 }),
  ]);

  assert.equal(remote.calls.length, 2);
  assert.deepEqual(second, first);
});
