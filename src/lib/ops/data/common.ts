/**
 * UniKart Ops — shared list/query helpers for table pages.
 *
 * Pages get `searchParams` (Next 16: a resolved record). These helpers read
 * pagination/sort/search into a typed shape and build the hrefs that
 * OpsDataTable's sort headers and pager links need — so filtering, sorting, and
 * paging are all server-driven via the URL (never loading all rows client-side).
 */

export type SortDir = "asc" | "desc";

export interface ListParams {
  page: number;
  pageSize: number;
  q: string;
  sort: { key: string; dir: SortDir } | null;
  /** All incoming params flattened to strings (for href building). */
  params: Record<string, string>;
}

export type RawSearchParams = Record<string, string | string[] | undefined>;

function flatten(sp: RawSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (v == null) continue;
    out[k] = Array.isArray(v) ? (v[0] ?? "") : v;
  }
  return out;
}

export function readListParams(
  sp: RawSearchParams,
  opts: {
    defaultSort?: { key: string; dir: SortDir };
    sortableKeys?: string[];
    pageSize?: number;
    maxPageSize?: number;
  } = {},
): ListParams {
  const params = flatten(sp);
  const pageSize = Math.min(opts.maxPageSize ?? 100, Math.max(1, opts.pageSize ?? 25));
  const page = Math.max(1, Number(params.page) || 1);
  const q = (params.q ?? "").trim();

  let sort = opts.defaultSort ?? null;
  if (params.sort) {
    const [key, dirRaw] = params.sort.split(":");
    const allowed = opts.sortableKeys ?? (opts.defaultSort ? [opts.defaultSort.key] : []);
    if (allowed.includes(key)) {
      sort = { key, dir: dirRaw === "asc" ? "asc" : "desc" };
    }
  }

  return { page, pageSize, q, sort, params };
}

/** Build `basePath?…` applying overrides (null removes a key). */
export function hrefWith(
  basePath: string,
  params: Record<string, string>,
  overrides: Record<string, string | null>,
): string {
  const next = new URLSearchParams(params);
  for (const [k, v] of Object.entries(overrides)) {
    if (v == null || v === "") next.delete(k);
    else next.set(k, v);
  }
  const qs = next.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** Toggle sort on a column (asc⇄desc), reset to page 1. */
export function makeSortHref(
  basePath: string,
  params: Record<string, string>,
  current: { key: string; dir: SortDir } | null,
  key: string,
): string {
  const dir: SortDir = current?.key === key && current.dir === "desc" ? "asc" : "desc";
  return hrefWith(basePath, params, { sort: `${key}:${dir}`, page: null });
}

/** Href for a given 1-based page (preserves all filters). */
export function makePageHref(
  basePath: string,
  params: Record<string, string>,
  page: number,
): string {
  return hrefWith(basePath, params, { page: page > 1 ? String(page) : null });
}
