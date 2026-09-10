import SuperJSON from "superjson";

// Independent acceptance oracle. Do not import the product comparator here.
export function orderedRecommendations(
  rows: any[],
  dates: Record<number, Date>
) {
  return [...rows].sort((left, right) => {
    if (left.totalScore > right.totalScore) return -1;
    if (left.totalScore < right.totalScore) return 1;
    const l = dates[left.customerId].getTime(),
      r = dates[right.customerId].getTime();
    if (l > r) return -1;
    if (l < r) return 1;
    return left.customerId < right.customerId
      ? -1
      : left.customerId > right.customerId
        ? 1
        : 0;
  });
}

export function policyGolden(key: string, golden: Record<string, any>) {
  if (key === "createdAt") {
    // Ordering metadata is only defined for eligible candidates. Excluded rows
    // in the PRE fixture may have a DB-generated clock value, unused by scoring.
    const ids = new Set(
      SuperJSON.deserialize<any[]>(golden["full/1"]).map(row => row.customerId)
    );
    const dates = SuperJSON.deserialize<Record<number, Date>>(golden.createdAt);
    return SuperJSON.serialize(
      Object.fromEntries(
        Object.entries(dates).filter(([id]) => ids.has(Number(id)))
      )
    );
  }
  const [kind, actor, limitOrUrgency, warnings] = key.split("/");
  if (
    !["priority", "urgency", "default", "raw-keys", "summary", "ties"].includes(
      kind
    )
  )
    return golden[key];
  const owner = kind === "ties" ? "4" : actor;
  const full = SuperJSON.deserialize<any[]>(golden[`full/${owner}`]);
  const dates = SuperJSON.deserialize<Record<number, Date>>(golden.createdAt);
  let rows = orderedRecommendations(
    full.filter(row => row.totalScore > 0),
    dates
  );
  if (kind === "urgency")
    rows = rows.filter(row => row.urgency === limitOrUrgency);
  if (kind === "summary") {
    const summary = SuperJSON.deserialize<any>(golden[key]);
    return SuperJSON.serialize({ ...summary, topContacts: rows.slice(0, 5) });
  }
  if (kind === "ties")
    rows = rows.filter(row => [40001, 40002].includes(row.customerId));
  else
    rows = rows.slice(
      0,
      kind === "default"
        ? 10
        : kind === "priority"
          ? Number(limitOrUrgency)
          : 50
    );
  if (kind === "priority" && warnings === "false")
    rows = rows.map(row => ({ ...row, warnings: [] }));
  return SuperJSON.serialize(rows);
}
