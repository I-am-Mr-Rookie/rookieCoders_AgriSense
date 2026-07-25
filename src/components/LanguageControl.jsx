import { LANGUAGES } from "../i18n.js";

export default function LanguageControl({ language, onChange, landing = false }) {
  return (
    <div className={`language-control ${landing ? "landing-language" : ""}`} role="group" aria-label="Language / ভাষা">
      {LANGUAGES.map((item) => (
        <button type="button" key={item.value} aria-pressed={language === item.value} onClick={() => onChange(item.value)}>{item.label}</button>
      ))}
    </div>
  );
}
