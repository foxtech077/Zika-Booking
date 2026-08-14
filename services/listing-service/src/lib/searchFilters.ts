/**
 * Shared SQL fragments for the user-rating (guest review) filter and the
 * `user_ratings_desc` sort.
 *
 * A listing's "user rating" is the average of its visible guest reviews.
 * Listings with no visible reviews have no rating at all (AVG is NULL).
 *
 * NULL semantics (deliberate): when a user-rating threshold is applied, a
 * listing without any visible reviews does NOT meet the threshold and is
 * excluded. The filter therefore COALESCEs the average to -1 (below any
 * valid threshold, since ratings are 1-5) so the exclusion is explicit in
 * SQL instead of falling out of three-valued logic (NULL >= x is NULL,
 * which previously dropped rows silently and invisibly).
 */

/** The review-average expression used by both the filter and the sort. */
export const USER_RATING_AVG_SQL =
  "(SELECT AVG(r.rating) FROM listing.listing_reviews r WHERE r.listing_id = l.id AND r.is_hidden = false)";

/**
 * WHERE-clause fragment: keep only listings whose average user rating meets
 * the threshold. Allocates one `$N` placeholder via `next()`; the caller must
 * push the `ratingMin` value as the matching parameter.
 */
export function buildUserRatingFilterClause(next: () => string, ratingMin: number): string {
  return `COALESCE(${USER_RATING_AVG_SQL}, -1) >= ${next()}`;
}

/**
 * ORDER BY expression for the `user_ratings_desc` sort: highest average user
 * rating first, listings without reviews last.
 */
export function userRatingsOrderExpr(): string {
  return `${USER_RATING_AVG_SQL} DESC NULLS LAST`;
}
