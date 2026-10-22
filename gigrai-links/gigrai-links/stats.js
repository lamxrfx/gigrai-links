// Anonymous visit and click counts for the media kit and sponsor reports.
// One Durable Object ("Stats") holds daily totals in its own small database.
// Nothing personal is stored: only the day, what happened, where the visit came from
// (e.g. "ig", "wa") and the country code Cloudflare already provides.
import { DurableObject } from "cloudflare:workers";

const clean = (v, n = 40) => String(v || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, n);
const today = () => new Date().toISOString().slice(0, 10);
export const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

export class Stats extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS hits (
      day TEXT NOT NULL, kind TEXT NOT NULL, k TEXT NOT NULL, src TEXT NOT NULL, cc TEXT NOT NULL, n INTEGER NOT NULL,
      PRIMARY KEY (day, kind, k, src, cc))`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)`);
    this.sql.exec(`INSERT OR IGNORE INTO meta (key, value) VALUES ('since', ?)`, today());
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
      bySrc: rows(`SELECT src, SUM(n) AS n FROM hits WHERE ${where} GROUP BY src ORDER BY n DESC LIMIT 8`),
      byCountry: rows(`SELECT cc, SUM(n) AS n FROM hits WHERE ${where} GROUP BY cc ORDER BY n DESC LIMIT 8`),
      byKey: rows(`SELECT k, SUM(n) AS n FROM hits WHERE ${where} GROUP BY k ORDER BY n DESC LIMIT 12`),
    };
  }
}

// ---- helpers used by worker.js ----
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|headless|lighthouse|pingdom|monitor|curl|wget|python|go-http|node-fetch|axios|mediapartners|google|bing|yandex|baidu|bytespider|petal|semrush|ahrefs|mj12|dotbot|gptbot|claude|anthropic|perplexity|amazonbot|applebot|scrapy|phantom|selenium|puppeteer|playwright/i;
// Visits from cloud servers rather than homes or phones (scrapers, uptime checkers, ad crawlers)
const DATACENTER = /amazon|aws|google|microsoft|azure|alibaba|aliyun|tencent|huawei|digitalocean|ovh|hetzner|linode|akamai|oracle|vultr|choopa|contabo|leaseweb|m247|datacamp|scaleway|cdn77|fastly|zenlayer|ucloud|baidu|kingsoft|hostinger|ionos|godaddy|colocrossing|hostroyale|frantech|psychz|quadranet|servers|hosting|cloud|data ?center|vps/i;

export function isHuman(request) {
  const ua = request.headers.get("user-agent") || "";
  if (!ua || BOT.test(ua) || !/mozilla/i.test(ua)) return false;
  const purpose = request.headers.get("purpose") || request.headers.get("sec-purpose") || "";
  if (/prefetch|prerender/i.test(purpose)) return false;
  // Real browsers say they're opening a page; most scripts don't send this
  if (!request.headers.get("sec-fetch-mode")) return false;
  const org = String(request.cf?.asOrganization || "");
  if (org && DATACENTER.test(org)) return false;
  return true;
}

// "v2": counting restarted 22 Oct 2026 with the stricter bot filter above
const stub = (env) => env.STATS.get(env.STATS.idFromName("global-v2"));

// Count something without slowing the response down. Never throws.
export function track(env, ctx, request, kind, k, src) {
  if (!env.STATS) return;
  const cc = request.cf?.country || "";
  try { ctx.waitUntil(stub(env).hit(kind, k, src, cc).catch(() => {})); } catch {}
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
