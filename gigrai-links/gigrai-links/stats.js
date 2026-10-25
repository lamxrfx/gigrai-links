// Anonymous visit and click counts for the media kit and sponsor reports.
// One Durable Object ("Stats") holds daily totals in its own small database.
// Nothing personal is stored: only the day, what happened, where the visit came from
// (e.g. "ig", "wa") and the country code Cloudflare already provides.
import { DurableObject } from "cloudflare:workers";

const clean = (v, n = 40) => String(v || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, n);
const today = () => new Date().toISOString().slice(0, 10);
export const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

const BURST = 60; // actions per minute from one visitor before we flag it

export class Stats extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS hits (
      day TEXT NOT NULL, kind TEXT NOT NULL, k TEXT NOT NULL, src TEXT NOT NULL, cc TEXT NOT NULL, n INTEGER NOT NULL,
      PRIMARY KEY (day, kind, k, src, cc))`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)`);
    // One row per advertiser, per visitor, per day: makes "unique clicks" possible. The visitor is a
    // one-way code (not an IP address) that changes every day, so people can't be followed over time.
    this.sql.exec(`CREATE TABLE IF NOT EXISTS uniq (day TEXT NOT NULL, k TEXT NOT NULL, v TEXT NOT NULL, PRIMARY KEY (day, k, v))`);
    // Who's on the site right now: one row per visitor code, kept ~15 minutes, town-level location only
    this.sql.exec(`CREATE TABLE IF NOT EXISTS live (v TEXT PRIMARY KEY, ts INTEGER NOT NULL, cc TEXT, city TEXT, lat REAL, lon REAL, page TEXT)`);
    // Page views per town per day, for the map (no visitor details)
    this.sql.exec(`CREATE TABLE IF NOT EXISTS geo (day TEXT NOT NULL, cc TEXT NOT NULL, city TEXT NOT NULL, lat REAL, lon REAL, n INTEGER NOT NULL, PRIMARY KEY (day, cc, city))`);
    // Unusually busy visitors (lots of actions in one minute), shown on the numbers page for a human to judge
    this.sql.exec(`CREATE TABLE IF NOT EXISTS burst (minute TEXT NOT NULL, v TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (minute, v))`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS flags (day TEXT NOT NULL, v TEXT NOT NULL, cc TEXT, city TEXT, peak INTEGER NOT NULL, first TEXT, last TEXT, PRIMARY KEY (day, v))`);
    // Apply clicks per role (which roles people actually click), plus the role's title for the report
    this.sql.exec(`CREATE TABLE IF NOT EXISTS roleclicks (day TEXT NOT NULL, id TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (day, id))`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS roles (id TEXT PRIMARY KEY, title TEXT, via TEXT, path TEXT, pay TEXT, last TEXT)`);
    // Views per page (which guide, article or role people read), plus a readable title for the report
    this.sql.exec(`CREATE TABLE IF NOT EXISTS pageviews (day TEXT NOT NULL, path TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (day, path))`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS pagemeta (path TEXT PRIMARY KEY, title TEXT, section TEXT)`);
    this.sql.exec(`INSERT OR IGNORE INTO meta (key, value) VALUES ('since', ?)`, today());
  }

  pageHit(path, title, section) {
    path = String(path || "/").slice(0, 200);
    this.sql.exec(`INSERT INTO pageviews (day, path, n) VALUES (?, ?, 1) ON CONFLICT (day, path) DO UPDATE SET n = n + 1`, today(), path);
    this.sql.exec(`INSERT INTO pagemeta (path, title, section) VALUES (?, ?, ?) ON CONFLICT (path) DO UPDATE SET title = excluded.title, section = excluded.section`,
      path, String(title || "").slice(0, 160), clean(section, 20));
    if (Math.random() < 0.001) this.sql.exec(`DELETE FROM pageviews WHERE day < ?`, daysAgo(400));
  }

  topPages(from, to = today(), limit = 25) {
    return [...this.sql.exec(`SELECT v.path, SUM(v.n) AS n, m.title, m.section FROM pageviews v LEFT JOIN pagemeta m ON m.path = v.path
      WHERE v.day >= ? AND v.day <= ? GROUP BY v.path ORDER BY n DESC LIMIT ?`, from, to, limit)];
  }

  getMeta(key) { return [...this.sql.exec(`SELECT value FROM meta WHERE key = ?`, String(key))][0]?.value ?? null; }
  setMeta(key, value) { this.sql.exec(`INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value`, String(key), String(value)); }

  roleClick(id, title, via, path, pay) {
    id = String(id).slice(0, 120);
    this.sql.exec(`INSERT INTO roleclicks (day, id, n) VALUES (?, ?, 1) ON CONFLICT (day, id) DO UPDATE SET n = n + 1`, today(), id);
    this.sql.exec(`INSERT INTO roles (id, title, via, path, pay, last) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (id) DO UPDATE SET title = excluded.title, via = excluded.via, path = excluded.path, pay = excluded.pay, last = excluded.last`,
      id, String(title || "").slice(0, 160), String(via || "").slice(0, 40), String(path || "").slice(0, 300), String(pay || "").slice(0, 40), today());
    if (Math.random() < 0.001) this.sql.exec(`DELETE FROM roleclicks WHERE day < ?`, daysAgo(400));
  }

  topRoles(from, to = today(), limit = 25) {
    return [...this.sql.exec(`SELECT c.id, SUM(c.n) AS n, r.title, r.via, r.path, r.pay, r.last FROM roleclicks c LEFT JOIN roles r ON r.id = c.id
      WHERE c.day >= ? AND c.day <= ? GROUP BY c.id ORDER BY n DESC LIMIT ?`, from, to, limit)];
  }

  // A visitor did something (page view, search, opened a role)
  seen(v, cc, city, lat, lon, page, isView) {
    const now = Date.now();
    cc = clean(cc, 2) || "xx"; city = String(city || "").replace(/[^\p{L}\p{N} .'-]/gu, "").slice(0, 40);
    lat = Number.isFinite(lat) ? lat : null; lon = Number.isFinite(lon) ? lon : null;
    this.sql.exec(`INSERT INTO live (v, ts, cc, city, lat, lon, page) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (v) DO UPDATE SET ts = excluded.ts, cc = excluded.cc, city = excluded.city, lat = excluded.lat, lon = excluded.lon, page = COALESCE(excluded.page, page)`,
      clean(v, 32), now, cc, city, lat, lon, page ? clean(page, 20) : null);
    if (isView && lat !== null && lon !== null) {
      this.sql.exec(`INSERT INTO geo (day, cc, city, lat, lon, n) VALUES (?, ?, ?, ?, ?, 1)
        ON CONFLICT (day, cc, city) DO UPDATE SET n = n + 1`, today(), cc, city || "-", lat, lon);
    }
    // Burst check: more than BURST actions in one minute from one visitor gets flagged
    const minute = new Date(now).toISOString().slice(0, 16);
    const b = [...this.sql.exec(`INSERT INTO burst (minute, v, n) VALUES (?, ?, 1) ON CONFLICT (minute, v) DO UPDATE SET n = n + 1 RETURNING n`, minute, clean(v, 32))][0].n;
    if (b > BURST) {
      const t = new Date(now).toISOString().slice(11, 16);
      this.sql.exec(`INSERT INTO flags (day, v, cc, city, peak, first, last) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (day, v) DO UPDATE SET peak = MAX(peak, excluded.peak), last = excluded.last`, today(), clean(v, 32), cc, city, b, t, t);
    }
    if (Math.random() < 0.02) this.sql.exec(`DELETE FROM burst WHERE minute < ?`, new Date(now - 10 * 60e3).toISOString().slice(0, 16));
    if (Math.random() < 0.02) this.sql.exec(`DELETE FROM live WHERE ts < ?`, now - 15 * 60e3);
    if (Math.random() < 0.001) this.sql.exec(`DELETE FROM geo WHERE day < ?`, daysAgo(400));
  }

  // Visitors active in the last few minutes, grouped by town
  liveNow(mins = 5) {
    const since = Date.now() - mins * 60e3;
    const rows = (q) => [...this.sql.exec(q, since)];
    return {
      total: rows(`SELECT COUNT(*) AS n FROM live WHERE ts > ?`)[0].n,
      places: rows(`SELECT cc, city, AVG(lat) AS lat, AVG(lon) AS lon, COUNT(*) AS n FROM live WHERE ts > ? GROUP BY cc, city ORDER BY n DESC LIMIT 300`),
      countries: rows(`SELECT cc, COUNT(*) AS n FROM live WHERE ts > ? GROUP BY cc ORDER BY n DESC LIMIT 10`),
      pages: rows(`SELECT COALESCE(page, 'home') AS page, COUNT(*) AS n FROM live WHERE ts > ? GROUP BY 1 ORDER BY n DESC LIMIT 8`),
    };
  }

  // Totals per country (all of them) between two days, for the map
  countryTotals(kind, from, to = today()) {
    return [...this.sql.exec(`SELECT cc, SUM(n) AS n FROM hits WHERE kind = ? AND day >= ? AND day <= ? GROUP BY cc ORDER BY n DESC`, kind, from, to)];
  }

  // Flagged busy visitors between two days (newest first)
  flagged(from, to = today()) {
    return [...this.sql.exec(`SELECT day, cc, city, peak, first, last FROM flags WHERE day >= ? AND day <= ? ORDER BY day DESC, peak DESC LIMIT 50`, from, to)];
  }

  // Page views by town between two days, for the map
  geoReport(from, to = today()) {
    return [...this.sql.exec(`SELECT cc, city, AVG(lat) AS lat, AVG(lon) AS lon, SUM(n) AS n FROM geo WHERE day >= ? AND day <= ? GROUP BY cc, city ORDER BY n DESC LIMIT 600`, from, to)];
  }

  // Add one to today's count
  hit(kind, k, src, cc) {
    this.sql.exec(
      `INSERT INTO hits (day, kind, k, src, cc, n) VALUES (?, ?, ?, ?, ?, 1)
       ON CONFLICT (day, kind, k, src, cc) DO UPDATE SET n = n + 1`,
      today(), clean(kind, 12), clean(k) || "-", clean(src, 20) || "direct", clean(cc, 2) || "xx");
    // keep about 13 months
    if (Math.random() < 0.001) this.sql.exec(`DELETE FROM hits WHERE day < ?`, daysAgo(400));
  }

  // Count a click once per visitor per day. Returns true if it was new.
  uniqueHit(k, v, src, cc) {
    const r = this.sql.exec(`INSERT OR IGNORE INTO uniq (day, k, v) VALUES (?, ?, ?)`, today(), clean(k), clean(v, 32));
    if (Math.random() < 0.002) this.sql.exec(`DELETE FROM uniq WHERE day < ?`, daysAgo(400));
    if (!r.rowsWritten) return false;
    this.hit("sponsor_u", k, src, cc);
    return true;
  }

  // Totals for several advertisers at once: { id: count } since each one's start date
  countMany(kind, items) {
    const out = {};
    for (const { k, from } of items) {
      out[k] = [...this.sql.exec(`SELECT COALESCE(SUM(n), 0) AS n FROM hits WHERE kind = ? AND k = ? AND day >= ?`, kind, clean(k), from)][0].n;
    }
    return out;
  }

  since() {
    return [...this.sql.exec(`SELECT value FROM meta WHERE key = 'since'`)][0]?.value || today();
  }

  // Totals for one kind (and optionally one key) between two days, broken down several ways
  report({ kind, k = null, from, to = today() }) {
    const where = `kind = ? AND day >= ? AND day <= ?` + (k ? ` AND k = ?` : "");
    const args = k ? [kind, from, to, k] : [kind, from, to];
    const rows = (sql) => [...this.sql.exec(sql, ...args)];
    return {
      since: this.since(),
      total: rows(`SELECT COALESCE(SUM(n), 0) AS n FROM hits WHERE ${where}`)[0].n,
      byDay: rows(`SELECT day, SUM(n) AS n FROM hits WHERE ${where} GROUP BY day ORDER BY day`),
      bySrc: rows(`SELECT src, SUM(n) AS n FROM hits WHERE ${where} GROUP BY src ORDER BY n DESC LIMIT 30`),
      byCountry: rows(`SELECT cc, SUM(n) AS n FROM hits WHERE ${where} GROUP BY cc ORDER BY n DESC LIMIT 8`),
      byKey: rows(`SELECT k, SUM(n) AS n FROM hits WHERE ${where} GROUP BY k ORDER BY n DESC LIMIT 12`),
    };
  }
}

// ---- helpers used by worker.js ----
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|headless|lighthouse|pingdom|monitor|curl|wget|python|go-http|node-fetch|axios|mediapartners|google|bing|yandex|baidu|bytespider|petal|semrush|ahrefs|mj12|dotbot|gptbot|claude|anthropic|perplexity|amazonbot|applebot|scrapy|phantom|selenium|puppeteer|playwright/i;

// What kind of bot is this? (for the "bots filtered" counter)
export function botKind(request) {
  const ua = request.headers.get("user-agent") || "";
  const purpose = request.headers.get("purpose") || request.headers.get("sec-purpose") || "";
  if (!ua) return "no-ua";
  if (/prefetch|prerender/i.test(purpose)) return "prefetch";
  if (/mediapartners|adsbot/i.test(ua)) return "ads";
  if (/gptbot|chatgpt|oai-search|claude|anthropic|perplexity|bytespider|amazonbot|ccbot|cohere|meta-externalagent|diffbot/i.test(ua)) return "ai";
  if (/facebookexternalhit|facebookcatalog|whatsapp|telegram|discord|slack|twitterbot|linkedinbot|skype|pinterest|redditbot|embedly|preview|vkshare|snapchat|instagram/i.test(ua)) return "preview";
  if (/googlebot|google|bingbot|bing|yandex|baidu|duckduck|applebot|petal|seznam|sogou|naver/i.test(ua)) return "search";
  if (/semrush|ahrefs|mj12|dotbot|rogerbot|screaming frog|serpstat|dataforseo|blexbot/i.test(ua)) return "seo";
  if (/curl|wget|python|go-http|node|axios|scrapy|headless|puppeteer|playwright|selenium|phantom|lighthouse|monitor|pingdom|uptime|java\/|okhttp|libwww|httpclient/i.test(ua)) return "script";
  if (isServerNet(request)) return "server";
  if (fakeBrowser(request)) return fakeBrowser(request);
  return "other";
}

// Visits from server / hosting companies (not home or mobile internet). Bots there often pretend
// to be a normal Chrome browser, so the browser label alone doesn't catch them.
// Cloudflare, Akamai and Fastly are left out on purpose: iPhone "Private Relay" users come through them.
const SERVER_ASN = new Set([16509, 14618, 8987, 396982, 8075, 31898, 45102, 37963, 132203, 14061, 16276, 24940, 213230, 63949, 20473, 51167, 60781, 28753, 9009, 212238, 12876, 47583, 36352, 199524, 202425, 49981, 62240, 46606, 26496, 55286, 40021, 53667, 136907, 135377, 45090, 23470, 8100, 29802, 30633, 32613, 57523, 44477, 50673, 210644, 211252]);
const SERVER_ORG = /hosting|\bhost|data ?cent(er|re)|datacamp|\bvps\b|server|colo(cation|crossing)|cloud(?!flare)|amazon|aws|digitalocean|\bovh|hetzner|linode|akamai connected cloud|vultr|choopa|contabo|leaseweb|m247|scaleway|hostinger|oracle|alibaba|tencent|huawei cloud|g-?core|ipxo|worldstream|clouvider|psychz|quadranet|zenlayer|frantech|buyvm|hostwinds|serverion|aeza|stark industries|superhosting|icdsoft/i;
export function isServerNet(request) {
  const asn = +(request.cf?.asn || 0), org = String(request.cf?.asOrganization || "");
  return SERVER_ASN.has(asn) || SERVER_ORG.test(org);
}
// Stored as a short tag, e.g. "digitalocean-llc" (keys can only hold letters, numbers and dashes)
export const netName = (request) => String(request.cf?.asOrganization || (request.cf?.asn ? "AS" + request.cf.asn : "unknown")).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

// Bots that pretend to be Chrome/Safari usually give themselves away: real browsers always send a
// language (Accept-Language), and scraping tools often use a years-old browser version.
export function fakeBrowser(request) {
  const ua = request.headers.get("user-agent") || "";
  if (!request.headers.get("accept-language")) return "nolang";
  const chrome = ua.match(/(?:Chrome|CriOS)\/(\d+)/), firefox = ua.match(/Firefox\/(\d+)/);
  if ((chrome && +chrome[1] < 100) || (firefox && +firefox[1] < 100)) return "oldua";
  return "";
}

export function isHuman(request) {
  const ua = request.headers.get("user-agent") || "";
  if (!ua || BOT.test(ua) || !/mozilla/i.test(ua)) return false;
  if (isServerNet(request)) return false;
  if (fakeBrowser(request)) return false;
  const purpose = request.headers.get("purpose") || request.headers.get("sec-purpose") || "";
  if (/prefetch|prerender/i.test(purpose)) return false;
  return true;
}

const stub = (env) => env.STATS.get(env.STATS.idFromName("global"));

// Requests from the owner's own devices (private cookie): never counted anywhere
const OWNER = new WeakSet();
export const markOwner = (request) => OWNER.add(request);
export const isOwner = (request) => OWNER.has(request);

// Count something without slowing the response down. Never throws.
export function track(env, ctx, request, kind, k, src) {
  if (!env.STATS || OWNER.has(request)) return;
  const cc = request.cf?.country || "";
  try { ctx.waitUntil(stub(env).hit(kind, k, src, cc).catch(() => {})); } catch {}
}

// A daily, one-way visitor code for unique clicks (never stored with the IP address)
async function visitorCode(env, request) {
  const raw = [request.headers.get("cf-connecting-ip") || "", request.headers.get("user-agent") || "", today(), env.REPORT_SECRET || "gigrai"].join("|");
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)));
  return [...d.slice(0, 12)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function trackUnique(env, ctx, request, k, src) {
  if (!env.STATS || OWNER.has(request)) return;
  const cc = request.cf?.country || "";
  try { ctx.waitUntil(visitorCode(env, request).then((v) => stub(env).uniqueHit(k, v, src, cc)).catch(() => {})); } catch {}
}

// Mark a visitor as on the site now (town-level location from Cloudflare, rounded; no IP stored)
export function presence(env, ctx, request, page, isView) {
  if (!env.STATS || OWNER.has(request)) return;
  const cf = request.cf || {};
  const r = (x) => { const n = parseFloat(x); return Number.isFinite(n) ? Math.round(n * 10) / 10 : NaN; };
  try {
    ctx.waitUntil(visitorCode(env, request)
      .then((v) => stub(env).seen(v, cf.country || "", cf.city || "", r(cf.latitude), r(cf.longitude), page, !!isView))
      .catch(() => {}));
  } catch {}
}

export async function liveNow(env) {
  if (!env.STATS) return null;
  try { return await stub(env).liveNow(5); } catch (e) { console.error("live read failed", String(e)); return null; }
}

export async function countryTotals(env, kind, from, to) {
  if (!env.STATS) return [];
  try { return await stub(env).countryTotals(kind, from, to); } catch (e) { console.error("country read failed", String(e)); return []; }
}

export function pageHit(env, ctx, request, path, title, section) {
  if (!env.STATS || OWNER.has(request)) return;
  try { ctx.waitUntil(stub(env).pageHit(path, title, section).catch(() => {})); } catch {}
}

export async function topPages(env, from, to) {
  if (!env.STATS) return [];
  try { return await stub(env).topPages(from, to, 25); } catch (e) { console.error("pages read failed", String(e)); return []; }
}

export function roleClick(env, ctx, request, job, path, pay) {
  if (!env.STATS || OWNER.has(request)) return;
  try { ctx.waitUntil(stub(env).roleClick(job.id, job.title, job.via, path, pay).catch(() => {})); } catch {}
}

export async function topRoles(env, from, to) {
  if (!env.STATS) return [];
  try { return await stub(env).topRoles(from, to, 25); } catch (e) { console.error("roles read failed", String(e)); return []; }
}

export async function meta(env, key, value) {
  if (!env.STATS) return null;
  try { const s = stub(env); if (value === undefined) return await s.getMeta(key); await s.setMeta(key, value); return value; } catch { return null; }
}

export async function flagged(env, from, to) {
  if (!env.STATS) return [];
  try { return await stub(env).flagged(from, to); } catch (e) { console.error("flag read failed", String(e)); return []; }
}

export async function geoReport(env, from, to) {
  if (!env.STATS) return [];
  try { return await stub(env).geoReport(from, to); } catch (e) { console.error("geo read failed", String(e)); return []; }
}

export async function countMany(env, kind, items) {
  if (!env.STATS || !items.length) return {};
  try { return await stub(env).countMany(kind, items); } catch (e) { console.error("stats count failed", String(e)); return {}; }
}

export async function readStats(env, q) {
  if (!env.STATS) return null;
  try { return await stub(env).report(q); } catch (e) { console.error("stats read failed", String(e)); return null; }
}

// Private report links: a short code made from a secret, so links can't be guessed
export async function signKey(env, label) {
  const secret = String(env.REPORT_SECRET || "");
  if (secret.length < 16) return "";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(label)));
  return [...sig.slice(0, 10)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function keyOk(env, label, given) {
  const want = await signKey(env, label);
  if (!want || typeof given !== "string" || given.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}
