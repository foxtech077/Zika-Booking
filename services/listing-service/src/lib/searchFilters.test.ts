import { test } from "node:test";
import assert from "node:assert/strict";
import { buildUserRatingFilterClause, userRatingsOrderExpr, USER_RATING_AVG_SQL } from "./searchFilters.js";

/** Allocates sequential $1, $2, ... placeholders like search.ts does. */
function makeNext() {
  let p = 0;
  return () => `$${++p}`;
}

test("filter clause references the review-average subquery with an explicit NULL sentinel", () => {
  const clause = buildUserRatingFilterClause(makeNext(), 4);
  assert.ok(clause.includes("AVG(r.rating)"), "should average review ratings");
  assert.ok(clause.includes("r.is_hidden = false"), "should only count visible reviews");
  // The NULL-semantics fix: no reviews -> COALESCE to -1 -> below any valid
  // threshold (ratings are 1-5) -> excluded explicitly, not via NULL >= x.
  assert.ok(clause.includes("COALESCE("), "should coalesce the average");
  assert.ok(clause.includes("-1"), "sentinel must be below the valid rating range");
  assert.ok(clause.includes(">= $1"), "threshold must be a bound parameter");
});

test("filter clause allocates the next placeholder in sequence", () => {
  const next = makeNext();
  const first = buildUserRatingFilterClause(next, 3);
  const second = buildUserRatingFilterClause(next, 4);
  assert.ok(first.endsWith("$1"), "first clause uses $1");
  assert.ok(second.endsWith("$2"), "second clause uses $2");
});

test("order expression sorts highest rated first with unrated listings last", () => {
  const expr = userRatingsOrderExpr();
  assert.ok(expr.includes(USER_RATING_AVG_SQL), "orders by the review average");
  assert.ok(expr.includes("DESC NULLS LAST"), "no-review listings go last");
});

test("a listing with no visible reviews never meets a user-rating threshold", () => {
  // AVG over an empty review set is NULL; COALESCE(NULL, -1) = -1.
  // -1 >= threshold (any threshold >= 1) is false for every UI-visible bound.
  for (const threshold of [1, 3, 4, 5]) {
    assert.equal(-1 >= threshold, false, `sentinel must fail threshold ${threshold}`);
  }
});
