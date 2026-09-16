/**
 * Business day boundaries for the QA workflow.
 *
 * The operational day is the US East Coast day (America/New_York), because the
 * dialers and QA shifts run on that clock.
 *
 * Timestamp columns such as `lead_assignments.assigned_at` are
 * `timestamp without time zone` filled by `NOW()`, so they hold the wall clock
 * of whatever timezone the database session uses (currently Asia/Karachi).
 * Every helper below therefore converts a New York instant back into a naive
 * value in the session timezone. That keeps comparisons correct no matter which
 * timezone the database runs in, and leaves the column bare on the left-hand
 * side so `idx_lead_assignments_active_assigned_at` can still be used.
 */

const BUSINESS_TIMEZONE = 'America/New_York';

/** Midnight of the current New York day, as a naive value in the session timezone. */
const NY_DAY_START = `
  ((date_trunc('day', NOW() AT TIME ZONE '${BUSINESS_TIMEZONE}')
    AT TIME ZONE '${BUSINESS_TIMEZONE}') AT TIME ZONE current_setting('TimeZone'))
`;

/**
 * Midnight of a New York calendar date (a `YYYY-MM-DD` bind parameter), as a
 * naive value in the session timezone.
 *
 * @param {string} placeholder e.g. `'$3'`
 * @param {number} [dayOffset] whole days to add, e.g. `1` for an exclusive end bound
 */
const nyDateStart = (placeholder, dayOffset = 0) => `
  (((${placeholder}::date + ${dayOffset})::timestamp
    AT TIME ZONE '${BUSINESS_TIMEZONE}') AT TIME ZONE current_setting('TimeZone'))
`;

/**
 * Re-reads a naive session-timezone timestamp column as New York wall clock,
 * e.g. `DATE(${nyLocal('f.created_at')})` for the NY calendar day of a row.
 * (Writing `col AT TIME ZONE 'UTC'` instead would silently mislabel the value.)
 *
 * @param {string} column SQL expression of a `timestamp without time zone`
 */
const nyLocal = (column) =>
  `((${column} AT TIME ZONE current_setting('TimeZone')) AT TIME ZONE '${BUSINESS_TIMEZONE}')`;

module.exports = { BUSINESS_TIMEZONE, NY_DAY_START, nyDateStart, nyLocal };
