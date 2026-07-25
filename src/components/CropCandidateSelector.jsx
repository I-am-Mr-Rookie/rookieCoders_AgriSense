function money(value) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function CropCandidateSelector({
  candidates = [],
  profile = {},
  selectedCropId = "",
  busy = false,
  language = "en",
  onSelect,
}) {
  if (candidates.length !== 4) return null;
  const bn = language === "bn";
  return (
    <section className="candidate-selector" aria-labelledby="candidate-title">
      <div className="candidate-heading">
        <div>
          <span>{bn ? "পরিকল্পনার আগে" : "Choose before planning"}</span>
          <h3 id="candidate-title">{bn ? "একটি ফসল বেছে নিন" : "Choose one crop"}</h3>
        </div>
        <p>{bn ? `বাজেট ${money(profile.budgetBdt)}` : `Saved budget ${money(profile.budgetBdt)}`}</p>
      </div>
      <div className="candidate-grid" role="radiogroup" aria-label={bn ? "ফসলের চারটি বিকল্প" : "Four crop options"}>
        {candidates.map((crop, index) => {
          const chosen = selectedCropId === crop.id;
          const gap = Number(crop.budgetGapBdt || 0);
          return (
            <article className={`candidate-card ${chosen ? "selected" : ""}`} key={crop.id}>
              <div className="candidate-title-row">
                <span>#{index + 1}</span>
                <h4>{crop.name}</h4>
                <b>{crop.suitability}%</b>
              </div>
              <p>{crop.summary}</p>
              <div className="candidate-tradeoffs">
                <div><strong>{bn ? "সুবিধা" : "Pros"}</strong><ul>{crop.pros.map((item) => <li key={item}>{item}</li>)}</ul></div>
                <div><strong>{bn ? "সীমাবদ্ধতা" : "Cons"}</strong><ul>{crop.cons.map((item) => <li key={item}>{item}</li>)}</ul></div>
              </div>
              <dl className="candidate-finances">
                <div><dt>{bn ? "পুরো জমির খরচ" : "Full-farm cost"}</dt><dd>{money(crop.fullFarmCostBdt)}</dd></div>
                <div><dt>{gap ? (bn ? "ঘাটতি" : "Shortfall") : (bn ? "অবশিষ্ট" : "Remaining")}</dt><dd className={gap ? "shortfall" : "remaining"}>{money(gap || crop.budgetRemainingBdt)}</dd></div>
                <div><dt>{bn ? "বাজেটে চাষ" : "Affordable area"}</dt><dd>{crop.plannedAreaAcres} {bn ? "একর" : "acres"}</dd></div>
                <div><dt>{bn ? "পরিকল্পিত খরচ" : "Planned cost"}</dt><dd>{money(crop.plannedCostBdt)}</dd></div>
              </dl>
              <button
                type="button"
                role="radio"
                aria-checked={chosen}
                disabled={busy || Boolean(selectedCropId)}
                onClick={() => onSelect(crop)}
              >
                {chosen ? (bn ? "নির্বাচিত" : "Selected") : (bn ? "এই ফসল নিন" : "Choose crop")}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
