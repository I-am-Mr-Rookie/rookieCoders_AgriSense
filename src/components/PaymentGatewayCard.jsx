import { t } from "../i18n.js";

export default function PaymentGatewayCard({
  status,
  language = "en",
}) {
  const checking = status?.state === "checking";
  return (
    <section className="panel payment-gateway-card" aria-live="polite">
      <div className="payment-gateway-heading">
        <div>
          <span className="eyebrow">{t(language, "todayAccess")}</span>
          <h2>{t(language, "dailyPrice")}</h2>
        </div>
        <span className="gateway-state online">
          {checking
            ? t(language, "checking")
            : t(language, "accessActive")}
        </span>
      </div>
      <p>{t(language, "accessCopy")}</p>
    </section>
  );
}
