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
const BOT_KINDS = { search: "Search engines (Google, Bing…)", preview: "Link previews (WhatsApp, Instagram…)", ai: "AI crawlers (ChatGPT, Claude…)", seo: "SEO tools (Ahrefs, Semrush…)", ads: "Google AdSense checker", script: "Scripts and test tools", prefetch: "Browser preloading", "no-ua": "No browser details", other: "Other bots" };
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
const rangeSwitch = (base, days, extra = "", allTime = null) => `<nav class="range noprint" aria-label="Time period">${RANGES.map((d) => `<a href="${base}?${extra}days=${d}"${d === days && !allTime ? ' aria-current="true"' : ""}>${d} days</a>`).join("")}${allTime !== null ? `<a href="${base}?${extra}days=all"${allTime ? ' aria-current="true"' : ""}>All time</a>` : ""}</nav>`;

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
  <div class="jump"><a class="btn btn-grad" href="/advertise#book" style="color:#fff">Book your spot ${ARROW}</a>${mailLink(kit.contactEmail, "Email us")}<button type="button" class="ghost printbtn" onclick="window.print()" style="height:52px;padding:0 22px;border-radius:999px;border:1px solid var(--line);background:var(--glass);color:var(--soft);font-weight:600">Save as PDF</button></div>
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

<div class="cta-panel"><h2>Let's talk</h2><p>Book online in two minutes and we'll confirm within one working day.</p><div class="jump"><a class="btn btn-grad" href="/advertise#book">Book your spot ${ARROW}</a>${mailLink(kit.contactEmail)}</div></div>`;
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
// World map: who's on the site now (refreshes itself) and where visits came from in the chosen range.
// Drawn in the browser with d3 + a world outline from jsDelivr (this page is private, so no tracking concerns).
// ISO country letters -> the number codes the world map uses (e.g. GB826)
const ISO_NUM = "AD020AE784AF004AG028AI660AL008AM051AO024AQ010AR032AS016AT040AU036AW533AX248AZ031BA070BB052BD050BE056BF854BG100BH048BI108BJ204BL652BM060BN096BO068BQ535BR076BS044BT064BV074BW072BY112BZ084CA124CC166CD180CF140CG178CH756CI384CK184CL152CM120CN156CO170CR188CU192CV132CW531CX162CY196CZ203DE276DJ262DK208DM212DO214DZ012EC218EE233EG818EH732ER232ES724ET231FI246FJ242FK238FM583FO234FR250GA266GB826GD308GE268GF254GG831GH288GI292GL304GM270GN324GP312GQ226GR300GS239GT320GU316GW624GY328HK344HM334HN340HR191HT332HU348ID360IE372IL376IM833IN356IO086IQ368IR364IS352IT380JE832JM388JO400JP392KE404KG417KH116KI296KM174KN659KP408KR410KW414KY136KZ398LA418LB422LC662LI438LK144LR430LS426LT440LU442LV428LY434MA504MC492MD498ME499MF663MG450MH584MK807ML466MM104MN496MO446MP580MQ474MR478MS500MT470MU480MV462MW454MX484MY458MZ508NA516NC540NE562NF574NG566NI558NL528NO578NP524NR520NU570NZ554OM512PA591PE604PF258PG598PH608PK586PL616PM666PN612PR630PS275PT620PW585PY600QA634RE638RO642RS688RU643RW646SA682SB090SC690SD729SE752SG702SH654SI705SJ744SK703SL694SM674SN686SO706SR740SS728ST678SV222SX534SY760SZ748TC796TD148TF260TG768TH764TJ762TK772TL626TM795TN788TO776TR792TT780TV798TW158TZ834UA804UG800UM581US840UY858UZ860VA336VC670VE862VG092VI850VN704VU548WF876WS882XK983YE887YT175ZA710ZM894ZW716";
function liveMap(key, period, geo, ccViews = []) {
  const cc = {}; for (const r of ccViews) { const c = String(r.cc || "").toUpperCase(); if (/^[A-Z]{2}$/.test(c) && c !== "XX") cc[c] = (cc[c] || 0) + r.n; }
  const ccJson = JSON.stringify(cc);
  const data = JSON.stringify((geo || []).filter(g => g.lat !== null && g.lon !== null).map(g => [Math.round(g.lat * 10) / 10, Math.round(g.lon * 10) / 10, g.n, g.city || "", g.cc])).replace(/</g, "\\u003c");
  return `<section class="block" id="live"><div class="live-head"><h2>Live visitors</h2>
<div class="livebar"><button type="button" class="rf" id="mapRefresh" aria-label="Refresh the map now"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 4v5h-5"/></svg><span id="mapAgo">Refresh</span></button><div class="seg" role="tablist"><button type="button" class="on" data-m="live">Live now</button><button type="button" data-m="hist">${esc(period)}</button></div></div></div>
<div class="panel glass mapwrap"><div class="mapbox"><svg id="map" viewBox="0 0 960 470" role="img" aria-label="World map of visitors"></svg><div class="mapctl"><button type="button" id="mapIn" aria-label="Zoom in">+</button><button type="button" id="mapOut" aria-label="Zoom out">−</button><button type="button" id="mapReset" class="wide" hidden>Reset</button></div></div><div class="maptip" id="mapTip" hidden></div><div class="hud" id="hud"><div class="hud-n"><span class="pulse" id="hudDot"></span><b id="liveN">…</b><span id="hudLbl">on the site now</span><button type="button" class="hudx" id="hudX" aria-label="Hide details" aria-expanded="true">–</button></div><div class="hudbody"><h3 class="mini" id="hudCCt">Countries</h3><ul class="chips" id="liveCC"></ul><div id="hudPagesBox"><h3 class="mini">Pages now</h3><ul class="chips" id="livePages"></ul></div></div></div><div class="hud hud2" id="hud2" hidden><h3 class="mini" style="margin-top:0">Today <span class="utc">(UTC)</span></h3><div class="hud-today" id="hudToday"></div><h3 class="mini">Top countries today</h3><ul class="chips" id="todayCC"></ul></div>
<p class="note" id="mapNote">Visitors active in the last 5 minutes, by town. Updates every 20 seconds.</p></div>
</section>
<style>
.live-head{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;margin-bottom:12px}.live-head h2{margin:0;display:flex;align-items:center;gap:10px}
.pulse{width:10px;height:10px;border-radius:50%;background:#34d399;box-shadow:0 0 0 0 rgba(52,211,153,.7);animation:pl 1.8s infinite}@keyframes pl{70%{box-shadow:0 0 0 12px rgba(52,211,153,0)}100%{box-shadow:0 0 0 0 rgba(52,211,153,0)}}
.livebar{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.rf{display:inline-flex;align-items:center;gap:7px;height:40px;padding:0 14px;border-radius:999px;border:1px solid var(--line-2);background:var(--glass);color:var(--text);font:inherit;font-weight:700;font-size:13px;cursor:pointer}.rf:hover{border-color:#7fdcf0}.rf.spin svg{animation:rfs .8s linear infinite}@keyframes rfs{to{transform:rotate(360deg)}}
.seg{display:inline-flex;padding:4px;border-radius:999px;border:1px solid var(--line-2);background:var(--glass)}.seg button{border:0;background:none;color:var(--muted);font:inherit;font-weight:700;font-size:13px;padding:8px 14px;border-radius:999px;cursor:pointer}.seg button.on{background:var(--grad);color:#fff}
.mapwrap{position:relative;padding:10px;-webkit-user-select:none;user-select:none}#map{display:block;width:100%;height:auto;max-height:min(66vh,560px)}#map{cursor:grab;overflow:hidden;border-radius:14px}#map:active{cursor:grabbing}#map .land{fill:#1a1f3d;stroke:#2c3363;stroke-width:.6;vector-effect:non-scaling-stroke;cursor:pointer;transition:fill .15s}#map .land:hover{fill:#232a52}#map .land.on{fill:#2a3368}#map .dot{cursor:pointer}#map .lbl{fill:#eef1ff;font-weight:700;paint-order:stroke;stroke:#0b0e1d;stroke-linejoin:round;pointer-events:none}
.mapbox{position:relative}.mapctl{position:absolute;right:10px;bottom:10px;display:flex;gap:2px;padding:3px;border-radius:999px;background:rgba(10,13,30,.55);border:1px solid var(--line);opacity:.75;transition:opacity .15s}.mapctl:hover,.mapctl:focus-within{opacity:1}.mapctl button{width:28px;height:28px;border-radius:999px;border:0;background:none;color:#cfd6f5;font:600 16px/1 inherit;font-family:inherit;cursor:pointer}.mapctl button:hover{background:rgba(255,255,255,.1);color:#fff}.mapctl button.wide{width:auto;padding:0 10px;font-size:12px}.mapctl [hidden]{display:none}
.maptip{position:absolute;pointer-events:none;padding:7px 10px;border-radius:10px;background:#f2f4ff;color:#0b0e1d;font-size:13px;font-weight:700;white-space:nowrap;transform:translate(-50%,-120%)}
.rolelist{list-style:none;margin:0;padding:0;display:grid;gap:6px}.rolelist li{display:grid;grid-template-columns:28px 1fr auto;gap:10px;align-items:center;padding:8px 10px;border-radius:12px}.rolelist li:hover{background:rgba(255,255,255,.04)}.rolelist .rk{color:var(--muted);font-weight:700;text-align:center}.rolelist .rt{min-width:0;display:grid;gap:2px}.rolelist .rt a{color:var(--text);font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rolelist .rt span{color:var(--muted);font-size:12.5px}.rolelist .rt i{display:block;height:4px;border-radius:4px;background:linear-gradient(90deg,#22d3ee,#8b3dff)}.rolelist b{font-size:18px;font-variant-numeric:tabular-nums}
.flaglist{list-style:none;margin:0;padding:0;display:grid;gap:8px}.flaglist li{display:grid;gap:2px;padding:10px 12px;border-radius:12px;background:rgba(255,193,7,.07);border:1px solid rgba(255,193,7,.25)}.flaglist span{color:var(--muted);font-size:13px}
.chips .ccgo{all:unset;cursor:pointer}.chips li:has(.ccgo):hover{border-color:#7fdcf0}.chips li:has(.ccgo){padding:0}.chips .ccgo{display:block;padding:6px 11px}.chips .ccgo:focus-visible{outline:2px solid #7fdcf0;border-radius:999px}
.chips li.mo{padding:0;background:none;border:1px dashed var(--line-2)}.chips .more{all:unset;display:block;padding:6px 11px;cursor:pointer;color:#7fdcf0;font-weight:700;font-size:12.5px}
.chips{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px}.chips li{padding:6px 11px;border-radius:999px;background:var(--glass);border:1px solid var(--line);font-size:13px}.chips li b{margin-left:5px}
h3.mini{font-size:14px;color:var(--muted);margin:14px 0 8px}
.hud{position:absolute;top:18px;left:18px;width:240px;max-height:calc(100% - 80px);overflow:auto;padding:14px;border-radius:16px;background:rgba(10,13,30,.72);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid var(--line-2);box-shadow:0 18px 40px -18px rgba(0,0,0,.9);scrollbar-width:none}
.hud::-webkit-scrollbar{display:none}.hudx{margin-left:auto;width:26px;height:26px;flex:none;border-radius:8px;border:1px solid var(--line-2);background:none;color:var(--text);font:700 15px/1 inherit;font-family:inherit;cursor:pointer}.hud.min .hudbody{display:none}.hud.min{width:auto}.hud[hidden],.hud2.min{display:none}.hud2{top:18px;left:auto;right:18px;bottom:auto;width:220px;padding:12px;max-height:calc(100% - 70px)}.hud2 .chips li{font-size:12px}.hud2 .ccgo{padding:5px 10px}.hud-today{display:grid;grid-template-columns:1fr 1fr;gap:6px}.hud-today div{padding:7px 9px;border-radius:12px;background:rgba(255,255,255,.06)}.hud-today b{display:block;font-size:17px;font-variant-numeric:tabular-nums}.hud-today span{font-size:11.5px;color:var(--muted)}.hud .utc{text-transform:none;letter-spacing:0;font-weight:500}
.hud-n{display:flex;align-items:center;gap:9px;font-size:13px;color:var(--muted)}.hud-n b{font-size:28px;line-height:1;color:var(--text);font-weight:800;font-variant-numeric:tabular-nums}
.hud h3.mini{margin:12px 0 7px;font-size:11.5px;text-transform:uppercase;letter-spacing:.06em}.hud .chips li{font-size:12.5px;background:rgba(255,255,255,.06)}.hud .pulse{flex:none}.hud .pulse.off{background:#8b3dff;animation:none}
@media(max-width:700px){.hud2{margin-top:4px}.hud2.min{display:block}.hudx{display:none}.hud.min .hudbody{display:block}.hud{position:static;width:auto;max-height:none;margin-top:10px;background:none;border:0;box-shadow:none;backdrop-filter:none;-webkit-backdrop-filter:none;padding:4px 2px}}
@media(prefers-reduced-motion:reduce){.pulse{animation:none}}
</style>
<script src="https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js" integrity="sha384-CjloA8y00+1SDAUkjs099PVfnY2KmDC2BZnws9kh8D/lX1s46w6EPhpXdqMfjK6i" crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js" integrity="sha384-Ukv1p/xTma6P4/2bY5KzWBw+ydSpXmhCMtyciIQVDJ1RmOxtCYNMF1uXT9T63H67" crossorigin="anonymous"></script>
<script>
(function(){
  var HIST=${data}, CC=${ccJson}, ISO="${ISO_NUM}", KEY=${JSON.stringify(key)}, mode="live", live=[];
  var NUM2CC={}; for(var i=0;i<ISO.length;i+=5)NUM2CC[ISO.slice(i+2,i+5)]=ISO.slice(i,i+2);
  var ccMax=d3.max(Object.values(CC))||1, ccShade=d3.scaleSqrt().domain([0,ccMax]).range([0,1]);
  function viewsOf(f){var c=NUM2CC[f.id];return c?(CC[c]||0):0}
  function colour(){gLand.selectAll(".land").style("fill",function(f){if(mode!=="hist")return null;var v=viewsOf(f);return v?d3.interpolateRgb("#2a2470","#a46bff")(ccShade(v)):null})}
  var svg=d3.select("#map"), proj=d3.geoNaturalEarth1().scale(165).translate([480,245]), path=d3.geoPath(proj);
  var defs=svg.append("defs"), gView=svg.append("g"), gLand=gView.append("g"), gDots=gView.append("g"), tip=document.getElementById("mapTip"), wrap=document.querySelector(".mapwrap");
  var names; try{names=new Intl.DisplayNames(["en"],{type:"region"})}catch(e){}
  function cn(c){c=String(c||"").toUpperCase();try{return /^[A-Z]{2}$/.test(c)&&c!=="XX"?names.of(c):"Unknown"}catch(e){return c}}
  [["gLive","#22d3ee"],["gHist","#8b3dff"]].forEach(function(g){var r=defs.append("radialGradient").attr("id",g[0]);r.append("stop").attr("offset","0%").attr("stop-color",g[1]).attr("stop-opacity",.95);r.append("stop").attr("offset","100%").attr("stop-color",g[1]).attr("stop-opacity",0)});
  function showTip(e,text){var b=wrap.getBoundingClientRect();tip.hidden=false;tip.style.left=(e.clientX-b.left)+"px";tip.style.top=(e.clientY-b.top)+"px";tip.textContent=text}

  // Zoom and pan: scroll or pinch to zoom, drag to move, tap a country to fly to it
  var K=1, picked=null;
  var zoom=d3.zoom().scaleExtent([1,40]).translateExtent([[-40,-40],[1000,510]])
    .filter(function(e){ if(e.type==="wheel")return true; if(e.touches)return e.touches.length>1||K>1.01; return !e.button; })
    .on("zoom",function(e){K=e.transform.k;gView.attr("transform",e.transform);size();svg.style("touch-action",K>1.01?"none":"pan-y");document.getElementById("mapReset").hidden=K<1.01;});
  svg.call(zoom).on("dblclick.zoom",null);svg.style("touch-action","pan-y");
  function flyTo(t){svg.transition().duration(650).call(zoom.transform,t)}
  function reset(){picked=null;gLand.selectAll(".land").classed("on",false);flyTo(d3.zoomIdentity)}
  function zoomBy(f){svg.transition().duration(300).call(zoom.scaleBy,f)}
  document.getElementById("mapIn").onclick=function(){zoomBy(2)};
  document.getElementById("mapOut").onclick=function(){zoomBy(.5)};
  document.getElementById("mapReset").onclick=reset;

  fetch("https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json").then(function(r){return r.json()}).then(function(w){
    gLand.selectAll("path").data(topojson.feature(w,w.objects.countries).features.filter(function(f){return f.id!=="010"})).join("path").attr("class","land").attr("d",path)
      .on("mousemove",function(e,f){if(e.pointerType!=="touch")showTip(e,f.properties.name+(mode==="hist"?" · "+viewsOf(f).toLocaleString("en-GB")+" views":""))})
      .on("mouseleave",function(){tip.hidden=true})
      .on("click",function(e,f){
        e.stopPropagation();
        if(picked===f){reset();return}
        picked=f;gLand.selectAll(".land").classed("on",function(x){return x===f});
        var bb=path.bounds(f),dx=bb[1][0]-bb[0][0],dy=bb[1][1]-bb[0][1],cx=(bb[0][0]+bb[1][0])/2,cy=(bb[0][1]+bb[1][1])/2;
        var k=Math.max(1,Math.min(24,.8/Math.max(dx/960,dy/470)));
        flyTo(d3.zoomIdentity.translate(480,235).scale(k).translate(-cx,-cy));
        showTip(e,f.properties.name+(mode==="hist"?" · "+viewsOf(f).toLocaleString("en-GB")+" views":""));
      });
    gDots.raise();colour();
  }).catch(function(){});

  // Dots keep a sensible size on screen as you zoom; town names appear when zoomed in
  function size(){
    gDots.selectAll("g.dot").each(function(r){
      var g=d3.select(this),base=+g.attr("data-r");
      g.select(".halo").attr("r",base/Math.pow(K,.75));
      g.select(".core").attr("r",(mode==="live"?2.6:1.8)/Math.pow(K,.9));
      g.select("text").attr("font-size",11/K).attr("stroke-width",3/K).attr("x",5/K).attr("y",-5/K).style("display",K>=3&&r[3]?null:"none");
    });
  }
  function draw(){
    var rows=(mode==="live"?live:HIST).slice().sort(function(a,b){return b[2]-a[2]}), max=d3.max(rows,function(r){return r[2]})||1, rs=d3.scaleSqrt().domain([0,max]).range([4,mode==="live"?26:34]);
    var sel=gDots.selectAll("g.dot").data(rows,function(r){return r[0]+","+r[1]+","+r[3]});
    sel.exit().remove();
    var en=sel.enter().append("g").attr("class","dot");
    en.append("circle").attr("class","halo");en.append("circle").attr("class","core");en.append("text").attr("class","lbl");
    en.merge(sel).each(function(r){
      var p=proj([r[1],r[0]]);if(!p)return;var g=d3.select(this).attr("transform","translate("+p[0]+","+p[1]+")").attr("data-r",rs(r[2]));
      g.select(".halo").attr("fill","url(#"+(mode==="live"?"gLive":"gHist")+")");
      g.select(".core").attr("fill",mode==="live"?"#e6fbff":"#d9c6ff");
      g.select("text").text(r[3]?r[3]+" · "+r[2]:"");
    }).on("mousemove",function(e,r){showTip(e,(r[3]?r[3]+", ":"")+cn(r[4])+" · "+r[2].toLocaleString("en-GB")+(mode==="live"?" now":" views"))})
      .on("mouseleave",function(){tip.hidden=true})
      .on("click",function(e,r){e.stopPropagation();showTip(e,(r[3]?r[3]+", ":"")+cn(r[4])+" · "+r[2].toLocaleString("en-GB")+(mode==="live"?" now":" views"))});
    gDots.selectAll("g.dot").order();
    size();colour();if(typeof hud==="function")hud();
    document.getElementById("mapNote").textContent=(mode==="live"?(live.length?"Visitors active in the last 5 minutes, by town. Updates every 20 seconds.":"Nobody on the site in the last 5 minutes. This updates every 20 seconds."):("Brighter countries = more page views (${esc(period).toLowerCase()}), "+Object.values(CC).reduce(function(a,b){return a+b},0).toLocaleString("en-GB")+" in total."+(HIST.length?" Dots show towns, recorded since 23 Oct 2026.":"")))+" Tap a country to zoom in, pinch or scroll to zoom, drag to move.";
  }
  // Show the top 4; the rest behind "+N more" so the panels stay tidy
  var MORE={};
  function chips(id,rows,label,cc){
    var el=document.getElementById(id), lim=MORE[id]?rows.length:4, show=rows.slice(0,lim);
    var h=rows.length?show.map(function(r){var t=label(r)+"<b>"+r.n+"</b>";return cc?'<li><button type="button" class="ccgo" data-cc="'+esc(r.cc)+'">'+t+"</button></li>":"<li>"+t+"</li>"}).join(""):"<li>None right now</li>";
    if(rows.length>4)h+='<li class="mo"><button type="button" class="more" data-more="'+id+'">'+(MORE[id]?"Show less":"+"+(rows.length-4)+" more")+"</button></li>";
    el.innerHTML=h;
  }
  document.addEventListener("click",function(e){var b=e.target.closest&&e.target.closest(".more");if(!b)return;e.stopPropagation();MORE[b.dataset.more]=!MORE[b.dataset.more];hud();});
  // Tap a country under the map: fly to its dots (or the country itself)
  function goCountry(c){
    var pts=(mode==="live"?live:HIST).filter(function(p){return String(p[4]).toLowerCase()===c}).map(function(p){return proj([p[1],p[0]])}).filter(Boolean);
    var t;
    if(pts.length){
      var x0=d3.min(pts,function(p){return p[0]}),x1=d3.max(pts,function(p){return p[0]}),y0=d3.min(pts,function(p){return p[1]}),y1=d3.max(pts,function(p){return p[1]});
      var k=pts.length===1?8:Math.max(1,Math.min(12,.45/Math.max((x1-x0)/960,(y1-y0)/470,.02)));
      t=d3.zoomIdentity.translate(480,235).scale(k).translate(-(x0+x1)/2,-(y0+y1)/2);
    }
    var f=gLand.selectAll(".land").filter(function(x){return NUM2CC[x.id]===c.toUpperCase()});
    gLand.selectAll(".land").classed("on",false);f.classed("on",true);picked=f.size()?f.datum():null;
    if(!t&&f.size()){var bb=path.bounds(f.datum());t=d3.zoomIdentity.translate(480,235).scale(Math.max(1,Math.min(24,.8/Math.max((bb[1][0]-bb[0][0])/960,(bb[1][1]-bb[0][1])/470)))).translate(-(bb[0][0]+bb[1][0])/2,-(bb[0][1]+bb[1][1])/2);}
    if(t){flyTo(t);if(innerWidth<=700)window.scrollTo({top:document.getElementById("live").getBoundingClientRect().top+scrollY-90,behavior:"smooth"});}
  }
  ["liveCC","todayCC"].forEach(function(id){document.getElementById(id).addEventListener("click",function(e){var b=e.target.closest(".ccgo");if(b){e.stopPropagation();goCountry(b.dataset.cc)}})});
  function esc(t){return String(t).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
  var liveTotal=0, liveCountries=[], livePages=[], todayD=null;
  document.getElementById("hudX").addEventListener("click",function(){var h=document.getElementById("hud"),m=h.classList.toggle("min");document.getElementById("hud2").classList.toggle("min",m);this.textContent=m?"+":"–";this.setAttribute("aria-expanded",String(!m));this.setAttribute("aria-label",m?"Show details":"Hide details");try{localStorage.setItem("gg-hud-min",m?"1":"")}catch(e){}});
  try{if(localStorage.getItem("gg-hud-min")&&innerWidth>700)document.getElementById("hudX").click()}catch(e){}
  function hud(){
    var h=mode==="hist";
    document.getElementById("liveN").textContent=(h?Object.values(CC).reduce(function(a,b){return a+b},0):liveTotal).toLocaleString("en-GB");
    document.getElementById("hudLbl").textContent=h?"page views · ${esc(period).toLowerCase()}":"on the site now";
    document.getElementById("hudDot").classList.toggle("off",h);
    document.getElementById("hudCCt").textContent=h?"Top countries":"Countries now";
    var td=document.getElementById("hudToday");document.getElementById("hud2").hidden=h||!todayD;
    if(!h&&todayD){td.innerHTML='<div><b>'+todayD.views.toLocaleString("en-GB")+'</b><span>Views</span></div><div><b>'+todayD.applies.toLocaleString("en-GB")+'</b><span>Apply clicks</span></div>';chips("todayCC",todayD.countries,function(r){return esc(cn(r.cc))},true);}
    document.getElementById("hudPagesBox").hidden=h;
    var rows=h?Object.keys(CC).map(function(c){return {cc:c.toLowerCase(),n:CC[c]}}).sort(function(a,b){return b.n-a.n}).slice(0,12):liveCountries;
    chips("liveCC",rows,function(r){return esc(cn(r.cc))},true);
    if(!h)chips("livePages",livePages,function(r){return esc(r.page)});
  }
  var lastAt=0, rfBtn=document.getElementById("mapRefresh"), ago=document.getElementById("mapAgo");
  function tick(){if(!lastAt)return;var sec=Math.round((Date.now()-lastAt)/1000);ago.textContent=sec<5?"Updated just now":"Updated "+(sec<60?sec+"s":Math.floor(sec/60)+"m")+" ago"}
  setInterval(tick,1000);
  rfBtn.addEventListener("click",function(){load()});
  function load(){
    rfBtn.classList.add("spin");
    fetch("/report-live?k="+encodeURIComponent(KEY),{cache:"no-store"}).then(function(r){return r.json()}).then(function(d){
      lastAt=Date.now();tick();
      if(!d||!d.ok)return;live=d.places.filter(function(p){return p.lat!==null&&p.lon!==null}).map(function(p){return [p.lat,p.lon,p.n,p.city||"",p.cc]});
      liveTotal=d.total;liveCountries=d.countries;livePages=d.pages;todayD=d.today||null;hud();
      if(mode==="live")draw();
    }).catch(function(){}).then(function(){rfBtn.classList.remove("spin")});
  }
  document.querySelectorAll(".seg button").forEach(function(b){b.addEventListener("click",function(){document.querySelectorAll(".seg button").forEach(function(x){x.classList.toggle("on",x===b)});mode=b.dataset.m;draw()})});
  document.addEventListener("click",function(){tip.hidden=true});
  load();setInterval(function(){if(!document.hidden)load()},20000);
  document.addEventListener("visibilitychange",function(){if(!document.hidden&&Date.now()-lastAt>15000)load()});
})();
</script>`;
}

export function adminPage({ origin, views, applies, sponsors, links, days = 30, allTime = false, key = "", enquiries = [], geo = [], ccViews = [], bots = null, flags = [], hidden = true, roles = [] }) {
  const period = allTime ? "All time" : `Last ${days} days`;
  const sponsorBlocks = sponsors.length ? sponsors.map((s, i) => `<div class="rlink glass">
  <b>${esc(s.company || s.id)}</b> <span class="meta">${esc(s.start || "?")} to ${esc(s.until || "?")}${s.pin === false ? " · posts only" : " · pinned on site"} · ${fmt(s._unique || 0)} unique clicks${s._cap ? ` of ${fmt(s._cap)} paid for (£${(Math.min(s._unique || 0, s._cap) * s.cpc).toFixed(2)} of £${s.budget})${(s._unique || 0) >= s._cap ? " · <b>budget used, unpinned</b>" : ""}` : ""}</span>
  <span class="meta">Report link to send them:</span><code>${esc(links[i])}</code>
  <span class="meta">Link for Instagram posts / DMs:</span><code>${esc(origin)}/go/sponsored-${esc(s.id)}?src=ig</code>
  <span class="meta">Link for WhatsApp:</span><code>${esc(origin)}/go/sponsored-${esc(s.id)}?src=wa</code>
</div>`).join("") : `<p class="note">No campaigns yet. Add one to sponsored.json and its links appear here.</p>`;
  const body = `<section class="hero sm"><span class="eyebrow"><i></i>Private · only for you</span><h1>GigrAI <span class="grad-text">numbers</span></h1>
<p>${period}. Counting started ${views ? longDate(views.since) : "-"}. Bookmark this page and don't share the link.</p>
<p class="note" style="margin-top:6px">${hidden ? `🔒 <b>This device isn't counted</b> in your numbers or on the map. <a href="/report?k=${encodeURIComponent(key)}&count=1">Count it again</a>` : `This device is counted like any visitor. <a href="/report?k=${encodeURIComponent(key)}&count=0">Stop counting this device</a>`}</p>
${rangeSwitch("/report", days, `k=${encodeURIComponent(key)}&`, allTime)}</section>
${liveMap(key, period, geo, ccViews)}
<section class="block"><div class="kpis">
  <div class="kpi glass">${countUp(views && views.total)}<span>Page views</span><small>${period}</small></div>
  <div class="kpi glass">${countUp(applies && applies.total)}<span>Clicks to apply</span><small>${period}</small></div>
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
<section class="block"><h2>Most-clicked roles</h2><div class="panel glass">${roles.length ? `<ol class="rolelist">${roles.map((r, i) => { const top = roles[0].n || 1; return `<li><span class="rk">${i + 1}</span><div class="rt"><a href="${esc(r.path || "/jobs")}" target="_blank" rel="noopener">${esc(r.title || r.id)}</a><span>${esc(r.via || "")}${r.pay ? " · " + esc(r.pay) : ""}</span><i style="width:${Math.max(4, Math.round(r.n / top * 100))}%"></i></div><b>${fmt(r.n)}</b></li>`; }).join("")}</ol><p class="note" style="margin:12px 0 0">Apply clicks per role (${esc(period.toLowerCase())}). Counting per role started 23 Oct 2026. Roles that have closed still show their last title.</p>` : `<p class="note" style="margin:0">No apply clicks on individual roles yet for this period. Counting per role started 23 Oct 2026.</p>`}</div></section>
<section class="block"><h2>Bots filtered out</h2><div class="panel glass">${bots && bots.total ? `<p class="note" style="margin:0 0 12px"><b>${fmt(bots.total)}</b> bot visits ignored (${esc(period.toLowerCase())}). None of these are in your visitor numbers above.</p>${barList(bots.byKey, (r) => BOT_KINDS[r.k] || "Other bots", bots.total, "bot visits")}` : `<p class="note" style="margin:0">No bot visits recorded for this period yet. Counting started 23 Oct 2026.</p>`}</div></section>
<section class="block"><h2>Unusual activity</h2><div class="panel glass">${flags.length ? `<p class="note" style="margin:0 0 12px">Visitors who did more than 60 things in one minute, which is faster than most people browse. They're still counted. Have a look and judge for yourself.</p><ul class="flaglist">${flags.map((f) => `<li><b>${esc(f.city || "Unknown town")}, ${esc(country(f.cc))}</b><span>${longDate(f.day)} · ${esc(f.first)}${f.last && f.last !== f.first ? "–" + esc(f.last) : ""} UTC · up to ${fmt(f.peak)} actions a minute</span></li>`).join("")}</ul>` : `<p class="note" style="margin:0">Nothing unusual. We flag any visitor doing more than 60 things a minute.</p>`}</div></section>
<section class="block"><h2>Booking requests</h2>${enquiries.length ? `<div class="rlinks">${enquiries.map((q) => { const e = q.data, v = e.vet || {}; return `<div class="rlink glass">
  <b>${esc(e.company)} · ${esc(e.option)}${e.budget ? ` · £${fmt(e.budget)} budget` : ""}</b>
  <span class="meta">${esc(q.ref)} · ${longDate(q.created.slice(0, 10))} · start ${esc(e.start)} · ${esc(e.name)} &lt;<a href="mailto:${esc(e.email)}?subject=${encodeURIComponent("Your GigrAI booking " + q.ref)}">${esc(e.email)}</a>&gt;</span>
  <span class="meta">Role: ${esc(e.role)}${e.pay ? " · " + esc(e.pay) : ""}</span>
  <code>${esc(e.url)}</code>
  <span class="meta" style="color:${v.result === "pass" ? "#9ff0c5" : "#ffe0a3"}">Link check: ${v.result === "pass" ? "passed" : "needs a look: " + esc((v.warns || []).join(" "))}</span>
  ${e.notes ? `<span class="meta">Notes: ${esc(e.notes)}</span>` : ""}
</div>`; }).join("")}</div>` : `<p class="note">No requests yet. They arrive from the form on /advertise.</p>`}</section>
<section class="block"><h2>Advertiser links</h2><div class="rlinks">${sponsorBlocks}</div></section>`;
  return pageOf({ title: "GigrAI numbers (private)", desc: "Private.", canonical: "", body, robots: "noindex,nofollow" });
}

export function reportsOff(origin) {
  return pageOf({ title: "Reports · GigrAI", desc: "Private.", canonical: "", robots: "noindex,nofollow", status: 404,
    body: `<section class="hero sm"><h1>Report not found</h1><p>Check you've got the full link, or <a href="/advertise">contact us</a>.</p></section>` });
}
