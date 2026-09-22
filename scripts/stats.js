#!/usr/bin/env node
/**
 * A private dashboard: who is using this, and is any of it growing.
 *
 * Local on purpose. It renders to a file this repo ignores and opens it — it is
 * never deployed, never linked, and needs no auth of its own, because the only
 * way to read it is to already be on the machine that made it. A "just for me"
 * page served from the public site is a page one lucky URL guess away from not
 * being just for you.
 *
 *   node scripts/stats.js           # build and open
 *   node scripts/stats.js --json    # the same numbers, for a script to read
 *   node scripts/stats.js --no-open # build only
 *
 * Sources, and what each needs:
 *
 *   npm downloads     nothing. Public API.
 *   GitHub stars      nothing. Public API.
 *   GitHub traffic    push access — views, clones and referrers are not public.
 *                     Taken from `gh auth token`, or $GITHUB_TOKEN.
 *   Site visitors     $CLOUDFLARE_API_TOKEN and $CLOUDFLARE_ACCOUNT_ID, plus
 *                     the Web Analytics beacon enabled in docs/index.html.
 *                     Skipped with a note when absent rather than failing.
 *
 * Every source degrades to a labelled gap. A dashboard that dies because one
 * API is having a bad morning is a dashboard you stop opening.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PKG = "avatarkit";
const REPO = "suryansh2846code/Avatarkit";
const SITE = "https://avatarkit.suryanshdev.xyz";

const argv = process.argv.slice(2);
const AS_JSON = argv.includes("--json");
const NO_OPEN = argv.includes("--no-open");

// ── plumbing ───────────────────────────────────────────────────────────────

const iso = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 864e5);
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

/** Every fetch goes through here so one dead endpoint cannot take the page down. */
async function get(url, headers) {
  try {
    const res = await fetch(url, { headers: Object.assign({ "user-agent": `${PKG}-stats` }, headers) });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    return await res.json();
  } catch (err) {
    return { error: err.message };
  }
}

function githubToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    return execFileSync("gh", ["auth", "token"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

// ── the sources ────────────────────────────────────────────────────────────

/**
 * npm's download API 404s for a package published today — the counters do not
 * exist until the first full UTC day closes. That is a normal state with a
 * normal answer, not an error, so it is reported as one.
 */
async function npmStats() {
  const [point, range, reg] = await Promise.all([
    get(`https://api.npmjs.org/downloads/point/last-week/${PKG}`),
    get(`https://api.npmjs.org/downloads/range/${iso(daysAgo(30))}:${iso(daysAgo(0))}/${PKG}`),
    get(`https://registry.npmjs.org/${PKG}`),
  ]);

  const published = reg && !reg.error && reg.time ? reg.time[reg["dist-tags"].latest] : null;
  const days = range && range.downloads ? range.downloads.map((d) => ({ date: d.day, value: d.downloads })) : [];
  const pending = Boolean(point && point.error) && Boolean(reg && !reg.error);

  return {
    ok: !(point && point.error),
    pending,
    version: reg && !reg.error ? reg["dist-tags"].latest : null,
    published,
    week: point && !point.error ? point.downloads : 0,
    total: sum(days.map((d) => d.value)),
    days,
  };
}

async function githubStats(token) {
  const h = token ? { authorization: `Bearer ${token}`, accept: "application/vnd.github+json" } : {};
  const [repo, views, clones, referrers, paths] = await Promise.all([
    get(`https://api.github.com/repos/${REPO}`, h),
    get(`https://api.github.com/repos/${REPO}/traffic/views`, h),
    get(`https://api.github.com/repos/${REPO}/traffic/clones`, h),
    get(`https://api.github.com/repos/${REPO}/traffic/popular/referrers`, h),
    get(`https://api.github.com/repos/${REPO}/traffic/popular/paths`, h),
  ]);

  const series = (d) => (d && Array.isArray(d.views || d.clones)
    ? (d.views || d.clones).map((x) => ({ date: x.timestamp.slice(0, 10), value: x.count, uniques: x.uniques }))
    : []);

  return {
    ok: !(repo && repo.error),
    authed: Boolean(token) && !(views && views.error),
    stars: repo && !repo.error ? repo.stargazers_count : null,
    forks: repo && !repo.error ? repo.forks_count : null,
    watchers: repo && !repo.error ? repo.subscribers_count : null,
    issues: repo && !repo.error ? repo.open_issues_count : null,
    created: repo && !repo.error ? repo.created_at : null,
    views: { total: views && views.count ? views.count : 0, uniques: views && views.uniques ? views.uniques : 0, days: series(views) },
    clones: { total: clones && clones.count ? clones.count : 0, uniques: clones && clones.uniques ? clones.uniques : 0, days: series(clones) },
    referrers: Array.isArray(referrers) ? referrers : [],
    paths: Array.isArray(paths) ? paths : [],
  };
}

/**
 * Cloudflare Web Analytics, over the GraphQL analytics API.
 *
 * Needs a token with "Account Analytics: Read". Absent, this returns a state
 * the page renders as setup instructions — the one gap worth telling you how
 * to close, since it is the only source that answers "who visited".
 */
async function cloudflareStats() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !account) return { configured: false };

  const query = `query Viewer($account: String!, $since: Time!, $until: Time!) {
    viewer { accounts(filter: { accountTag: $account }) {
      total: rumPageloadEventsAdaptiveGroups(limit: 1, filter: { datetime_geq: $since, datetime_leq: $until }) {
        count sum { visits }
      }
      byDay: rumPageloadEventsAdaptiveGroups(limit: 100, orderBy: [date_ASC],
        filter: { datetime_geq: $since, datetime_leq: $until }) {
        count sum { visits } dimensions { date }
      }
      byCountry: rumPageloadEventsAdaptiveGroups(limit: 10, orderBy: [count_DESC],
        filter: { datetime_geq: $since, datetime_leq: $until }) {
        count dimensions { countryName }
      }
      byReferer: rumPageloadEventsAdaptiveGroups(limit: 10, orderBy: [count_DESC],
        filter: { datetime_geq: $since, datetime_leq: $until }) {
        count dimensions { refererHost }
      }
    } }
  }`;

  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        query,
        variables: { account, since: daysAgo(30).toISOString(), until: new Date().toISOString() },
      }),
    });
    const body = await res.json();
    if (body.errors) return { configured: true, error: body.errors[0].message };
    const a = body.data.viewer.accounts[0];
    if (!a) return { configured: true, error: "no account matched that id" };
    return {
      configured: true,
      pageviews: a.total[0] ? a.total[0].count : 0,
      visits: a.total[0] && a.total[0].sum ? a.total[0].sum.visits : 0,
      days: a.byDay.map((d) => ({ date: d.dimensions.date, value: d.count, uniques: d.sum ? d.sum.visits : 0 })),
      countries: a.byCountry.map((d) => ({ label: d.dimensions.countryName || "unknown", value: d.count })),
      referrers: a.byReferer.map((d) => ({ label: d.dimensions.refererHost || "direct", value: d.count })),
    };
  } catch (err) {
    return { configured: true, error: err.message };
  }
}

/** Is the thing all of this is measuring actually up right now? */
async function health() {
  const check = async (label, url) => {
    const t = Date.now();
    try {
      const res = await fetch(url, { redirect: "follow" });
      return { label, url, ok: res.ok, status: res.status, ms: Date.now() - t };
    } catch (err) {
      return { label, url, ok: false, status: err.message, ms: Date.now() - t };
    }
  };
  return Promise.all([
    check("Landing page", SITE + "/"),
    check("npm registry", `https://registry.npmjs.org/${PKG}`),
    check("unpkg", `https://unpkg.com/${PKG}`),
    check("jsDelivr", `https://cdn.jsdelivr.net/npm/${PKG}/dist/avatarkit.global.js`),
  ]);
}

export { npmStats, githubStats, cloudflareStats, health, githubToken };

// ── rendering ──────────────────────────────────────────────────────────────

const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const nf = (n) => (n == null ? "—" : Number(n).toLocaleString("en-US"));

/**
 * A time series as bars.
 *
 * Bars rather than a line because these are daily counts — discrete things that
 * happened on a day, not a continuous quantity sampled at one. Two series are
 * drawn as a pair per day rather than stacked, because "uniques" is a subset of
 * "views" and stacking a subset on its own superset draws a number that does
 * not exist.
 *
 * Every bar carries its numbers on a data attribute for the hover layer, and
 * every chart is followed by a <details> table — the numbers have to be
 * readable without reading pixels.
 */
function barChart(opts) {
  const { data, series, title, note } = opts;
  const W = 720, H = 200, padL = 44, padR = 8, padT = 12, padB = 28;
  const plotW = W - padL - padR, plotH = H - padT - padB;

  if (!data.length) return emptyChart(title, note || "No data for this window yet.");

  // Every value zero is a real answer, and an empty plot with a 0–1 axis is a
  // confusing way to give it — it reads as a chart that failed to load.
  const peak = Math.max(...data.flatMap((d) => series.map((s) => d[s.key] || 0)));
  if (peak === 0) return emptyChart(title, note || `Nothing recorded in the last ${data.length} days.`);

  const max = Math.max(1, peak);
  // A tick count that lands on whole numbers: counts are integers, and an axis
  // reading "2.5 downloads" is a chart apologising for its own arithmetic.
  const ticks = Math.min(4, max);
  const step = Math.max(1, Math.ceil(max / ticks));
  const top = Math.ceil(max / step) * step;
  const y = (v) => padT + plotH - (v / top) * plotH;

  const slot = plotW / data.length;
  const gap = 2;                                   // the 2px surface gap between fills
  const bw = Math.max(1, (slot - gap * 2) / series.length - (series.length > 1 ? gap : 0));

  const gridlines = [];
  for (let v = 0; v <= top; v += step) {
    gridlines.push(`<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>`
      + `<text class="ax" x="${padL - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${v}</text>`);
  }

  const bars = data.map((d, i) => series.map((s, j) => {
    const v = d[s.key] || 0;
    const x = padL + i * slot + gap + j * (bw + gap);
    const h = v === 0 ? 0 : Math.max(2, padT + plotH - y(v));
    const label = series.map((ss) => `${ss.name} ${nf(d[ss.key] || 0)}`).join(" · ");
    // rx 4 on a bar anchored to the baseline: rounded data-end, square foot.
    return `<rect class="bar" x="${x.toFixed(1)}" y="${(padT + plotH - h).toFixed(1)}"
      width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(4, bw / 2).toFixed(1)}"
      fill="var(--series-${s.slot})" data-tip="${esc(d.date)} — ${esc(label)}"/>`;
  }).join("")).join("");

  // Label the ends and the middle only. A label under every one of thirty bars
  // is a solid grey smear.
  const marks = [0, Math.floor(data.length / 2), data.length - 1].filter((v, i, a) => a.indexOf(v) === i);
  const xlabels = marks.map((i) => {
    const x = padL + i * slot + slot / 2;
    const anchor = i === 0 ? "start" : i === data.length - 1 ? "end" : "middle";
    return `<text class="ax" x="${x.toFixed(1)}" y="${H - 8}" text-anchor="${anchor}">${esc(data[i].date.slice(5))}</text>`;
  }).join("");

  const legend = series.length > 1
    ? `<div class="legend">${series.map((s) =>
        `<span><i style="background:var(--series-${s.slot})"></i>${esc(s.name)}</span>`).join("")}</div>`
    : "";

  const table = `<details class="tbl"><summary>Table</summary><table>
    <thead><tr><th>Date</th>${series.map((s) => `<th>${esc(s.name)}</th>`).join("")}</tr></thead>
    <tbody>${data.map((d) => `<tr><td>${esc(d.date)}</td>${series.map((s) =>
      `<td>${nf(d[s.key] || 0)}</td>`).join("")}</tr>`).join("")}</tbody></table></details>`;

  return `<figure class="card">
    <figcaption><h3>${esc(title)}</h3>${legend}</figcaption>
    ${note ? `<p class="note">${esc(note)}</p>` : ""}
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${gridlines.join("")}${bars}${xlabels}</svg>
    ${table}
  </figure>`;
}

/** Identity plus magnitude, ranked: horizontal bars, labelled directly. */
function rankChart(opts) {
  const { rows, title, note, unit } = opts;
  if (!rows.length) return emptyChart(title, note || "Nothing recorded yet.");
  const max = Math.max(...rows.map((r) => r.value));
  return `<figure class="card">
    <figcaption><h3>${esc(title)}</h3></figcaption>
    <ul class="rank">${rows.slice(0, 8).map((r) => `
      <li>
        <span class="rank-label" title="${esc(r.label)}">${esc(r.label)}</span>
        <span class="rank-bar"><i style="width:${Math.max(2, (r.value / max) * 100).toFixed(1)}%"></i></span>
        <span class="rank-val">${nf(r.value)}${unit ? ` <small>${esc(unit)}</small>` : ""}</span>
      </li>`).join("")}</ul>
  </figure>`;
}

function emptyChart(title, message) {
  return `<figure class="card">
    <figcaption><h3>${esc(title)}</h3></figcaption>
    <p class="empty">${esc(message)}</p>
  </figure>`;
}

/**
 * A headline number. No plot, so no hover layer — just the number and its name.
 * `value` may be a string (a version, a date) — only numbers get thousands
 * separators, and only numbers are right to format at all.
 */
function tile(label, value, sub) {
  const shown = value == null ? "—" : typeof value === "number" ? nf(value) : esc(value);
  return `<div class="tile">
    <span class="tile-v">${shown}</span>
    <span class="tile-k">${esc(label)}</span>
    ${sub ? `<span class="tile-s">${esc(sub)}</span>` : ""}
  </div>`;
}

// ── the page ───────────────────────────────────────────────────────────────

function page(d) {
  const { npm, gh, cf, up, at } = d;

  const npmNote = npm.pending
    ? "npm has not opened a counter for this package yet — it starts the day after the first publish. The package itself is published and installable."
    : null;

  const ghNote = gh.authed ? null
    : "Views and clones need push access. Sign in with `gh auth login`, or set GITHUB_TOKEN.";

  const cfSection = !cf.configured
    ? `<div class="card setup">
        <h3>Site visitors — not connected</h3>
        <p>This is the one that answers <em>who visited</em>. Two steps, both free:</p>
        <ol>
          <li>Cloudflare dashboard → <b>Web Analytics</b> → add <code>${esc(SITE.replace("https://", ""))}</code>,
              copy the beacon token, and paste it into the <code>TOKEN</code> line near the bottom of
              <code>docs/index.html</code>. That starts the collecting.</li>
          <li>Create an API token with <b>Account Analytics: Read</b>, then run with it:
              <code>CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… npm run stats</code>.
              That lets this page read it back.</li>
        </ol>
       </div>`
    : cf.error
      ? emptyChart("Site visitors", `Cloudflare said: ${cf.error}`)
      : [
          barChart({
            title: "Page views and visits, 30 days",
            data: cf.days,
            series: [{ key: "value", name: "Page views", slot: 1 }, { key: "uniques", name: "Visits", slot: 2 }],
          }),
          rankChart({ title: "Where visitors came from", rows: cf.referrers }),
          rankChart({ title: "Countries", rows: cf.countries }),
        ].join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Avatarkit — usage</title>
<style>
  :root {
    color-scheme: dark;
    --bg: #0b0b0d; --card: #141417; --line: #2a2a30;
    --text: #ecedf0; --dim: #8d8f97; --faint: #5e6068;
    --series-1: #3987e5;   /* categorical slot 1 — blue */
    --series-2: #d95926;   /* categorical slot 2 — orange */
    --good: #3fb27f; --bad: #e66767;
    --mono: ui-monospace, SFMono-Regular, Menlo, monospace;
    --sans: ui-sans-serif, -apple-system, "Segoe UI", system-ui, sans-serif;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.55 var(--sans);
         -webkit-font-smoothing: antialiased; }
  .wrap { width: min(1080px, calc(100% - 40px)); margin: 0 auto; padding: 36px 0 64px; }

  header { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; margin-bottom: 8px; }
  h1 { font-size: 24px; letter-spacing: -0.02em; margin: 0; font-weight: 660; }
  .stamp { color: var(--faint); font-size: 13px; font-family: var(--mono); }
  .sub { color: var(--dim); margin: 0 0 28px; font-size: 14px; }

  h2 { font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--dim);
       margin: 38px 0 14px; font-weight: 600; }

  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
  .tile { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 16px 18px; }
  .tile-v { display: block; font: 660 28px/1.1 var(--sans); letter-spacing: -0.025em; }
  .tile-k { display: block; color: var(--dim); font-size: 13px; margin-top: 4px; }
  .tile-s { display: block; color: var(--faint); font-size: 12px; margin-top: 2px; font-family: var(--mono); }

  .grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(330px, 1fr)); gap: 14px; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 12px;
          padding: 18px; margin: 0 0 14px; }
  figcaption { display: flex; align-items: baseline; justify-content: space-between; gap: 12px;
               flex-wrap: wrap; margin-bottom: 10px; }
  .card h3 { margin: 0; font-size: 14px; font-weight: 620; }
  .note { color: var(--dim); font-size: 13px; margin: 0 0 12px; }
  .empty { color: var(--faint); font-size: 14px; margin: 6px 0 0; }
  svg { width: 100%; height: auto; display: block; overflow: visible; }
  .grid { stroke: var(--line); stroke-width: 1; }
  .ax { fill: var(--faint); font: 11px var(--mono); }
  .bar { transition: opacity .12s; }
  .bar:hover { opacity: .75; }

  .legend { display: flex; gap: 14px; font-size: 12px; color: var(--dim); }
  .legend span { display: inline-flex; align-items: center; gap: 6px; }
  .legend i { width: 9px; height: 9px; border-radius: 3px; display: block; }

  .rank { list-style: none; margin: 0; padding: 0; display: grid; gap: 9px; }
  .rank li { display: grid; grid-template-columns: minmax(0, 1fr) 100px auto; gap: 12px; align-items: center; }
  .rank-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px;
                font-family: var(--mono); color: var(--text); }
  .rank-bar { background: #1f1f24; border-radius: 3px; height: 7px; overflow: hidden; }
  .rank-bar i { display: block; height: 100%; background: var(--series-1); border-radius: 3px; }
  .rank-val { font: 600 13px var(--mono); color: var(--text); min-width: 42px; text-align: right; }
  .rank-val small { color: var(--faint); font-weight: 400; }

  .health { display: grid; gap: 8px; }
  .health li { list-style: none; display: flex; align-items: center; gap: 10px; font-size: 13px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
  .dot.ok { background: var(--good); } .dot.no { background: var(--bad); }
  .health .u { color: var(--faint); font-family: var(--mono); font-size: 12px; margin-left: auto; }

  .tbl { margin-top: 12px; }
  .tbl summary { color: var(--faint); font-size: 12px; cursor: pointer; }
  .tbl table { width: 100%; border-collapse: collapse; margin-top: 8px; font: 12px var(--mono); }
  .tbl th, .tbl td { text-align: right; padding: 3px 6px; border-bottom: 1px solid var(--line); }
  .tbl th:first-child, .tbl td:first-child { text-align: left; }
  .tbl th { color: var(--dim); font-weight: 500; }

  .setup { border-color: #3a2a18; background: #17130e; }
  .setup h3 { margin: 0 0 8px; font-size: 14px; }
  .setup p, .setup li { color: var(--dim); font-size: 13.5px; }
  .setup ol { margin: 8px 0 0; padding-left: 20px; }
  .setup li { margin-bottom: 8px; }
  code { font-family: var(--mono); font-size: 12.5px; background: #1e1e23; padding: 1px 5px; border-radius: 4px; }

  #tip { position: fixed; pointer-events: none; background: #23232a; border: 1px solid var(--line);
         border-radius: 7px; padding: 6px 9px; font: 12px var(--mono); opacity: 0; transition: opacity .1s;
         z-index: 10; white-space: nowrap; }
  footer { color: var(--faint); font-size: 12px; margin-top: 40px; border-top: 1px solid var(--line); padding-top: 16px; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>Avatarkit usage</h1>
    <span class="stamp">${esc(at)}</span>
  </header>
  <p class="sub">Private. Built on your machine, never deployed. Re-run <code>npm run stats</code> to refresh.</p>

  <h2>Installs</h2>
  <div class="tiles">
    ${tile("Downloads, 7 days", npm.ok ? npm.week : null)}
    ${tile("Downloads, 30 days", npm.ok ? npm.total : null)}
    ${tile("Latest version", npm.version)}
    ${tile("Published", npm.published ? npm.published.slice(0, 10) : null)}
  </div>
  ${barChart({
    title: "npm downloads per day, 30 days",
    data: npm.days,
    series: [{ key: "value", name: "Downloads", slot: 1 }],
    note: npmNote,
  })}

  <h2>Repository</h2>
  <div class="tiles">
    ${tile("Stars", gh.stars)}
    ${tile("Forks", gh.forks)}
    ${tile("Watchers", gh.watchers)}
    ${tile("Open issues", gh.issues)}
    ${tile("Unique visitors, 14d", gh.authed ? gh.views.uniques : null)}
    ${tile("Clones, 14d", gh.authed ? gh.clones.total : null, gh.authed ? `${gh.clones.uniques} unique` : null)}
  </div>
  ${barChart({
    title: "Repository views, 14 days",
    data: gh.views.days,
    series: [{ key: "value", name: "Views", slot: 1 }, { key: "uniques", name: "Unique visitors", slot: 2 }],
    note: ghNote,
  })}
  ${barChart({
    title: "Clones, 14 days",
    data: gh.clones.days,
    series: [{ key: "value", name: "Clones", slot: 1 }, { key: "uniques", name: "Unique cloners", slot: 2 }],
  })}
  <div class="grid2">
    ${rankChart({ title: "Referrers to the repo", rows: gh.referrers.map((r) => ({ label: r.referrer, value: r.count })), unit: "views" })}
    ${rankChart({ title: "Most-viewed pages", rows: gh.paths.map((p) => ({ label: p.path.replace(`/${REPO}`, "") || "/", value: p.count })), unit: "views" })}
  </div>

  <h2>Website</h2>
  ${cfSection}

  <h2>Is everything up</h2>
  <div class="card"><ul class="health">
    ${up.map((c) => `<li><span class="dot ${c.ok ? "ok" : "no"}"></span>${esc(c.label)}
      <span class="u">${esc(String(c.status))} · ${c.ms}ms</span></li>`).join("")}
  </ul></div>

  <footer>
    npm and GitHub figures come from their public APIs; traffic needs your GitHub token.
    GitHub keeps only the last 14 days of traffic, so this page is also the only archive of it —
    run it now and then if you care about the earlier numbers.
  </footer>
</div>
<div id="tip"></div>
<script>
  // One tooltip element, positioned on hover. Bars are small targets, so the
  // listener is on the document rather than on each of a few hundred rects.
  var tip = document.getElementById("tip");
  document.addEventListener("mouseover", function (e) {
    var t = e.target.closest ? e.target.closest("[data-tip]") : null;
    if (!t) { tip.style.opacity = 0; return; }
    tip.textContent = t.getAttribute("data-tip");
    tip.style.opacity = 1;
  });
  document.addEventListener("mousemove", function (e) {
    if (tip.style.opacity == 0) return;
    var w = tip.offsetWidth;
    tip.style.left = Math.min(e.clientX + 14, innerWidth - w - 8) + "px";
    tip.style.top = (e.clientY - 34) + "px";
  });
</script>
</body>
</html>`;
}

// ── run ────────────────────────────────────────────────────────────────────

const token = githubToken();
const [npm, gh, cf, up] = await Promise.all([npmStats(), githubStats(token), cloudflareStats(), health()]);
const at = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
const data = { npm, gh, cf, up, at };

if (AS_JSON) {
  process.stdout.write(JSON.stringify(data, null, 2) + "\n");
} else {
  const out = join(root, ".local", "stats.html");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, page(data));
  process.stdout.write(
    `npm     ${npm.pending ? "no counter yet (published today)" : `${npm.week} downloads in 7d`}\n` +
    `github  ${nf(gh.stars)} stars · ${gh.authed ? `${gh.views.uniques} unique visitors, ${gh.clones.total} clones (14d)` : "traffic needs auth"}\n` +
    `site    ${cf.configured ? (cf.error ? `error: ${cf.error}` : `${nf(cf.visits)} visits (30d)`) : "analytics not connected"}\n` +
    `\n-> ${out}\n`
  );
  if (!NO_OPEN) {
    try { execFileSync("open", [out]); } catch { /* not macOS; the path is printed above */ }
  }
}
