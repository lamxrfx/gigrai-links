// Media kit (/media-kit), sponsor reports (/report/<id>?k=...) and Lamar's private overview (/report?k=...)
import { shell, html, esc, crumbs, ARROW, CHECK, WA, AD_OPTIONS, adOption, DM, mailLink } from "./seo.js";

const fmt = (n) => Number(n || 0).toLocaleString("en-GB");
const round = (n) => (n >= 1000 ? (Math.floor(n / 100) / 10).toLocaleString("en-GB") + "k" : fmt(n));
const longDate = (d) => new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const shortDate = (d) => new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

let regionNames = null;
try { regionNames = new Intl.DisplayNames(["en"], { type: "region" }); } catch {}
const country = (cc) => {
  const c = String(cc || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(c) || c === "XX") return "Unknown";
  try { return (regionNames && regionNames.of(c)) || c; } catch { return c; }
};
const SRC = { ig: "Instagram", wa: "WhatsApp", featured: "Featured on site", site: "Website", direct: "Website", picks: "WhatsApp", x: "X", li: "LinkedIn", tt: "TikTok", fb: "Facebook", google: "Google", bing: "Bing", reddit: "Reddit", internal: "Browsing the site", other: "Other websites" };
const source = (s) => SRC[s] || (s ? s.charAt(0).toUpperCase() + s.slice(1) : "Other");

// Thresholds: a number only appears in the public media kit once it's worth showing
const SHOW_VIEWS = 300, SHOW_APPLIES = 30, SHOW_COUNTRIES = 100;

const STYLE = `<style>
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}
.kpi{padding:20px;border-radius:var(--r-md)}
.kpi b{display:block;font-size:34px;font-weight:800;letter-spacing:-.02em;line-height:1.1;font-variant-numeric:tabular-nums}
.kpi span{display:block;margin-top:4px;color:var(--muted);font-size:14px}
.kpi small{display:block;margin-top:6px;color:var(--muted);font-size:12.5px}
.bars{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.bars li{display:grid;grid-template-columns:minmax(110px,190px) 1fr 56px;gap:12px;align-items:center;font-size:14.5px}
.bars .t{height:12px;border-radius:999px;background:rgba(255,255,255,.06);overflow:hidden}
.bars .f{display:block;height:100%;border-radius:999px;background:#5b8cff}
.bars .v{text-align:right;font-variant-numeric:tabular-nums;font-weight:700}
.days{display:flex;align-items:flex-end;gap:2px;height:150px;padding:10px 0 0;border-bottom:1px solid var(--line)}
.days i{flex:1;min-width:3px;background:#5b8cff;border-radius:4px 4px 0 0;position:relative}
.days i:hover{background:#9fbcff}
.days i:hover::after{content:attr(data-tip);position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);white-space:nowrap;background:#10132a;border:1px solid var(--line);color:var(--text);font-size:12.5px;padding:5px 8px;border-radius:8px;font-style:normal;z-index:2}
.axis{display:flex;justify-content:space-between;color:var(--muted);font-size:12.5px;margin-top:6px}
.two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.rlinks{display:grid;gap:12px}
.rlink{padding:18px;border-radius:var(--r-md);display:grid;gap:8px}
.rlink code{display:block;padding:8px 10px;border-radius:10px;background:rgba(0,0,0,.35);font-size:13px;word-break:break-all;color:#cfe0ff}
.rlink .meta{color:var(--muted);font-size:13.5px}
.note{color:var(--muted);font-size:13.5px}
.printbtn{cursor:pointer;font:inherit}
@media (max-width:700px){.two{grid-template-columns:1fr}.bars li{grid-template-columns:minmax(90px,130px) 1fr 48px}}
@media print{
  header.top,footer.foot,.drawer,.menu-btn,.jump,.cta-panel .jump,.noprint{display:none!important}
  body{background:#070914!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .block{break-inside:avoid}
}
</style>`;

function barList(rows, label, total) {
  if (!rows.length) return `<p class="note">No data yet.</p>`;
  const max = Math.max(...rows.map((r) => r.n), 1);
  return `<ul class="bars">${rows.map((r) => {
    const pct = total ? Math.round((r.n / total) * 100) : 0;
    return `<li><span>${esc(label(r))}</span><span class="t" aria-hidden="true"><span class="f" style="width:${Math.max(2, Math.round((r.n / max) * 100))}%"></span></span><span class="v" title="${pct}% of total">${fmt(r.n)}</span></li>`;
  }).join("")}</ul>`;
}

function dayChart(byDay, from, to) {
  const map = Object.fromEntries(byDay.map((r) => [r.day, r.n]));
  const days = [];
  for (let d = new Date(from + "T12:00:00Z"); d.toISOString().slice(0, 10) <= to; d = new Date(d.getTime() + 864e5)) days.push(d.toISOString().slice(0, 10));
  const max = Math.max(1, ...days.map((d) => map[d] || 0));
  return `<div class="days" role="img" aria-label="Clicks per day">${days.map((d) => {
    const n = map[d] || 0;
    return `<i style="height:${n ? Math.max(3, Math.round((n / max) * 100)) : 0}%" data-tip="${shortDate(d)}: ${fmt(n)}" title="${shortDate(d)}: ${fmt(n)}"></i>`;
  }).join("")}</div><div class="axis"><span>${shortDate(days[0])}</span><span>${shortDate(days[days.length - 1])}</span></div>`;
}

const pageOf = (opts) => html(shell({ ...opts, body: STYLE + opts.body }), opts.status || 200, opts.maxAge ?? 0);

// ---------- /media-kit ----------
export function mediaKitPage({ origin, kit, liveRoles, platforms, views, applies }) {
  const ig = kit.instagram || {}, waf = (kit.whatsapp || {}).followers;
  const showViews = views && views.total >= SHOW_VIEWS;
  const showApplies = applies && applies.total >= SHOW_APPLIES;
  const showCountries = views && views.total >= SHOW_COUNTRIES && views.byCountry.length;
  const kpis = [
    ig.followers ? [round(ig.followers), `Instagram followers`, `@${esc(ig.handle || "gigr.ai")}`] : null,
    waf ? [round(waf), "WhatsApp channel followers", "GigrAI Jobs"] : null,
    liveRoles ? [fmt(liveRoles) + "+", "Live remote AI roles", `From ${platforms} platforms, refreshed every 30 minutes`] : null,
    showViews ? [round(views.total), "Website page views", "Last 30 days"] : null,
    showApplies ? [round(applies.total), "Clicks to apply", "Last 30 days"] : null,
  ].filter(Boolean);
  const updated = kit.updated ? longDate(kit.updated) : "";
  const body = `${crumbs([["/", "GigrAI"], ["/advertise", "Advertise"], ["", "Media kit"]])}
<section class="hero sm">
  <span class="eyebrow"><i></i>Media kit${updated ? ` · Updated ${updated}` : ""}</span>
  <h1>Reach people who want <span class="grad-text">AI training work</span></h1>
  <p>GigrAI is a free search engine and community for remote AI jobs. ${esc(kit.audience || "")}</p>
  <div class="jump"><a class="btn btn-grad" href="${DM}" target="_blank" rel="noopener" style="color:#fff">Message @gigr.ai ${ARROW}</a>${mailLink(kit.contactEmail, "Email us")}<button type="button" class="ghost printbtn" onclick="window.print()" style="height:52px;padding:0 22px;border-radius:999px;border:1px solid var(--line);background:var(--glass);color:var(--soft);font-weight:600">Save as PDF</button></div>
</section>

<section class="block" aria-labelledby="nums"><h2 id="nums">Our numbers</h2>
<div class="kpis">${kpis.map(([n, l, s]) => `<div class="kpi glass"><b>${n}</b><span>${l}</span><small>${s}</small></div>`).join("")}</div>
${showViews ? "" : `<p class="note" style="margin-top:12px">Message us for our latest website traffic.</p>`}
</section>

${showCountries ? `<section class="block" aria-labelledby="where"><h2 id="where">Where our visitors are</h2><p class="lead">Share of website page views, last 30 days.</p>
<div class="panel glass">${barList(views.byCountry.slice(0, 6), (r) => country(r.cc), views.total)}</div></section>` : ""}

<section class="block" aria-labelledby="ch"><h2 id="ch">Three ways to reach them</h2>
<div class="cards">
  <div class="panel glass"><h3>remotegigrai.com</h3><p>A live search of remote AI roles. People arrive ready to apply and come back for new roles.</p></div>
  <div class="panel glass"><h3>Instagram</h3><p><a href="https://www.instagram.com/gigr.ai/" rel="noopener">@gigr.ai</a>: role spotlights as carousels and Stories, with links sent by DM.</p></div>
  <div class="panel glass"><h3>WhatsApp channel</h3><p><a href="${WA}" rel="noopener">GigrAI Jobs</a>: new roles posted before anywhere else.</p></div>
</div></section>

<section class="block" aria-labelledby="op"><h2 id="op">Options and launch prices</h2><p class="lead">Prices in GBP. Launch prices may change.</p>
<div class="cards" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">${AD_OPTIONS.map(adOption).join("")}</div></section>

<section class="block" aria-labelledby="rep"><h2 id="rep">You see every click</h2>
<ul class="checks">
  <li class="glass">${CHECK}<span>Every campaign gets a <b>private live report</b>: clicks to your application page by day, channel and country.</span></li>
  <li class="glass">${CHECK}<span>Paid content is always labelled Sponsored or Ad, and we only promote roles that are free to apply for.</span></li>
  <li class="glass">${CHECK}<span>We write and design everything. You just send the role link.</span></li>
</ul></section>

<div class="cta-panel"><h2>Let's talk</h2><p>Send us your role link and we'll reply within a day.</p><div class="jump"><a class="btn btn-grad" href="${DM}" target="_blank" rel="noopener">Message us on Instagram ${ARROW}</a>${mailLink(kit.contactEmail)}</div></div>`;
  return pageOf({
    title: "GigrAI media kit: audience, numbers and prices",
    desc: "Reach people looking for remote AI training work through remotegigrai.com, @gigr.ai on Instagram and the GigrAI Jobs WhatsApp channel.",
    canonical: origin + "/media-kit", body, maxAge: 900, active: "/advertise",
  });
}

// ---------- /report/<id>?k=... (for one advertiser) ----------
export function sponsorReportPage({ origin, sponsor, stats, from, to }) {
  const live = new Date().toISOString().slice(0, 10) <= (sponsor.until || "");
  const body = `<section class="hero sm">
  <span class="eyebrow"><i></i>Campaign report · ${live ? "Live" : "Finished"}</span>
  <h1>${esc(sponsor.company || sponsor.id)} <span class="grad-text">on GigrAI</span></h1>
  <p>${sponsor.title ? esc(sponsor.title) + " · " : ""}${longDate(from)} to ${longDate(to)}. Updates in real time.</p>
</section>
<section class="block" aria-labelledby="tot"><h2 id="tot" class="sr">Totals</h2>
<div class="kpis">
  <div class="kpi glass"><b>${fmt(stats.total)}</b><span>Clicks to your application page</span><small>${longDate(from)} to ${longDate(to)}</small></div>
  <div class="kpi glass"><b>${fmt(stats.byCountry.length)}</b><span>${stats.byCountry.length === 1 ? "Country" : "Countries"}</span><small>Where those clicks came from</small></div>
  <div class="kpi glass"><b>${stats.bySrc[0] ? esc(source(stats.bySrc[0].src)) : "-"}</b><span>Top channel</span><small>${stats.bySrc[0] ? fmt(stats.bySrc[0].n) + " clicks" : ""}</small></div>
</div></section>
<section class="block" aria-labelledby="pd"><h2 id="pd">Clicks per day</h2><div class="panel glass">${dayChart(stats.byDay, from, to)}</div></section>
<div class="two">
<section class="block" aria-labelledby="bc"><h2 id="bc">By channel</h2><div class="panel glass">${barList(stats.bySrc, (r) => source(r.src), stats.total)}</div></section>
<section class="block" aria-labelledby="bco"><h2 id="bco">By country</h2><div class="panel glass">${barList(stats.byCountry, (r) => country(r.cc), stats.total)}</div></section>
</div>
<p class="note" style="margin-top:24px">A click is counted each time someone taps through to your application page from GigrAI. Automated traffic (bots and link previews) is excluded. No personal data is collected.</p>
<div class="jump noprint" style="margin-top:16px"><button type="button" class="ghost printbtn" onclick="window.print()" style="height:46px;padding:0 20px;border-radius:999px;border:1px solid var(--line);background:var(--glass);color:var(--soft);font-weight:600">Save as PDF</button></div>`;
  return pageOf({ title: `${sponsor.company || sponsor.id} campaign report · GigrAI`, desc: "Private campaign report.", canonical: "", body, robots: "noindex,nofollow" });
}

// ---------- /report?k=... (Lamar only) ----------
export function adminPage({ origin, views, applies, sponsors, links }) {
  const sponsorBlocks = sponsors.length ? sponsors.map((s, i) => `<div class="rlink glass">
  <b>${esc(s.company || s.id)}</b> <span class="meta">${esc(s.start || "?")} to ${esc(s.until || "?")}${s.pin === false ? " · posts only" : " · pinned on site"}</span>
  <span class="meta">Report link to send them:</span><code>${esc(links[i])}</code>
  <span class="meta">Link for Instagram posts / DMs:</span><code>${esc(origin)}/go/sponsored-${esc(s.id)}?src=ig</code>
  <span class="meta">Link for WhatsApp:</span><code>${esc(origin)}/go/sponsored-${esc(s.id)}?src=wa</code>
</div>`).join("") : `<p class="note">No campaigns yet. Add one to sponsored.json and its links appear here.</p>`;
  const body = `<section class="hero sm"><span class="eyebrow"><i></i>Private · only for you</span><h1>GigrAI <span class="grad-text">numbers</span></h1>
<p>Last 30 days. Counting started ${views ? longDate(views.since) : "-"}. Bookmark this page and don't share the link.</p></section>
<section class="block"><div class="kpis">
  <div class="kpi glass"><b>${fmt(views && views.total)}</b><span>Page views</span><small>Last 30 days</small></div>
  <div class="kpi glass"><b>${fmt(applies && applies.total)}</b><span>Clicks to apply</span><small>Last 30 days</small></div>
</div><p class="note" style="margin-top:10px">The media kit shows page views from ${fmt(SHOW_VIEWS)} and clicks from ${fmt(SHOW_APPLIES)} a month. Until then it hides them.</p></section>
${views ? `<section class="block"><h2>Page views per day</h2><div class="panel glass">${dayChart(views.byDay, views.from, views.to)}</div></section>` : ""}
<div class="two">
<section class="block"><h2>Where visitors came from</h2><div class="panel glass">${views ? barList(views.bySrc, (r) => source(r.src), views.total) : ""}</div></section>
<section class="block"><h2>Countries</h2><div class="panel glass">${views ? barList(views.byCountry, (r) => country(r.cc), views.total) : ""}</div></section>
<section class="block"><h2>Apply clicks by platform</h2><div class="panel glass">${applies ? barList(applies.byKey, (r) => r.k === "-" ? "Unknown" : r.k, applies.total) : ""}</div></section>
<section class="block"><h2>Apply clicks by channel</h2><div class="panel glass">${applies ? barList(applies.bySrc, (r) => source(r.src), applies.total) : ""}</div></section>
</div>
<section class="block"><h2>Advertiser links</h2><div class="rlinks">${sponsorBlocks}</div></section>`;
  return pageOf({ title: "GigrAI numbers (private)", desc: "Private.", canonical: "", body, robots: "noindex,nofollow" });
}

export function reportsOff(origin) {
  return pageOf({ title: "Reports · GigrAI", desc: "Private.", canonical: "", robots: "noindex,nofollow", status: 404,
    body: `<section class="hero sm"><h1>Report not found</h1><p>Check you've got the full link, or <a href="/advertise">contact us</a>.</p></section>` });
}
