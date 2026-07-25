import { t } from "../i18n.js";

export function PlanRevisionCard({
  revision,
  canCreate,
  busy,
  onCreatePlan,
  language = "en",
}) {
  if (!revision) return null;

  if (revision.completed) {
    return <p className="revision-complete">{t(language, "updatedPlanSaved")}</p>;
  }

  if (!revision.readyToPlan) return null;

  return (
    <aside className="plan-revision-card" aria-label={t(language, "planUpdateReady")}>
      <span className="revision-kicker">{t(language, "planUpdateReady")}</span>
      <p>{t(language, "revisionSaved")}</p>
      {canCreate && (
        <button type="button" disabled={busy} onClick={onCreatePlan}>
          {busy ? t(language, "creatingUpdatedPlan") : t(language, "createUpdatedPlan")}
        </button>
      )}
    </aside>
  );
}
