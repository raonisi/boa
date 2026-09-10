type ScoredCustomer = { customerId: number; totalScore: number };

/** Recommendation Final Order V1. Dates stay internal; ID is only a final tie-break. */
export function compareRecommendationPriority(
  left: ScoredCustomer,
  right: ScoredCustomer,
  customerCreatedAt: ReadonlyMap<number, Date>
) {
  // Both items and this map come from the same eligible customer projection.
  // customers.createdAt is NOT NULL; no additional lookup or API field is needed.
  return (
    right.totalScore - left.totalScore ||
    customerCreatedAt.get(right.customerId)!.getTime() -
      customerCreatedAt.get(left.customerId)!.getTime() ||
    left.customerId - right.customerId
  );
}
