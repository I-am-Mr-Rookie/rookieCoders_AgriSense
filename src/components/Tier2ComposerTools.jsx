import React, { useRef } from "react";

import { t } from "../i18n.js";

function Icon({ children }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
      {children}
    </svg>
  );
}

export default function Tier2ComposerTools({
  disabled,
  marketMode,
  attachment,
  voiceStatus,
  onMarketToggle,
  onFile,
  onVoiceToggle,
  language = "en",
}) {
  const inputRef = useRef(null);
  const voiceActive = voiceStatus === "connecting" || voiceStatus === "listening";

  return (
    <div className="tier2-composer-tools" aria-label="AgriSense tools">
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
      <button
        type="button"
        className={attachment ? "is-active" : ""}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <Icon><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-9Z" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="m6.5 16 3.2-3.4 2.5 2.4 2.1-2.1 3.2 3.1M15.5 9.5h.01" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" /></Icon>
        <span>{t(language, "attachLeaf")}</span>
      </button>
      <button
        type="button"
        className={marketMode ? "is-active" : ""}
        aria-pressed={marketMode}
        disabled={disabled}
        onClick={onMarketToggle}
      >
        <Icon><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="m16 16 4 4M8 13.5l2-2 1.7 1.6L14.5 10" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" /></Icon>
        <span>{t(language, "market")}</span>
      </button>
      <button
        type="button"
        className={`voice-control ${voiceActive ? "is-active" : ""}`}
        aria-pressed={voiceActive}
        aria-label={voiceActive ? t(language, "stopVoice") : t(language, "banglaVoice")}
        disabled={disabled && !voiceActive}
        onClick={onVoiceToggle}
      >
        {voiceStatus === "listening" && <span className="voice-field-pulse" aria-hidden="true" />}
        <Icon><rect x="8.2" y="3" width="7.6" height="12" rx="3.8" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M5.7 11.5a6.3 6.3 0 0 0 12.6 0M12 17.8V21M9 21h6" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" /></Icon>
        <span>{voiceStatus === "connecting" ? t(language, "connecting") : voiceActive ? t(language, "listening") : t(language, "banglaVoice")}</span>
      </button>
    </div>
  );
}
