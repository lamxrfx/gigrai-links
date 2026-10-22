// Checks every news source in news-sources.js and reports each one as a GitHub annotation.
import { SOURCES } from "../../gigrai-links/gigrai-links/news-sources.js";
let bad = 0;
const lines = [];
for (const s of SOURCES) {
  try {
    const r = await fetch(s.url, { headers: { "user-agent": "GigrAI news reader (+https://remotegigrai.com/news)" }, signal: AbortSignal.timeout(15000) });
    const xml = await r.text();
    let items, dates;
    if (s.type === "hn") { const hits = JSON.parse(xml).hits || []; items = hits.length; dates = hits.map((h) => Date.parse(h.created_at)); }
    else {
      items = (xml.match(/<item[\s>]/gi) || xml.match(/<entry[\s>]/gi) || []).length;
      dates = [...xml.matchAll(/<(pubDate|published|updated)>([^<]+)</g)].map((m) => Date.parse(m[2])).filter(Number.isFinite);
    }
    const newest = dates.length ? new Date(Math.max(...dates)).toISOString().slice(0, 10) : "?";
    const ok = r.ok && items > 0;
    if (!ok) bad++;
    lines.push(`${ok ? "OK" : "FAIL"} ${s.id}: HTTP ${r.status}, ${items} items, newest ${newest}`);
  } catch (e) {
    bad++;
    lines.push(`FAIL ${s.id}: ${String(e.message || e).slice(0, 120)}`);
  }
}
console.log(`::${bad ? "warning" : "notice"} title=Feeds ${SOURCES.length - bad} of ${SOURCES.length} OK::${lines.join("%0A")}`);
