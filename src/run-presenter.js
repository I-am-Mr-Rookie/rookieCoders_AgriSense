export const DEFAULT_DEMO_STEP_DELAY_MS = 275;

function defaultWait(delayMs) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, delayMs));
}

export function createRunPresenter({
  mode = "live",
  reveal,
  stepDelayMs = DEFAULT_DEMO_STEP_DELAY_MS,
  wait = defaultWait,
}) {
  if (mode !== "live" && mode !== "demo") {
    throw new TypeError('Presentation mode must be "live" or "demo".');
  }
  if (typeof reveal !== "function") {
    throw new TypeError("A reveal function is required.");
  }

  let cancelled = false;
  let queue = Promise.resolve();

  function present(event) {
    if (cancelled) return queue;

    if (mode === "live") {
      reveal(event);
      return queue;
    }

    queue = queue.then(async () => {
      if (cancelled) return;
      reveal(event);
      await wait(stepDelayMs);
    });
    return queue;
  }

  function cancel() {
    cancelled = true;
  }

  function drain() {
    return queue;
  }

  return { present, cancel, drain };
}
