import { t } from "../i18n.js";

export default function VoiceOrb({ open, status, transcript, onClose, language = "en" }) {
  if (!open) return null;
  const label = status === "connecting" ? t(language, "connecting") : t(language, "listening");
  return (
    <div className="voice-orb-backdrop" role="dialog" aria-modal="true" aria-label={t(language, "banglaVoice")}>
      <div className={`voice-orb ${status}`} aria-hidden="true"><span /><i /><b /></div>
      <p className="voice-orb-label">{label}</p>
      <p className="voice-orb-transcript">{transcript || t(language, "speakNow")}</p>
      <button type="button" onClick={onClose}>{t(language, "endVoice")}</button>
    </div>
  );
}
