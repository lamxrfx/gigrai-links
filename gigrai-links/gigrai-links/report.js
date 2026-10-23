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
.bars{list-style:none;margin:0;padding:0;display:grid;gap:4px}
.bars li{position:relative;display:grid;grid-template-columns:minmax(110px,190px) 1fr 96px;gap:12px;align-items:center;font-size:14.5px;padding:8px 10px;margin:0 -10px;border-radius:12px;cursor:default;outline:none;transition:background .15s}
.bars li:hover,.bars li:focus-visible,.bars li.on{background:rgba(255,255,255,.05)}
.bars li:focus-visible{box-shadow:0 0 0 2px #22d3ee}
.bars .t{height:12px;border-radius:999px;background:rgba(255,255,255,.06);overflow:hidden}
.bars .f{display:block;height:100%;width:0;border-radius:999px;background:#5b8cff;transition:width .7s cubic-bezier(.2,.8,.2,1)}
.bars li:hover .f,.bars li:focus-visible .f,.bars li.on .f{background:#9fbcff}
.bars .v{text-align:right;font-variant-numeric:tabular-nums;font-weight:700}
.bars .v small{margin-left:8px;font-weight:600;color:var(--muted);font-size:12.5px}
.tip{position:absolute;z-index:5;pointer-events:none;background:#10132a;border:1px solid var(--line);color:var(--text);font-size:13px;padding:7px 10px;border-radius:10px;white-space:nowrap;box-shadow:0 10px 24px -10px rgba(0,0,0,.8);transform:translate(-50%,-100%);margin-top:-8px}
.tip b{font-variant-numeric:tabular-nums}
.readout{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:6px;font-size:14px;color:var(--muted);min-height:22px}
.readout b{color:var(--text);font-variant-numeric:tabular-nums}
.days{display:flex;align-items:flex-end;gap:2px;height:160px;padding:10px 0 0;border-bottom:1px solid var(--line);position:relative}
.days i{flex:1;min-width:3px;height:100%;display:flex;align-items:flex-end;cursor:crosshair;outline:none}
.days i s{display:block;width:100%;background:#5b8cff;border-radius:4px 4px 0 0;transform-origin:bottom;transform:scaleY(0);transition:transform .6s cubic-bezier(.2,.8,.2,1),background .15s}
.days.in i s{transform:scaleY(1)}
.days i:hover s,.days i:focus-visible s,.days i.on s{background:#9fbcff}
.days i:focus-visible{box-shadow:inset 0 0 0 2px #22d3ee}
.range{display:inline-flex;gap:4px;padding:4px;border-radius:999px;background:var(--glass);border:1px solid var(--line);margin-top:14px}
.range a{padding:8px 14px;border-radius:999px;color:var(--muted);font-weight:600;font-size:14px;text-decoration:none}
.range a[aria-current]{background:rgba(91,140,255,.22);color:var(--text)}
@media (prefers-reduced-motion:reduce){.bars .f,.days i s{transition:none}}
.axis{display:flex;justify-content:space-between;color:var(--muted);font-size:12.5px;margin-top:6px}
.two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.rlinks{display:grid;gap:12px}
.rlink{padding:18px;border-radius:var(--r-md);display:grid;gap:8px}
.rlink code{display:block;padding:8px 10px;border-radius:10px;background:rgba(0,0,0,.35);font-size:13px;word-break:break-all;color:#cfe0ff}
.rlink .meta{color:var(--muted);font-size:13.5px}
.note{color:var(--muted);font-size:13.5px}
.printbtn{cursor:pointer;font:inherit}
@media (max-width:700px){.two{grid-template-columns:1fr}.bars li{grid-template-columns:minmax(84px,120px) 1fr 80px;gap:10px}}
@media print{
  header.top,footer.foot,.drawer,.menu-btn,.jump,.cta-panel .jump,.noprint{display:none!important}
  body{background:#070914!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .block{break-inside:avoid}
}
</style>
<script>
(function(){
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fmt = function(n){ return Number(n).toLocaleString("en-GB"); };
  function ready(fn){ document.readyState !== "loading" ? fn() : document.addEventListener("DOMContentLoaded", fn); }
  ready(function(){
    // Bars grow in
    requestAnimationFrame(function(){
      document.querySelectorAll(".bars .f").forEach(function(f){ f.style.width = f.dataset.w + "%"; });
      document.querySelectorAll(".days").forEach(function(d){ d.classList.add("in"); });
    });
    // Count-up numbers
    document.querySelectorAll("[data-count]").forEach(function(el){
      var to = +el.dataset.count, suffix = el.dataset.suffix || "";
      if (reduce || !to) { el.textContent = fmt(to) + suffix; return; }
      var t0 = null, dur = 900;
      function step(t){ if (!t0) t0 = t; var k = Math.min(1, (t - t0) / dur); k = 1 - Math.pow(1 - k, 3);
        el.textContent = fmt(k < 1 ? Math.round(to * k) : to) + suffix; if (k < 1) requestAnimationFrame(step); }
      requestAnimationFrame(step);
    });
    // Bar list tooltips: hover, keyboard focus or tap
    var tip = document.createElement("div"); tip.className = "tip"; tip.hidden = true; tip.setAttribute("role", "status"); document.body.appendChild(tip);
    function show(li){
      document.querySelectorAll(".bars li.on").forEach(function(x){ x.classList.remove("on"); });
      li.classList.add("on");
      tip.innerHTML = "<b>" + li.dataset.label + "</b>: " + (li.dataset.n ? fmt(li.dataset.n) + " " + li.dataset.unit + " &middot; " + li.dataset.pct + "% of total" : li.dataset.pct + "% of visitors");
      var r = li.querySelector(".t").getBoundingClientRect();
      tip.style.left = (r.left + r.width / 2 + scrollX) + "px"; tip.style.top = (r.top + scrollY) + "px"; tip.hidden = false;
    }
    function hide(){ tip.hidden = true; document.querySelectorAll(".bars li.on").forEach(function(x){ x.classList.remove("on"); }); }
    document.querySelectorAll(".bars li").forEach(function(li){
      li.addEventListener("mouseenter", function(){ show(li); });
      li.addEventListener("mouseleave", hide);
      li.addEventListener("focus", function(){ show(li); });
      li.addEventListener("blur", hide);
      li.addEventListener("click", function(){ li.classList.contains("on") ? hide() : show(li); });
    });
    // Day chart: readout line follows the pointer, keyboard or tap
    document.querySelectorAll(".daychart").forEach(function(box){
      var out = box.querySelector(".readout .cur"), def = out.innerHTML, unit = box.dataset.unit, bars = box.querySelectorAll(".days i");
      function pick(i){ bars.forEach(function(b){ b.classList.remove("on"); }); i.classList.add("on");
        out.innerHTML = i.dataset.day + ": <b>" + fmt(i.dataset.n) + "</b> " + unit; }
      function reset(){ bars.forEach(function(b){ b.classList.remove("on"); }); out.innerHTML = def; }
      bars.forEach(function(i, idx){
        i.addEventListener("mouseenter", function(){ pick(i); });
        i.addEventListener("focus", function(){ pick(i); });
        i.addEventListener("click", function(){ pick(i); });
        i.addEventListener("keydown", function(e){
          var j = e.key === "ArrowRight" ? idx + 1 : e.key === "ArrowLeft" ? idx - 1 : -1;
          if (j >= 0 && j < bars.length) { e.preventDefault(); bars[j].focus(); }
        });
      });
      box.querySelector(".days").addEventListener("mouseleave", reset);
    });
    document.addEventListener("scroll", function(){ if (!tip.hidden) hide(); }, { passive: true });
  });
})();
</script>`;

function barList(rows, label, total, unit = "", pctOnly = false) {
  if (!rows.length) return `<p class="note">No data yet.</p>`;
  const max = Math.max(...rows.map((r) => r.n), 1);
  return `<ul class="bars">${rows.map((r) => {
    const pct = total ? Math.round((r.n / total) * 100) : 0;
    const name = label(r);
    if (pctOnly) return `<li tabindex="0" data-label="${esc(name)}" data-pct="${pct}" aria-label="${esc(name)}: ${pct}% of ${esc(unit)}"><span>${esc(name)}</span><span class="t" aria-hidden="true"><span class="f" data-w="${Math.max(2, total ? Math.round((r.n / total) * 100) : 0)}"></span></span><span class="v">${pct}%</span></li>`;
    return `<li tabindex="0" data-label="${esc(name)}" data-n="${r.n}" data-pct="${pct}" data-unit="${esc(unit)}" aria-label="${esc(name)}: ${fmt(r.n)} ${esc(unit)}, ${pct}% of total"><span>${esc(name)}</span><span class="t" aria-hidden="true"><span class="f" data-w="${Math.max(2, total ? Math.round((r.n / total) * 100) : 0)}"></span></span><span class="v">${fmt(r.n)}<small>${pct}%</small></span></li>`;
  }).join("")}</ul>`;
}

function dayChart(byDay, from, to, unit = "clicks") {
  const map = Object.fromEntries(byDay.map((r) => [r.day, r.n]));
  const days = [];
  for (let d = new Date(from + "T12:00:00Z"); d.toISOString().slice(0, 10) <= to; d = new Date(d.getTime() + 864e5)) days.push(d.toISOString().slice(0, 10));
  const max = Math.max(1, ...days.map((d) => map[d] || 0));
  const total = days.reduce((a, d) => a + (map[d] || 0), 0);
  const peak = days.reduce((a, d) => ((map[d] || 0) > (map[a] || 0) ? d : a), days[0]);
  const def = total ? `Busiest day: ${shortDate(peak)}, <b>${fmt(map[peak] || 0)}</b> ${esc(unit)}` : `No ${esc(unit)} yet`;
  return `<div class="daychart" data-unit="${esc(unit)}">
<div class="readout"><span class="cur" aria-live="polite">${def}</span><span>Total: <b>${fmt(total)}</b></span></div>
<div class="days" role="group" aria-label="${esc(unit)} per day. Use the arrow keys to move between days.">${days.map((d) => {
    const n = map[d] || 0;
    return `<i tabindex="0" data-day="${shortDate(d)}" data-n="${n}" aria-label="${shortDate(d)}: ${fmt(n)} ${esc(unit)}"><s style="height:${n ? Math.max(3, Math.round((n / max) * 100)) : 0}%"></s></i>`;
  }).join("")}</div><div class="axis"><span>${shortDate(days[0])}</span><span>${shortDate(days[days.length - 1])}</span></div></div>`;
}

// A number that counts up when the page opens (plain text without JavaScript)
const countUp = (n, suffix = "") => `<b data-count="${Number(n) || 0}"${suffix ? ` data-suffix="${esc(suffix)}"` : ""}>${fmt(n)}${esc(suffix)}</b>`;
const RANGES = [7, 30, 90];
const rangeSwitch = (base, days, extra = "") => `<nav class="range noprint" aria-label="Time period">${RANGES.map((d) => `<a href="${base}?${extra}days=${d}"${d === days ? ' aria-current="true"' : ""}>${d} days</a>`).join("")}</nav>`;

const pageOf = (opts) => html(shell({ ...opts, body: STYLE + opts.body }), opts.status || 200, opts.maxAge ?? 0);

// ---------- /media-kit ----------
export function mediaKitPage({ origin, kit, liveRoles, platforms, views, applies, days = 30 }) {
  const ig = kit.instagram || {}, waf = (kit.whatsapp || {}).followers;
  // thresholds are per 30 days, scaled to the chosen period
  const scale = days / 30;
  const showViews = views && views.total >= SHOW_VIEWS * scale;
  const showApplies = applies && applies.total >= SHOW_APPLIES * scale;
  const showCountries = views && views.total >= SHOW_COUNTRIES * scale && views.byCountry.length;
  const period = `Last ${days} days`;
  const kpis = [
    ig.followers ? [ig.followers >= 1000 ? `<b>${round(ig.followers)}</b>` : countUp(ig.followers), `Instagram followers`, `@${esc(ig.handle || "gigr.ai")}`] : null,
    waf ? [waf >= 1000 ? `<b>${round(waf)}</b>` : countUp(waf), "WhatsApp channel followers", "GigrAI Jobs"] : null,
    liveRoles ? [countUp(liveRoles, "+"), "Live remote AI roles", `From ${platforms} platforms, refreshed every 30 minutes`] : null,
    showViews ? [countUp(views.total), "Website page views", period] : null,
    showApplies ? [countUp(applies.total), "Clicks to apply", period] : null,
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
<div class="kpis">${kpis.map(([n, l, s]) => `<div class="kpi glass">${n}<span>${l}</span><small>${s}</small></div>`).join("")}</div>
${showViews ? rangeSwitch("/media-kit", days) : `<p class="note" style="margin-top:12px">Message us for our latest website traffic.</p>`}
</section>

${showViews ? `<section class="block" aria-labelledby="pv"><h2 id="pv">Website page views per day</h2><p class="lead">${period}. Hover or tap a day to see its number.</p>
<div class="panel glass">${dayChart(views.byDay, views.from, views.to, "page views")}</div></section>` : ""}

${showCountries ? `<section class="block" aria-labelledby="where"><h2 id="where">Where our visitors are</h2><p class="lead">Website page views by country, ${period.toLowerCase()}. Hover or tap a country for details.</p>
<div class="panel glass">${barList(views.byCountry.slice(0, 6), (r) => country(r.cc), views.total, "page views")}</div></section>` : ""}

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
    canonical: origin + "/media-kit", body, maxAge: 900, active: "/advertise", page: "/media-kit",
  });
}

// ---------- /report/<id>?k=... (for one advertiser) ----------
export function sponsorReportPage({ origin, sponsor, stats, uniq = { total: 0, byDay: [] }, billing = null, from, to, csv = "" }) {
  const live = new Date().toISOString().slice(0, 10) <= (sponsor.until || "");
  const body = `<section class="hero sm">
  <span class="eyebrow"><i></i>Campaign report · ${live ? "Live" : "Finished"}</span>
  <h1>${esc(sponsor.company || sponsor.id)} <span class="grad-text">on GigrAI</span></h1>
  <p>${sponsor.title ? esc(sponsor.title) + " · " : ""}${longDate(from)} to ${longDate(to)}. Updates in real time.</p>
</section>
<section class="block" aria-labelledby="tot"><h2 id="tot" class="sr">Totals</h2>
<div class="kpis">
  <div class="kpi glass">${countUp(uniq.total)}<span>Unique clicks to your application page</span><small>Each person counted once a day · ${fmt(stats.total)} clicks in all</small></div>
  ${billing ? `<div class="kpi glass"><b>£${billing.spent.toFixed(2)}</b><span>of your £${fmt(billing.budget)} budget used</span><small>${fmt(billing.billable)} billable clicks at £${billing.cpc.toFixed(2)} · ${fmt(Math.max(0, billing.cap - billing.billable))} left</small></div>` : ""}
  <div class="kpi glass">${countUp(stats.byCountry.length)}<span>${stats.byCountry.length === 1 ? "Country" : "Countries"}</span><small>Where those clicks came from</small></div>
  <div class="kpi glass"><b>${stats.bySrc[0] ? esc(source(stats.bySrc[0].src)) : "-"}</b><span>Top channel</span><small>${stats.bySrc[0] ? fmt(stats.bySrc[0].n) + " clicks" : ""}</small></div>
</div></section>
${billing && billing.billable >= billing.cap ? `<p class="note" style="padding:12px 16px;border-radius:12px;background:rgba(61,214,140,.12);border:1px solid rgba(61,214,140,.35);color:#c9f5dd">Your budget has been fully used, so your listing is no longer pinned. Get in touch to top up.</p>` : ""}
<section class="block" aria-labelledby="pd"><h2 id="pd">Unique clicks per day</h2><div class="panel glass">${dayChart(uniq.byDay, from, to, "unique clicks")}</div></section>
<div class="two">
<section class="block" aria-labelledby="bc"><h2 id="bc">By channel</h2><div class="panel glass">${barList(stats.bySrc, (r) => source(r.src), stats.total, "clicks")}</div></section>
<section class="block" aria-labelledby="bco"><h2 id="bco">By country</h2><div class="panel glass">${barList(stats.byCountry, (r) => country(r.cc), stats.total, "clicks")}</div></section>
</div>
<p class="note" style="margin-top:24px">A unique click is one person tapping through to your application page from GigrAI, counted once per day however many times they tap. ${billing ? "Billing uses unique clicks only. " : ""}Automated traffic (bots and link previews) is excluded. No personal data is collected or shared.</p>
<div class="jump noprint" style="margin-top:16px">${csv ? `<a class="ghost printbtn" href="${esc(csv)}" style="height:46px;padding:0 20px;border-radius:999px;border:1px solid var(--line);background:var(--glass);color:var(--soft);font-weight:600;display:inline-flex;align-items:center;text-decoration:none">Download CSV</a>` : ""}<button type="button" class="ghost printbtn" onclick="window.print()" style="height:46px;padding:0 20px;border-radius:999px;border:1px solid var(--line);background:var(--glass);color:var(--soft);font-weight:600">Save as PDF</button></div>`;
  return pageOf({ title: `${sponsor.company || sponsor.id} campaign report · GigrAI`, desc: "Private campaign report.", canonical: "", body, robots: "noindex,nofollow" });
}

// ---------- /report?k=... (Lamar only) ----------
export function adminPage({ origin, views, applies, sponsors, links, days = 30, key = "" }) {
  const sponsorBlocks = sponsors.length ? sponsors.map((s, i) => `<div class="rlink glass">
  <b>${esc(s.company || s.id)}</b> <span class="meta">${esc(s.start || "?")} to ${esc(s.until || "?")}${s.pin === false ? " · posts only" : " · pinned on site"} · ${fmt(s._unique || 0)} unique clicks${s._cap ? ` of ${fmt(s._cap)} paid for (£${(Math.min(s._unique || 0, s._cap) * s.cpc).toFixed(2)} of £${s.budget})${(s._unique || 0) >= s._cap ? " · <b>budget used, unpinned</b>" : ""}` : ""}</span>
  <span class="meta">Report link to send them:</span><code>${esc(links[i])}</code>
  <span class="meta">Link for Instagram posts / DMs:</span><code>${esc(origin)}/go/sponsored-${esc(s.id)}?src=ig</code>
  <span class="meta">Link for WhatsApp:</span><code>${esc(origin)}/go/sponsored-${esc(s.id)}?src=wa</code>
</div>`).join("") : `<p class="note">No campaigns yet. Add one to sponsored.json and its links appear here.</p>`;
  const body = `<section class="hero sm"><span class="eyebrow"><i></i>Private · only for you</span><h1>GigrAI <span class="grad-text">numbers</span></h1>
<p>Last ${days} days. Counting started ${views ? longDate(views.since) : "-"}. Bookmark this page and don't share the link.</p>
${rangeSwitch("/report", days, `k=${encodeURIComponent(key)}&`)}</section>
<section class="block"><div class="kpis">
  <div class="kpi glass">${countUp(views && views.total)}<span>Page views</span><small>Last ${days} days</small></div>
  <div class="kpi glass">${countUp(applies && applies.total)}<span>Clicks to apply</span><small>Last ${days} days</small></div>
  <div class="kpi glass">${countUp(views && views.total ? Math.round(((applies && applies.total) || 0) / views.total * 1000) / 10 : 0, "%")}<span>Apply rate</span><small>Apply clicks per page view</small></div>
</div><p class="note" style="margin-top:10px">The media kit shows the countries chart from ${fmt(SHOW_COUNTRIES)} page views, and page view and click totals from ${fmt(SHOW_VIEWS)} and ${fmt(SHOW_APPLIES)} a month.</p></section>
${views ? `<section class="block"><h2>Page views per day</h2><div class="panel glass">${dayChart(views.byDay, views.from, views.to, "page views")}</div></section>` : ""}
${applies ? `<section class="block"><h2>Apply clicks per day</h2><div class="panel glass">${dayChart(applies.byDay, views ? views.from : applies.byDay[0]?.day, views ? views.to : new Date().toISOString().slice(0, 10), "apply clicks")}</div></section>` : ""}
<div class="two">
<section class="block"><h2>Where visitors came from</h2><div class="panel glass">${views ? barList(views.bySrc, (r) => source(r.src), views.total, "page views") : ""}</div></section>
<section class="block"><h2>Countries</h2><div class="panel glass">${views ? barList(views.byCountry, (r) => country(r.cc), views.total, "page views") : ""}</div></section>
<section class="block"><h2>Apply clicks by platform</h2><div class="panel glass">${applies ? barList(applies.byKey, (r) => r.k === "-" ? "Unknown" : r.k, applies.total, "apply clicks") : ""}</div></section>
<section class="block"><h2>Apply clicks by channel</h2><div class="panel glass">${applies ? barList(applies.bySrc, (r) => source(r.src), applies.total, "apply clicks") : ""}</div></section>
</div>
<section class="block"><h2>Advertiser links</h2><div class="rlinks">${sponsorBlocks}</div></section>`;
  return pageOf({ title: "GigrAI numbers (private)", desc: "Private.", canonical: "", body, robots: "noindex,nofollow" });
}

export function reportsOff(origin) {
  return pageOf({ title: "Reports · GigrAI", desc: "Private.", canonical: "", robots: "noindex,nofollow", status: 404,
    body: `<section class="hero sm"><h1>Report not found</h1><p>Check you've got the full link, or <a href="/advertise">contact us</a>.</p></section>` });
}
