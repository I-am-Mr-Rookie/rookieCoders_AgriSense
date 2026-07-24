const SUMMARY_LIMIT = 600;

const PROFILE_FIELDS = [
  ["location", "Location", (value) => String(value).trim()],
  ["farmSizeAcres", "Area", (value) => `${Number(value)}ac`],
  ["soilType", "Soil", (value) => String(value).trim()],
  ["waterAvailability", "Water", (value) => String(value).trim()],
  ["budgetBdt", "Budget", (value) => `BDT${Math.round(Number(value))}`],
  ["targetSeason", "Season", (value) => String(value).trim()],
];

const PREFERENCES = [
  {
    label: "low risk",
    positive: /\b(?:prefer|want|use|choose|prioriti[sz]e)[^.]{0,32}\blow[- ]risk\b|\blow[- ]risk (?:plans?|options?)\b/i,
    negative: /\b(?:no longer|do not|don't|stop|avoid)[^.]{0,28}\blow[- ]risk\b/i,
  },
  {
    label: "low cost",
    positive: /\b(?:prefer|want|use|choose|prioriti[sz]e)[^.]{0,32}\blow[- ]cost\b|\blow[- ]cost (?:plans?|options?)\b/i,
    negative: /\b(?:no longer|do not|don't|stop|avoid)[^.]{0,28}\blow[- ]cost\b/i,
  },
  {
    label: "budget conscious",
    positive: /\bbudget[- ]conscious\b|\bkeep (?:the )?costs? (?:down|low)\b/i,
    negative: /\b(?:no longer|not) budget[- ]conscious\b/i,
  },
  {
    label: "conserve water",
    positive: /\bconserve water\b|\bsave water\b|\bwater[- ]efficient\b/i,
    negative: /\b(?:do not|don't|stop|no longer) (?:conserve|save) water\b/i,
  },
  {
    label: "organic preference",
    positive: /\bprefer organic\b|\borganic (?:methods?|inputs?|preference)\b/i,
    negative: /\b(?:do not|don't|stop|no longer) prefer organic\b|\bavoid organic\b/i,
  },
];

function previousPreferences(summary) {
  const match = String(summary || "").match(/(?:^| \| )Preferences=([^|]+)/);
  return new Set(
    match
      ? match[1].split(",").map((value) => value.trim()).filter(Boolean)
      : [],
  );
}

export function buildCompactMemorySummary({
  profile = {},
  message = "",
  previousSummary = "",
} = {}) {
  const parts = PROFILE_FIELDS.flatMap(([key, label, format]) => {
    const value = profile[key];
    if (value === undefined || value === null || value === "") return [];
    const formatted = format(value);
    return formatted && formatted !== "NaN" && !formatted.includes("NaN")
      ? [`${label}=${formatted}`]
      : [];
  });

  const preferences = previousPreferences(previousSummary);
  const text = String(message || "");
  for (const preference of PREFERENCES) {
    if (preference.negative.test(text)) preferences.delete(preference.label);
    else if (preference.positive.test(text)) preferences.add(preference.label);
  }
  if (preferences.size) parts.push(`Preferences=${[...preferences].join(", ")}`);

  return parts.join(" | ").slice(0, SUMMARY_LIMIT);
}
