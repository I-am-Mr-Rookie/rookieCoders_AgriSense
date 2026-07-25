import LanguageControl from "./LanguageControl.jsx";
import { t } from "../i18n.js";

const REPOSITORY_URL = "https://github.com/I-am-Mr-Rookie/rookieCoders_AgriSense";

export default function LandingPage({ onSignup, onLogin, language, onLanguage }) {
  return (
    <main className="landing-page">
      <LanguageControl language={language} onChange={onLanguage} landing />
      <div className="landing-field-orbit" aria-hidden="true">
        <span className="orbit orbit-one" />
        <span className="orbit orbit-two" />
        <span className="orbit-seed">A</span>
      </div>
      <section className="landing-copy" aria-labelledby="landing-title">
        <p className="landing-kicker">Rookie Coders presents</p>
        <h1 id="landing-title">{t(language, "promise")}</h1>
        <p className="landing-lede">{t(language, "lede")}</p>
        <div className="landing-actions">
          <button type="button" className="landing-primary" onClick={onSignup}>{t(language, "signup")}</button>
          <button type="button" className="landing-secondary" onClick={onLogin}>{t(language, "login")}</button>
          <a className="landing-github" href={REPOSITORY_URL} target="_blank" rel="noreferrer">
            <span aria-hidden="true">↗</span> {t(language, "github")}
          </a>
        </div>
      </section>
      <p className="landing-domain">rookiecoders.tech</p>
    </main>
  );
}
