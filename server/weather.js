function assertFetch(response, label) {
  if (!response.ok) throw new Error(`${label} failed with HTTP ${response.status}`);
}

const weatherCache = new Map();
const weatherInFlight = new Map();

export function clearWeatherCache() {
  weatherCache.clear();
  weatherInFlight.clear();
}

function boundedSignal(signal) {
  const timeout = AbortSignal.timeout(7000);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

async function fetchWeather(location, fetchImpl, currentTime, signal) {
  const geocodeUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
  geocodeUrl.search = new URLSearchParams({ name: String(location).trim(), count: "1", language: "en", countryCode: "BD" });
  const geocodeResponse = await fetchImpl(geocodeUrl, { signal: boundedSignal(signal) });
  assertFetch(geocodeResponse, "Geocoding");
  const geocode = await geocodeResponse.json();
  const place = geocode.results?.[0];
  if (!place) throw new Error(`No Bangladesh location found for ${location}`);

  const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
  forecastUrl.search = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    daily: "temperature_2m_mean,precipitation_sum",
    current: "temperature_2m,precipitation",
    timezone: "Asia/Dhaka",
    forecast_days: "7",
  });
  const forecastResponse = await fetchImpl(forecastUrl, { signal: boundedSignal(signal) });
  assertFetch(forecastResponse, "Forecast");
  const forecast = await forecastResponse.json();
  const temperatures = forecast.daily?.temperature_2m_mean ?? [];
  const precipitation = forecast.daily?.precipitation_sum ?? [];

  return {
    source: "Open-Meteo",
    sourceUrl: forecastUrl.toString(),
    retrievedAt: new Date(currentTime).toISOString(),
    location: `${place.name}${place.admin1 ? `, ${place.admin1}` : ""}, Bangladesh`,
    latitude: place.latitude,
    longitude: place.longitude,
    currentTemperatureC: forecast.current?.temperature_2m ?? null,
    meanTemperatureC: temperatures.length ? temperatures.reduce((a, b) => a + b, 0) / temperatures.length : forecast.current?.temperature_2m,
    precipitationMm: precipitation.reduce((a, b) => a + b, 0),
    daily: forecast.daily,
  };
}

export async function getWeather(
  location,
  {
    fetchImpl = fetch,
    now = Date.now,
    cacheTtlMs = 5 * 60 * 1000,
    signal,
  } = {},
) {
  const normalizedLocation = String(location || "").trim().toLocaleLowerCase("en");
  const currentTime = Number(now());
  const cached = weatherCache.get(normalizedLocation);
  if (cached && cached.expiresAt > currentTime) return cached.value;

  if (signal) {
    const value = await fetchWeather(location, fetchImpl, currentTime, signal);
    weatherCache.set(normalizedLocation, {
      expiresAt: currentTime + Math.max(0, Number(cacheTtlMs)),
      value,
    });
    return value;
  }

  if (weatherInFlight.has(normalizedLocation)) return weatherInFlight.get(normalizedLocation);

  const request = fetchWeather(location, fetchImpl, currentTime, signal);
  weatherInFlight.set(normalizedLocation, request);
  try {
    const value = await request;
    weatherCache.set(normalizedLocation, {
      expiresAt: currentTime + Math.max(0, Number(cacheTtlMs)),
      value,
    });
    return value;
  } finally {
    if (weatherInFlight.get(normalizedLocation) === request) {
      weatherInFlight.delete(normalizedLocation);
    }
  }
}
