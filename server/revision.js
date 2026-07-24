export function getReleaseRevision(environment = process.env) {
  const revision = environment.APP_REVISION?.trim();
  return revision || "unknown";
}
