function assertFetch(response, label) {
  if (!response.ok) throw new Error(`${label} failed with HTTP ${response.status}`);
}

export async function getWeather(location) {
  const geocodeUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
  geocodeUrl.search = new URLSearchParams({ name: location, count: "1", language: "en", countryCode: "BD" });
  const geocodeResponse = await fetch(geocodeUrl, { signal: AbortSignal.timeout(7000) });
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
  const forecastResponse = await fetch(forecastUrl, { signal: AbortSignal.timeout(7000) });
  assertFetch(forecastResponse, "Forecast");
  const forecast = await forecastResponse.json();
  const temperatures = forecast.daily?.temperature_2m_mean ?? [];
  const precipitation = forecast.daily?.precipitation_sum ?? [];

  return {
    source: "Open-Meteo",
    sourceUrl: forecastUrl.toString(),
    retrievedAt: new Date().toISOString(),
    location: `${place.name}${place.admin1 ? `, ${place.admin1}` : ""}, Bangladesh`,
    latitude: place.latitude,
    longitude: place.longitude,
    currentTemperatureC: forecast.current?.temperature_2m ?? null,
    meanTemperatureC: temperatures.length ? temperatures.reduce((a, b) => a + b, 0) / temperatures.length : forecast.current?.temperature_2m,
    precipitationMm: precipitation.reduce((a, b) => a + b, 0),
    daily: forecast.daily,
  };
}
