// Checks every news source in news-sources.js and reports each one as a GitHub annotation.
import { SOURCES } from "../../gigrai-links/gigrai-links/news-sources.js";
let bad = 0;
for (const s of SOURCES) {
  try {
    const r = await fetch(s.url, { headers: { "user-agent": "GigrAI news reader (+https://remotegigrai.com/news)" }, signal: AbortSignal.timeout(15000) });
    const xml = await r.text();
    const items = (xml.match(/<item[\s>]/gi) || xml.match(/<entry[\s>]/gi) || []).length;
    const dates = [...xml.matchAll(/<(pubDate|published|updated)>([^<]+)</g)].map((m) => Date.parse(m[2])).filter(Number.isFinite);
    const newest = dates.length ? new Date(Math.max(...dates)).toISOString().slice(0, 10) : "?";
    const ok = r.ok && items > 0;
    if (!ok) bad++;
    console.log(`::${ok ? "notice" : "warning"} title=Feed ${s.id}::HTTP ${r.status}, ${items} items, newest ${newest}`);
  } catch (e) {
    bad++;
    console.log(`::warning title=Feed ${s.id}::failed: ${String(e.message || e).slice(0, 120)}`);
  }
}
console.log(`${SOURCES.length - bad}/${SOURCES.length} feeds OK`);
