export function PlanRevisionCard({
  revision,
  canCreate,
  busy,
  onCreatePlan,
}) {
  if (!revision) return null;

  if (revision.completed) {
    return <p className="revision-complete">Updated plan created and saved.</p>;
  }

  if (!revision.readyToPlan) return null;

  return (
    <aside className="plan-revision-card" aria-label="Plan update ready">
      <span className="revision-kicker">Plan update ready</span>
      <p>Your new farm details are saved. The recommendation will change only when you create the updated plan.</p>
      {canCreate && (
        <button type="button" disabled={busy} onClick={onCreatePlan}>
          {busy ? "Creating updated plan…" : "Create updated plan"}
        </button>
      )}
    </aside>
  );
}
