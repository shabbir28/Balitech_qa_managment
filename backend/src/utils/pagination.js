/**
 * Normalises ?page and ?limit before they reach SQL.
 *
 * Postgres rejects `LIMIT NaN` and a negative OFFSET with an error, so an
 * unparseable or out-of-range query string would otherwise surface as a 500.
 */
function parsePagination(reqQuery = {}, { defaultLimit = 20, maxLimit = 200 } = {}) {
  const parsedPage = parseInt(reqQuery.page, 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const parsedLimit = parseInt(reqQuery.limit, 10);
  const requested = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : defaultLimit;
  const limit = Math.min(maxLimit, requested);

  return { page, limit, offset: (page - 1) * limit };
}

module.exports = { parsePagination };
