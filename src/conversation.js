export function createRevisionState() {
  return {
    pendingField: "",
    awaitingField: false,
    changedFields: [],
    readyToPlan: false,
    planStale: false,
  };
}
export function appendChatTurn(items, farmerText, data, currentRevision = createRevisionState()) {
  const revision = {
    pendingField: data.pendingField ?? "",
    awaitingField: data.kind === "clarify_field",
    changedFields: data.changedFields ?? currentRevision.changedFields ?? [],
    readyToPlan: data.readyToPlan === true,
    planStale: data.planStale === true,
  };
  const agentItem = {
    role: "agent",
    text: data.assistant,
    ...(data.kind !== "general" ? { revision: { ...revision, kind: data.kind } } : {}),
  };

  return {
    items: [
      ...items,
      { role: "farmer", text: farmerText },
      agentItem,
    ],
    revision,
  };
}

export function canCreatePlanFrom(items, index) {
  if (!items[index]?.revision?.readyToPlan) return false;
  return items.findLastIndex((item) => item.revision?.readyToPlan) === index;
}

export function completePlanRevision(items) {
  return {
    items: items.map((item) => item.revision?.readyToPlan
      ? {
          ...item,
          revision: {
            readyToPlan: false,
            planStale: false,
            completed: true,
          },
        }
      : item),
    revision: createRevisionState(),
  };
}
