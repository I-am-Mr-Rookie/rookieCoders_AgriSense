export function canonicalizeEvidenceUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const url = new URL(value.trim());
    if (
      (url.protocol !== "http:" && url.protocol !== "https:")
      || !url.hostname
    ) {
      return null;
    }

    url.hostname = url.hostname.toLowerCase();
    url.hash = "";
    if (
      (url.protocol === "http:" && url.port === "80")
      || (url.protocol === "https:" && url.port === "443")
    ) {
      url.port = "";
    }
    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    }
    url.searchParams.sort();
    return url.toString();
  } catch {
    return null;
  }
}

export function groupEvidenceRecords(records = []) {
  const groups = [];
  const groupsByKey = new Map();

  records.forEach((record, index) => {
    const canonicalUrl = canonicalizeEvidenceUrl(record?.url)
      ?? canonicalizeEvidenceUrl(record?.sourceUrl);
    const hasEvidenceId = record?.id != null && String(record.id).trim();
    const key = canonicalUrl
      ? `url:${canonicalUrl}`
      : hasEvidenceId
        ? `id:${record.id}`
        : `record:${index}`;

    let group = groupsByKey.get(key);
    if (!group) {
      group = {
        canonicalUrl,
        publisher: record?.publisher ?? null,
        title: record?.title ?? record?.sourceTitle ?? null,
        records: [],
        count: 0,
      };
      groupsByKey.set(key, group);
      groups.push(group);
    }

    group.records.push(record);
    group.count = group.records.length;
  });

  return groups;
}
