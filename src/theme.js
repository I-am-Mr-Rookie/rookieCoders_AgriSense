const THEME_KEY = "agrisense.theme";
const THEMES = new Set(["system", "light", "dark"]);

export function loadThemePreference(storage = globalThis.localStorage) {
  try {
    const value = storage?.getItem?.(THEME_KEY);
    return THEMES.has(value) ? value : "system";
  } catch {
    return "system";
  }
}

export function persistThemePreference(theme, storage = globalThis.localStorage) {
  const value = THEMES.has(theme) ? theme : "system";
  try {
    storage?.setItem?.(THEME_KEY, value);
  } catch {
    // A locked-down browser can deny storage while the live theme still works.
  }
  return value;
}

export function applyTheme(theme, root = globalThis.document?.documentElement) {
  if (!root) return theme;
  if (theme === "light" || theme === "dark") root.setAttribute("data-theme", theme);
  else root.removeAttribute("data-theme");
  return theme;
}
