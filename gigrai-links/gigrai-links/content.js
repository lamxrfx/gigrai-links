// News feed and blog storage.
// One Durable Object ("Content") keeps two small tables in its own database:
//   news  - headlines pulled from trusted sources every hour (title, short summary, link to the original)
//   posts - GigrAI's own articles, written in the private editor at /admin
import { DurableObject } from "cloudflare:workers";
import { SOURCES, RELEVANT } from "./news-sources.js";

const now = () => new Date().toISOString();

export class Content extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS news (
      id TEXT PRIMARY KEY, source TEXT NOT NULL, cat TEXT NOT NULL, title TEXT NOT NULL, link TEXT NOT NULL,
      summary TEXT, published TEXT NOT NULL, fetched TEXT NOT NULL, hidden INTEGER NOT NULL DEFAULT 0)`);
    this.sql.exec(`CREATE INDEX IF NOT EXISTS news_pub ON news (published)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS posts (
      slug TEXT PRIMARY KEY, title TEXT NOT NULL, cat TEXT NOT NULL, summary TEXT, body TEXT, image TEXT,
      sources TEXT, affiliate TEXT, author TEXT, status TEXT NOT NULL DEFAULT 'draft',
      created TEXT NOT NULL, updated TEXT NOT NULL, published_at TEXT)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS enquiries (ref TEXT PRIMARY KEY, created TEXT NOT NULL, data TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new')`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS images (id TEXT PRIMARY KEY, type TEXT NOT NULL, data BLOB NOT NULL, size INTEGER NOT NULL, created TEXT NOT NULL)`);
  }

  // ---- news ----
  addNews(items) {
    let added = 0;
    for (const it of items) {
      const r = this.sql.exec(
        `INSERT OR IGNORE INTO news (id, source, cat, title, link, summary, published, fetched) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        it.id, it.source, it.cat, it.title, it.link, it.summary || "", it.published, now());
      added += r.rowsWritten ? 1 : 0;
    }
    // keep about 45 days
    const cutoff = new Date(Date.now() - 45 * 864e5).toISOString();
    this.sql.exec(`DELETE FROM news WHERE published < ?`, cutoff);
    this.sql.exec(`INSERT OR REPLACE INTO meta (key, value) VALUES ('news_fetched', ?)`, now());
    return added;
  }
  lastFetched() {
    return [...this.sql.exec(`SELECT value FROM meta WHERE key = 'news_fetched'`)][0]?.value || "";
  }
  listNews({ cat = "", limit = 30, offset = 0, includeHidden = false } = {}) {
    const where = [includeHidden ? "1=1" : "hidden = 0", cat ? "cat = ?" : "1=1"].join(" AND ");
    const args = cat ? [cat] : [];
    const rows = [...this.sql.exec(`SELECT * FROM news WHERE ${where} ORDER BY published DESC LIMIT ? OFFSET ?`, ...args, limit, offset)];
    const total = [...this.sql.exec(`SELECT COUNT(*) AS n FROM news WHERE ${where}`, ...args)][0].n;
    return { rows, total };
  }
  getNews(id) {
    return [...this.sql.exec(`SELECT * FROM news WHERE id = ?`, id)][0] || null;
  }
  setHidden(id, hidden) {
    this.sql.exec(`UPDATE news SET hidden = ? WHERE id = ?`, hidden ? 1 : 0, id);
  }

  // ---- advertiser booking requests from /advertise ----
  addEnquiry(ref, data) {
    this.sql.exec(`INSERT INTO enquiries (ref, created, data) VALUES (?, ?, ?)`, ref, now(), JSON.stringify(data));
    // keep 2 years
    this.sql.exec(`DELETE FROM enquiries WHERE created < ?`, new Date(Date.now() - 730 * 864e5).toISOString());
  }
  listEnquiries(limit = 50) {
    return [...this.sql.exec(`SELECT ref, created, data, status FROM enquiries ORDER BY created DESC LIMIT ?`, limit)].map((r) => ({ ...r, data: JSON.parse(r.data) }));
  }
  setEnquiryStatus(ref, status) {
    this.sql.exec(`UPDATE enquiries SET status = ? WHERE ref = ?`, status, ref);
  }

  // ---- uploaded images (resized in the browser before upload, so each is small) ----
  saveImage(id, type, bytes) {
    this.sql.exec(`INSERT OR REPLACE INTO images (id, type, data, size, created) VALUES (?, ?, ?, ?, ?)`, id, type, bytes, bytes.byteLength, now());
  }
  getImage(id) {
    const r = [...this.sql.exec(`SELECT type, data FROM images WHERE id = ?`, id)][0];
    return r ? { type: r.type, data: r.data } : null;
  }

  // ---- posts ----
  listPosts({ status = "published", cat = "", limit = 50 } = {}) {
    const where = [status === "all" ? "1=1" : "status = ?", cat ? "cat = ?" : "1=1"].join(" AND ");
    const args = [...(status === "all" ? [] : [status]), ...(cat ? [cat] : [])];
    return [...this.sql.exec(`SELECT slug, title, cat, summary, image, author, status, created, updated, published_at FROM posts WHERE ${where}
      ORDER BY COALESCE(published_at, updated) DESC LIMIT ?`, ...args, limit)];
  }
  getPost(slug) {
    return [...this.sql.exec(`SELECT * FROM posts WHERE slug = ?`, slug)][0] || null;
  }
  savePost(p, originalSlug = "") {
    const t = now();
    const old = this.getPost(originalSlug || p.slug);
    if (originalSlug && originalSlug !== p.slug && this.getPost(p.slug)) return { ok: false, error: "Another post already uses that web address." };
    const publishedAt = p.status === "published" ? (old && old.published_at) || t : old ? old.published_at : null;
    if (old && originalSlug && originalSlug !== p.slug) this.sql.exec(`DELETE FROM posts WHERE slug = ?`, originalSlug);
    this.sql.exec(`INSERT OR REPLACE INTO posts (slug, title, cat, summary, body, image, sources, affiliate, author, status, created, updated, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      p.slug, p.title, p.cat, p.summary, p.body, p.image, p.sources, p.affiliate, p.author, p.status, (old && old.created) || t, t, publishedAt);
    return { ok: true };
  }
  deletePost(slug) {
    this.sql.exec(`DELETE FROM posts WHERE slug = ?`, slug);
  }
}

const stub = (env) => env.CONTENT.get(env.CONTENT.idFromName("main"));
export const content = (env) => (env.CONTENT ? stub(env) : null);

// ---------------- pulling the feeds ----------------
const decode = (s) => String(s || "")
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&(nbsp|amp|lt|gt|quot|apos|#39|rsquo|lsquo|rdquo|ldquo|mdash|ndash|hellip);/g, (m, e) =>
    ({ nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", mdash: "—", ndash: "–", hellip: "…" })[e] ?? m);
const strip = (html) => decode(decode(html).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").replace(/\s+([.,;:!?])/g, "$1").trim();
const tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1] : "";
};
const atomLink = (block) => {
  const alt = block.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) || block.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']alternate["']/i);
  const any = block.match(/<link[^>]*href=["']([^"']+)["']/i);
  return (alt || any || [])[1] || "";
};
const clip = (s, n) => (s.length > n ? s.slice(0, n).replace(/\s+\S*$/, "") + "…" : s);

async function hash(s) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  return [...d.slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function parseFeed(xml) {
  const items = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  for (const b of blocks) {
    const title = strip(tag(b, "title"));
    let link = decode(tag(b, "link")).trim();
    if (!/^https?:\/\//.test(link)) link = decode(atomLink(b));
    const date = strip(tag(b, "pubDate") || tag(b, "published") || tag(b, "updated") || tag(b, "dc:date"));
    const summary = strip(tag(b, "description") || tag(b, "summary") || tag(b, "content:encoded") || tag(b, "content"));
    if (title && /^https?:\/\//.test(link)) items.push({ title, link, date, summary });
  }
  return items;
}

async function fetchSource(src) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch(src.url, { signal: ctrl.signal, headers: { "user-agent": "GigrAI news reader (+https://remotegigrai.com/news)", accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, application/json" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const raw = await r.text();
    const out = [];
    const oldest = Date.now() - 14 * 864e5;
    const parsed = src.type === "hn"
      ? ((JSON.parse(raw).hits) || []).map((h) => ({ title: h.title || "", link: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`, date: h.created_at, summary: "" }))
      : parseFeed(raw);
    for (const it of parsed.slice(0, 40)) {
      const t = Date.parse(it.date);
      if (!Number.isFinite(t) || t < oldest || t > Date.now() + 864e5) continue;
      const text = `${it.title} ${it.summary}`;
      if (src.filter && !RELEVANT.test(text)) continue;
      if (src.require && !src.require.test(text)) continue;
      out.push({
        id: await hash(it.link), source: src.name, cat: src.cat, title: clip(it.title, 180), link: it.link,
        summary: clip(it.summary.replace(/(The post|This article|Continue reading|Read more)[\s\S]*$/i, "").trim(), 240),
        published: new Date(t).toISOString(),
      });
    }
    return { id: src.id, ok: true, n: out.length, items: out };
  } catch (e) {
    return { id: src.id, ok: false, error: String(e && e.message || e), items: [] };
  } finally {
    clearTimeout(timer);
  }
}

// Fetch every source and store new headlines. Called hourly by the cron trigger (wrangler.jsonc).
export async function refreshNews(env) {
  const db = content(env);
  if (!db) return { ok: false, error: "no CONTENT binding" };
  // NEWS_FEED_OVERRIDE is only for local testing (points every source at a test server)
  const list = env.NEWS_FEED_OVERRIDE ? SOURCES.map((x) => ({ ...x, url: `${env.NEWS_FEED_OVERRIDE}?src=${x.id}` })) : SOURCES;
  const results = await Promise.all(list.map(fetchSource));
  const items = results.flatMap((r) => r.items);
  const added = await db.addNews(items);
  const report = results.map((r) => ({ id: r.id, ok: r.ok, n: r.items.length, error: r.error }));
  console.log(JSON.stringify({ event: "news_refresh", added, sources: report }));
  return { ok: true, added, sources: report };
}
