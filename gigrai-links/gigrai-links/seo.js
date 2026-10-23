import { menuButton, drawerHtml } from "./nav.js";
// Server-rendered pages for Google:
//   /jobs                 every live role, grouped by platform (crawlable links)
//   /jobs/<id>/<slug>     one role: full text in the HTML + JobPosting data for Google's jobs panel
// Roles that close return 404, so Google drops them.

export const slugify = (t) =>
  String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "") || "role";

export const jobPath = (j) => `/jobs/${encodeURIComponent(j.id)}/${slugify(j.title)}`;

export const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// JSON inside <script>: stop "</script>" breaking out
const ldJson = (o) => JSON.stringify(o).replace(/</g, "\\u003c");

const pay = (j) => {
  const lo = j.min, hi = j.max;
  if (!lo && !hi) return "";
  return lo && hi && lo !== hi ? `$${lo}–${hi}/hr` : `$${lo || hi}/hr`;
};

// "## Heading" / "- bullet" plain text -> safe HTML
function descHtml(txt) {
  const out = [];
  let list = false;
  for (const raw of String(txt || "").split("\n")) {
    const line = raw.trim();
    if (line.startsWith("- ")) {
      if (!list) { out.push("<ul>"); list = true; }
      out.push(`<li>${esc(line.slice(2))}</li>`);
      continue;
    }
    if (list) { out.push("</ul>"); list = false; }
    if (!line) continue;
    if (line.startsWith("## ")) out.push(`<h3>${esc(line.slice(3))}</h3>`);
    else out.push(`<p>${esc(line)}</p>`);
  }
  if (list) out.push("</ul>");
  return out.join("\n");
}

// Countries we list for remote roles that are open to "most countries" (minus any the platform excludes)
const MAIN_MARKETS = ["USA", "GBR", "CAN", "AUS", "IRL", "NZL", "IND", "NGA", "ZAF", "KEN", "PHL", "DEU", "FRA", "ESP", "ITA", "NLD", "PRT", "POL", "BRA", "MEX"];
const ISO3_TO_2 = { USA: "US", GBR: "GB", CAN: "CA", AUS: "AU", IRL: "IE", NZL: "NZ", IND: "IN", NGA: "NG", ZAF: "ZA", KEN: "KE", PHL: "PH", DEU: "DE", FRA: "FR", ESP: "ES", ITA: "IT", NLD: "NL", PRT: "PT", POL: "PL", BRA: "BR", MEX: "MX", SWE: "SE", ARG: "AR", COL: "CO", JPN: "JP", KOR: "KR", SGP: "SG", ARE: "AE", PAK: "PK", EGY: "EG", CHN: "CN", GHA: "GH", UGA: "UG", BEL: "BE", CHE: "CH", AUT: "AT", NOR: "NO", DNK: "DK", FIN: "FI" };

const isoDate = (s) => (/^\d{4}-\d{2}-\d{2}/.test(s || "") ? s.slice(0, 10) : "");

// Google's JobPosting data. Only for roles with a real description (Google requires the full text).
function jobPosting(j, origin, platform) {
  if (!j.desc || j.desc.length < 150) return null;
  const posted = isoDate(j.posted);
  if (!posted) return null;
  let countries = [];
  if (j.known && (j.allow || []).length) countries = j.allow;
  else countries = MAIN_MARKETS.filter((c) => !(j.deny || []).includes(c));
  countries = countries.map((c) => ISO3_TO_2[c] || c).filter((c) => /^[A-Z]{2}$/.test(c));
  if (!countries.length) return null;

  const data = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: j.title,
    description: descHtml(j.desc),
    datePosted: posted,
    employmentType: "CONTRACTOR",
    jobLocationType: "TELECOMMUTE",
    applicantLocationRequirements: countries.map((c) => ({ "@type": "Country", name: c })),
    hiringOrganization: { "@type": "Organization", name: j.via, ...(platform && platform.site ? { sameAs: platform.site } : {}) },
    identifier: { "@type": "PropertyValue", name: j.via, value: j.id },
    directApply: false,
    url: origin + jobPath(j),
  };
  if (j.min || j.max) {
    data.baseSalary = {
      "@type": "MonetaryAmount",
      currency: "USD",
      value: { "@type": "QuantitativeValue", unitText: "HOUR", ...(j.min ? { minValue: j.min } : {}), ...(j.max ? { maxValue: j.max } : {}) },
    };
  }
  return data;
}

// ---------- shared page shell (matches the homepage look) ----------
// ---------- shared page chrome: same header, footer and styles as the homepage ----------
export const WA = "https://whatsapp.com/channel/0029VbDkhLPKgsO0zsOZ080u";
const BELL = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
export const ARROW = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
export const CHECK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

const NAV = [["/", "Find jobs"], ["/jobs", "All roles"], ["/platforms", "Platforms"], ["/guides", "Guides"], ["/news", "News"]];

const CO_NAV = [["/advertise", "Overview"], ["/advertise#options", "Prices"], ["/media-kit", "Media kit"]];
const CHAT = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>';

function header(active, page = "") {
  // Advertiser pages (/advertise, /media-kit) get their own header aimed at companies
  if (active === "/advertise") {
    const cur = page || "/advertise";
    return `<header class="top co"><div class="wrap">
  <a class="brand" href="/advertise"><img src="/icon.png" alt="" width="36" height="36">GigrAI<span class="co-tag">for companies</span></a>
  <nav class="nav" aria-label="For companies">${CO_NAV.map(([h, t]) => `<a href="${h}"${h === cur ? ' aria-current="page"' : ""}>${t}</a>`).join("")}</nav>
  <a class="nav-co" href="/">For job seekers</a>
  <a class="alerts btn-grad" href="${DM_LINK}" target="_blank" rel="noopener" data-track="co-header-dm">${CHAT}Message us</a>
  <a class="icon-btn alerts-icon" href="${DM_LINK}" target="_blank" rel="noopener" aria-label="Message us on Instagram" data-track="co-header-dm">${CHAT.replace(/17/g, "20")}</a>
  ${menuButton()}
</div></header>`;
  }
  return `<header class="top"><div class="wrap">
  <a class="brand" href="/"><img src="/icon.png" alt="" width="36" height="36">GigrAI</a>
  <nav class="nav" aria-label="Main">${NAV.map(([h, t]) => `<a href="${h}"${h === active ? ' aria-current="page"' : ""}>${t}</a>`).join("")}</nav>
  <a class="nav-co" href="/advertise">For companies</a>
  <a class="alerts btn-grad" href="${WA}" target="_blank" rel="noopener" data-track="header-whatsapp">${BELL}Job alerts</a>
  <a class="icon-btn alerts-icon" href="${WA}" target="_blank" rel="noopener" aria-label="Job alerts on WhatsApp" data-track="header-whatsapp">${BELL.replace(/17/g, "20")}</a>
  ${menuButton()}
</div></header>`;
}
const DM_LINK = "https://ig.me/m/gigr.ai";

const FOOTER = `<footer class="foot"><div class="wrap">
  <div class="f-top">
    <div class="f-brand">
      <a class="brand" href="/"><img src="/icon.png" alt="" width="36" height="36">GigrAI</a>
      <p>Every remote AI job. One search.</p>
    </div>
    <div class="f-social">
      <span class="f-label">Connect with us</span>
      <a class="ig" href="https://www.instagram.com/gigr.ai/" target="_blank" rel="noopener" data-track="footer-instagram">
        <span class="ig-ic" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg></span>
        <span class="ig-t"><b>@gigr.ai</b><span>on Instagram</span></span>
      </a>
      <a class="ig" href="https://whatsapp.com/channel/0029VbDkhLPKgsO0zsOZ080u" target="_blank" rel="noopener" data-track="footer-whatsapp">
        <span class="ig-ic wa-c" aria-hidden="true"><svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.5-.3z"/></svg></span>
        <span class="ig-t"><b>GigrAI Jobs</b><span>WhatsApp channel</span></span>
      </a>
    </div>
  </div>
  <div class="f-bottom">
    <span>© __YEAR__ GigrAI · remotegigrai.com</span>
    <span>Some links are referral links. It costs you nothing and doesn't change your pay.</span>
    <span><a href="/jobs">Browse all roles</a> · <a href="/guides">Guides</a> · <a href="/advertise">Advertise</a> · <a href="/media-kit">Media kit</a> · <a href="/privacy">Privacy &amp; cookies</a></span>
  </div>
</div></footer>`;

// The assistant bubble (public/chat.js). worker.js switches it off when CHAT is "off".
let chatOn = true;
export const setChat = (on) => { chatOn = !!on; };

export function shell({ title, desc, canonical, body, ld = [], robots = "index,follow,max-image-preview:large", active = "", page = "", bodyClass = "", image = "" }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="${robots}">
<meta name="theme-color" content="#070914">
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ""}
<meta property="og:type" content="website">
<meta property="og:site_name" content="GigrAI">
<meta property="og:locale" content="en_GB">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image ? (image.startsWith("/") ? "https://remotegigrai.com" + image : image) : "https://remotegigrai.com/og-image-v2.jpg")}">
${canonical ? `<meta property="og:url" content="${esc(canonical)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png">
<link rel="icon" type="image/png" sizes="96x96" href="/favicon-96.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/site.css?v=5">
${ld.filter(Boolean).map((o) => `<script type="application/ld+json">${ldJson(o)}</script>`).join("\n")}
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ""}>
${header(active, page)}
<main id="main"><div class="wrap">
${body}
</div></main>
${FOOTER.replace("__YEAR__", String(new Date().getFullYear()))}
${drawerHtml()}
${chatOn && !/noindex/.test(robots) ? '<script src="/chat.js?v=6" defer></script>' : ""}
</body>
</html>`;
}

// Browsers re-check pages every visit, so design updates show straight away (the pages are small)
export const html = (body, status = 200) =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=0, must-revalidate" } });

export const crumbs = (items) => `<nav class="crumbs" aria-label="Breadcrumb">${items.map(([h, t], i) =>
  (i ? '<span aria-hidden="true">›</span>' : "") + (h ? `<a href="${h}">${esc(t)}</a>` : `<span aria-current="page">${esc(t)}</span>`)).join("")}</nav>`;

// Platform logo, same as the homepage cards
function avatar(platforms, id, name) {
  const p = (platforms || []).find((x) => x.id === id) || {};
  if (p.icon) return `<span class="av" aria-hidden="true" style="background:#fff"><img src="/${esc(p.icon)}" alt="" width="50" height="50"></span>`;
  if (p.logo && p.logoShape === "square") return `<span class="av" aria-hidden="true"><img src="/${esc(p.logo)}" alt="" width="50" height="50"></span>`;
  return `<span class="av" aria-hidden="true" style="background:var(--grad);color:#fff">${esc(String(name || "?").slice(0, 2))}</span>`;
}

const payHtml = (j) => {
  if (!j.min && !j.max) return "";
  const v = j.min && j.max && j.min !== j.max ? `$${j.min}–${j.max}` : `$${j.min || j.max}`;
  return `${v}<small>/hr</small>`;
};

function roleCard(x, platforms) {
  return `<a class="card" href="${jobPath(x)}">
  <div class="c-top">${avatar(platforms, x.platform, x.via)}<div class="c-title"><span class="c-name">${esc(x.title)}</span><span class="meta">via ${esc(x.via)}</span></div></div>
  ${payHtml(x) ? `<div class="pay">${payHtml(x)}</div>` : ""}
  ${x.domain ? `<div class="tags"><span class="tag">${esc(x.domain)}</span><span class="tag">Remote</span></div>` : `<div class="tags"><span class="tag">Remote</span></div>`}
</a>`;
}

// ---------- /jobs/<id>/<slug> ----------
export function rolePage(j, feed, origin, platforms) {
  const p = pay(j);
  const platform = (platforms || []).find((x) => x.id === j.platform);
  const canonical = origin + jobPath(j);
  const applyHref = `/go/${encodeURIComponent(j.id)}?src=seo`;
  const tags = ['<span class="tag new">Remote</span>', j.kind && `<span class="tag">${esc(j.kind)}</span>`, j.domain && `<span class="tag">${esc(j.domain)}</span>`,
    ...(j.skills || []).slice(0, 5).map((s) => `<span class="tag">${esc(s)}</span>`)].filter(Boolean).join("");

  const about = j.desc && j.desc.length >= 150
    ? descHtml(j.desc)
    : `<p>${esc(j.title)} is a remote role listed on ${esc(j.via)}${p ? `, paying ${esc(p)}` : ""}. ${j.skills && j.skills.length ? `Skills: ${esc(j.skills.join(", "))}. ` : ""}The full description, requirements and screening steps are on ${esc(j.via)}'s own listing.</p>
<p>Applying is free. You apply on ${esc(j.via)}'s site, and if you're accepted you're paid by ${esc(j.via)} directly.</p>`;

  const similar = feed.filter((x) => x.id !== j.id && ((j.domain && x.domain === j.domain) || x.platform === j.platform))
    .sort((a, b) => (b.posted || "").localeCompare(a.posted || "")).slice(0, 6);

  const facts = [["Pay", p || "See listing"], ["Where", "Remote"], ["Platform", j.via], j.hours && ["Hours", `${j.hours} hrs/wk`], isoDate(j.posted) && ["Posted", isoDate(j.posted)]].filter(Boolean);

  const body = `${crumbs([["/", "GigrAI"], ["/jobs", "All roles"], ["", j.via]])}
<div class="role">
  <div>
    <div class="role-head">
      <div class="c-top">${avatar(platforms, j.platform, j.via)}<span class="meta">via <b style="color:var(--text)">${esc(j.via)}</b></span></div>
      <h1>${esc(j.title)}</h1>
      ${payHtml(j) ? `<div class="pay">${payHtml(j)}</div>` : ""}
      <div class="tags">${tags}</div>
    </div>
    <section class="panel desc prose" aria-labelledby="ab"><h2 id="ab">About this role</h2>${about}</section>
  </div>
  <aside class="apply-card" aria-label="Apply">
    ${payHtml(j) ? `<div class="pay">${payHtml(j)}</div>` : `<b style="font-size:18px">Apply on ${esc(j.via)}</b>`}
    <dl>${facts.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
    <a class="btn btn-grad" href="${applyHref}" rel="nofollow sponsored" target="_blank">Apply free on ${esc(j.via)} ${ARROW}</a>
    <p class="fine">You'll apply on ${esc(j.via)}'s own site. Referral link: it costs you nothing and doesn't change your pay.</p>
  </aside>
</div>
${similar.length ? `<section class="block" aria-labelledby="sim"><h2 id="sim">Similar remote roles</h2><p class="lead">More live roles like this one.</p><div class="cards">${similar.map((x) => roleCard(x, platforms)).join("")}</div></section>` : ""}
<div class="mbar">${payHtml(j) ? `<div class="pay">${payHtml(j)}</div>` : ""}<a class="btn btn-grad" href="${applyHref}" rel="nofollow sponsored" target="_blank">Apply free ${ARROW}</a></div>`;

  const desc = `${p ? p + " · " : ""}Remote ${j.title} role via ${j.via}. See the details and apply free on GigrAI.`.slice(0, 160);
  return html(shell({
    title: `${j.title}${p ? ` (${p})` : ""}: remote via ${j.via} · GigrAI`,
    desc, canonical, body, active: "/jobs", bodyClass: "has-mbar",
    ld: [jobPosting(j, origin, platform), {
      "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "GigrAI", item: origin + "/" },
        { "@type": "ListItem", position: 2, name: "All roles", item: origin + "/jobs" },
        { "@type": "ListItem", position: 3, name: j.title, item: canonical },
      ],
    }],
  }));
}

// ---------- /jobs ----------
export function jobsIndex(feed, origin, platforms, featured = []) {
  const groups = (platforms || []).map((p) => ({ p, jobs: feed.filter((j) => j.platform === p.id).sort((a, b) => (b.posted || "").localeCompare(a.posted || "")) }))
    .filter((g) => g.jobs.length);
  const body = `${crumbs([["/", "GigrAI"], ["", "All roles"]])}
<section class="hero sm">
  <span class="eyebrow"><i></i>Updated every 30 minutes</span>
  <h1>All <span class="grad-text">${feed.length} live</span> remote AI jobs</h1>
  <p>Every live role training and testing AI, from ${groups.map((g) => esc(g.p.name)).join(" and ")}. Free to apply on the platform's own site. Want filters? <a href="/">Search and filter roles</a>.</p>
  <div class="jump">${groups.map((g) => `<a href="#${esc(g.p.id)}">${esc(g.p.name)} <b>${g.jobs.length}</b></a>`).join("")}</div>
</section>
${featuredHtml(featured)}
${groups.map((g) => `<section class="block" id="${esc(g.p.id)}" aria-labelledby="h-${esc(g.p.id)}"><h2 id="h-${esc(g.p.id)}">${esc(g.p.name)} roles</h2><p class="lead">${g.jobs.length} live, newest first.</p><div class="cards">${g.jobs.map((x) => roleCard(x, platforms)).join("")}</div></section>`).join("\n")}`;
  return html(shell({
    title: `All ${feed.length} live remote AI jobs · GigrAI`,
    desc: `Browse ${feed.length} live remote AI jobs from ${groups.map((g) => g.p.name).join(", ")}, with real pay rates. Free to apply.`,
    canonical: origin + "/jobs", body, active: "/jobs",
  }), 200, 900);
}

// ---------- closed role ----------
export function roleGone(origin) {
  return html(shell({
    title: "This role has closed · GigrAI",
    desc: "This remote AI role has closed. Search live roles on GigrAI.",
    canonical: "", robots: "noindex", active: "/jobs",
    body: `<section class="hero sm"><span class="eyebrow"><i></i>Role closed</span><h1>This role has <span class="grad-text">closed</span></h1><p>It's no longer taking applications, but there are plenty of live roles.</p><div class="jump"><a class="btn btn-grad" href="/" style="color:#fff">Search live roles ${ARROW}</a><a class="ghost" href="/jobs">Browse all roles</a></div></section>`,
  }), 404, 300);
}

// ---------- /guides and /guides/<slug> ----------
const longDate = (d) => new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function guideCard(g) {
  return `<a class="card" href="/guides/${g.slug}"><span class="tag new" style="align-self:flex-start">Guide</span><span class="c-name">${esc(g.title)}</span><p class="c-desc">${esc(g.desc)}</p><span class="go">Read the guide →</span></a>`;
}

export function guidePage(g, guides, origin) {
  const canonical = `${origin}/guides/${g.slug}`;
  const more = guides.filter((x) => x.slug !== g.slug);
  const body = `${crumbs([["/", "GigrAI"], ["/guides", "Guides"], ["", g.title]])}
<article class="read">
  <header class="hero sm">
    <span class="eyebrow"><i></i>Guide · Updated ${longDate(g.updated)}</span>
    <h1>${esc(g.title)}</h1>
    <p class="fine">GigrAI earns a referral fee if you join a platform through our links. It costs you nothing and doesn't change your pay.</p>
  </header>
  <div class="prose">${g.body}</div>
  <div class="cta-panel"><h2>Find your next remote AI role</h2><p>Search live roles from every platform in one place, with real pay rates.</p><a class="btn btn-grad" href="/">Search GigrAI ${ARROW}</a></div>
</article>
${more.length ? `<section class="block" aria-labelledby="mg"><h2 id="mg">More guides</h2><p class="lead">Plain-English guides to getting paid for AI work.</p><div class="cards">${more.map(guideCard).join("")}</div></section>` : ""}`;
  return html(shell({
    title: `${g.title} · GigrAI`, desc: g.desc, canonical, body, active: "/guides",
    ld: [{
      "@context": "https://schema.org", "@type": "Article", headline: g.title, description: g.desc,
      datePublished: g.updated, dateModified: g.updated, mainEntityOfPage: canonical,
      image: "https://remotegigrai.com/og-image-v2.jpg",
      author: { "@type": "Organization", name: "GigrAI", url: origin + "/" },
      publisher: { "@type": "Organization", name: "GigrAI", logo: { "@type": "ImageObject", url: origin + "/favicon-512.png", width: 512, height: 512 } },
    }, {
      "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "GigrAI", item: origin + "/" },
        { "@type": "ListItem", position: 2, name: "Guides", item: origin + "/guides" },
        { "@type": "ListItem", position: 3, name: g.title, item: canonical },
      ],
    }],
  }), 200, 3600);
}

export function guidesIndex(guides, origin) {
  const body = `${crumbs([["/", "GigrAI"], ["", "Guides"]])}
<section class="hero sm">
  <span class="eyebrow"><i></i>${guides.length} guides</span>
  <h1>Guides to <span class="grad-text">remote AI work</span></h1>
  <p>Honest, plain-English guides to getting paid for AI training work: which platforms are legit, how the AI interviews work and how to avoid scams.</p>
</section>
<div class="cards">${guides.map(guideCard).join("")}</div>
<section class="block" aria-labelledby="tools"><h2 id="tools">Tools and answers</h2>
<div class="cards">
  <a class="panel glass" href="/#earnings" style="text-decoration:none;color:inherit"><h3>Earnings calculator</h3><p>See what an hourly rate adds up to per week and month.</p></a>
  <a class="panel glass" href="/#faq" style="text-decoration:none;color:inherit"><h3>FAQ</h3><p>Quick answers: is it free, who can apply, how you get paid.</p></a>
</div></section>`;
  return html(shell({ title: "Guides to remote AI work · GigrAI", desc: "Honest guides to remote AI training work: is micro1 legit, how AI interviews work, micro1 vs Mercor and avoiding scams.", canonical: origin + "/guides", body, active: "/guides" }), 200, 3600);
}

// ---------- /platforms ----------
export function platformsPage(feed, origin, platforms, guides = []) {
  const live = (platforms || []).filter((p) => p.active && p.signupUrl);
  const soon = (platforms || []).filter((p) => !p.active);
  // Typical pay: the middle half of hourly rates (ignores one-off highs and lows)
  const pct = (arr, q) => arr[Math.min(arr.length - 1, Math.max(0, Math.round(q * (arr.length - 1))))];
  const stat = (p) => {
    const jobs = feed.filter((j) => j.platform === p.id);
    const rates = jobs.map((j) => (j.min && j.max ? (j.min + j.max) / 2 : j.min || j.max)).filter((v) => v > 0 && v <= 1000).sort((a, b) => a - b);
    let pay = "";
    if (rates.length >= 3) {
      const lo = Math.round(pct(rates, 0.25)), hi = Math.round(pct(rates, 0.75));
      pay = lo === hi ? `$${lo}` : `$${lo}–${hi}`;
    } else if (rates.length) pay = `$${Math.round(rates[0])}`;
    return { n: jobs.length, pay, feed: !!p.feed };
  };
  const BOOK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5V5a2 2 0 0 1 2-2h13v16H6.5A2.5 2.5 0 0 0 4 21.5v-2z"/></svg>';
  const card = (p) => {
    const st = stat(p);
    const g = guides.filter((x) => x.slug.includes(p.id)).slice(0, 2);
    const stats = st.n
      ? `<div class="pl-stats"><div><b>${st.n}</b><span>live roles</span></div><div><b>${esc(st.pay || "Varies")}</b><span>${st.pay ? "typical pay per hour" : "pay"}</span></div></div>`
      : `<div class="pl-stats one"><div><b>Free</b><span>to join</span></div><div><span class="pl-note">Open projects are listed on ${esc(p.name)} itself</span></div></div>`;
    return `<article class="pl glass" id="${esc(p.id)}">
  <div class="pl-h">${avatar(platforms, p.id, p.name)}<div><h2>${esc(p.name)}</h2><p>${esc(p.tagline || "")}</p></div></div>
  ${stats}
  <ul class="pl-g">${g.map((x) => `<li><a href="/guides/${esc(x.slug)}">${BOOK}<span>${esc(x.title)}</span></a></li>`).join("")}</ul>
  <div class="pl-a"><a class="btn btn-grad" href="/join/${esc(p.id)}?src=platforms" target="_blank" rel="sponsored noopener">Sign up free ${ARROW}</a>${st.n ? `<a class="pl-sec" href="/jobs#${esc(p.id)}">View roles</a>` : ""}</div>
</article>`;
  };
  const body = `<style>
.pls{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:16px}
.pl{display:flex;flex-direction:column;gap:18px;padding:24px;border-radius:var(--r-lg)}
.pl-h{display:flex;gap:14px;align-items:center}.pl-h h2{margin:0;font-size:22px;font-weight:800;letter-spacing:-.01em}.pl-h p{margin:2px 0 0;color:var(--muted);font-size:14.5px}
.pl-stats{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--line);border-radius:16px;overflow:hidden}
.pl-stats > div{padding:14px 16px;display:flex;flex-direction:column;gap:2px;min-height:78px;justify-content:center}
.pl-stats > div + div{border-left:1px solid var(--line)}
.pl-stats b{font-size:22px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.pl-stats span{color:var(--muted);font-size:13px}
.pl-stats .pl-note{font-size:13.5px;color:var(--soft);line-height:1.45}
.pl-g{list-style:none;margin:0;padding:0;display:grid;gap:6px;min-height:60px;align-content:start}
.pl,.pl-g,.pl-g li{min-width:0}
.pl-g a{display:flex;gap:8px;align-items:flex-start;color:#9fdcf0;font-size:14px;font-weight:600;line-height:1.4;text-decoration:none}
.pl-g a:hover span{text-decoration:underline}
.pl-g svg{flex:0 0 16px;color:var(--muted);margin-top:2px}
.pl-a{margin-top:auto;display:grid;grid-template-columns:1fr auto;gap:10px}
.pl-a .btn{height:50px;padding:0 20px;color:#fff;font-size:15px}
.pl-a .btn:only-child{grid-column:1 / -1}
.pl-sec{display:inline-flex;align-items:center;justify-content:center;height:50px;padding:0 20px;border-radius:999px;border:1px solid var(--line);background:var(--glass);color:var(--soft);font-weight:600;font-size:15px;text-decoration:none;white-space:nowrap}.pl-sec:hover{color:var(--text)}
.soon{display:flex;flex-wrap:wrap;gap:10px}.soon span{padding:10px 16px;border-radius:999px;background:rgba(255,255,255,.04);border:1px dashed var(--line);color:var(--muted);font-weight:600}
</style>
${crumbs([["/", "GigrAI"], ["", "Platforms"]])}
<section class="hero sm">
  <span class="eyebrow"><i></i>${live.length} platforms</span>
  <h1>AI training <span class="grad-text">platforms</span></h1>
  <p>Join once and get matched to new roles as they open. Every platform here is free to join and pays you, never the other way round.</p>
</section>
<div class="pls">${[...live].sort((a, b) => stat(b).n - stat(a).n).map(card).join("\n")}</div>
${soon.length ? `<section class="block" aria-labelledby="soon"><h2 id="soon">Coming soon</h2><div class="soon">${soon.map((p) => `<span>${esc(p.name)}</span>`).join("")}</div></section>` : ""}
<p style="margin-top:28px;color:var(--muted);font-size:14px">Typical pay is the middle range of hourly rates across a platform's live roles. Some sign-up links are referral links. It costs you nothing and doesn't change your pay.</p>`;
  return html(shell({
    title: "AI training platforms: micro1, Mercor and more · GigrAI",
    desc: `Remote AI training platforms that pay you: ${live.map((p) => p.name).join(", ")}. Live role counts, typical pay and free sign-up links.`,
    canonical: origin + "/platforms", body, active: "/platforms",
  }));
}

// ---------- Featured (paid) roles from sponsored.json ----------
const validSponsor = (f) => f && /^[a-z0-9-]{1,40}$/.test(f.id || "") && /^https:\/\//.test(f.url || "");

// Every advertiser with a working link (kept for 60 days after the campaign so old posts still work)
export function allSponsors(cfg) {
  const cutoff = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
  return ((cfg && cfg.featured) || []).filter((f) => validSponsor(f) && (f.until || "") >= cutoff);
}

// Pay-per-click advertisers: { cpc: 1.5, budget: 100 } in sponsored.json -> click cap
export const clickCap = (f) => (f && +f.cpc > 0 && +f.budget > 0 ? Math.floor(+f.budget / +f.cpc) : 0);

// Advertisers pinned on the site right now
export function liveFeatured(cfg) {
  const today = new Date().toISOString().slice(0, 10);
  return ((cfg && cfg.featured) || []).filter((f) =>
    validSponsor(f) && f.title && f.pin !== false && (f.start || "") <= today && (f.until || "") >= today);
}

export function featuredHtml(list) {
  if (!list.length) return "";
  return `<style>.gf{display:flex;flex-direction:column;gap:10px;margin:18px 0 6px}.gf a{display:flex;flex-direction:column;gap:4px;padding:16px 18px;border-radius:18px;text-decoration:none;color:#f2f4ff;background:linear-gradient(160deg,rgba(47,107,255,.24),rgba(139,61,255,.12) 60%,rgba(255,255,255,.04));border:1px solid rgba(139,61,255,.45)}.gf .gl{font-size:12px;font-weight:700;color:#b8bfdc;text-transform:uppercase;letter-spacing:.06em}.gf .gt{font-weight:700;font-size:17px}.gf .gm{font-size:14px;color:#e2e6f8}</style>
<div class="gf" aria-label="Featured roles">${list.map((f) => `<a href="/go/sponsored-${esc(f.id)}?src=featured" target="_blank" rel="sponsored noopener"><span class="gl">Sponsored · Featured role</span><span class="gt">${esc(f.title)}</span><span class="gm">${[f.company && "via " + f.company, f.pay, f.blurb].filter(Boolean).map(esc).join(" · ")}</span></a>`).join("")}</div>`;
}

// ---------- booking form (on /advertise) ----------
export function bookingForm(email = "") {
  const opts = AD_OPTIONS.map((o) => `<option value="${esc(o.name)}">${esc(o.name)}: ${esc(o.price)}${o.per ? " " + esc(o.per) : ""}</option>`).join("");
  const today = new Date().toISOString().slice(0, 10);
  return `<section class="block" id="book" aria-labelledby="bk"><h2 id="bk">Book your spot</h2>
<p class="lead">Tell us about your role and we'll confirm your dates and send a payment link within one working day. No payment is taken now.</p>
<form class="bform glass" id="bform" novalidate>
<style>
.bform{padding:24px;border-radius:var(--r-lg);display:grid;gap:16px}
.bform .row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.bform label{display:grid;gap:6px;font-size:13.5px;font-weight:700;color:var(--soft);min-width:0}
.bform label small{font-weight:500;color:var(--muted)}
.bform input,.bform select,.bform textarea{width:100%;height:50px;border-radius:14px;border:1px solid var(--line);background:#0d1024;color:var(--text);font:inherit;font-size:15.5px;padding:0 14px}
.bform input[type=date]{-webkit-appearance:none;appearance:none;display:block;min-width:0;max-width:100%;text-align:left;line-height:50px;color-scheme:dark}
.bform input[type=date]::-webkit-date-and-time-value{text-align:left}
.bform textarea{height:auto;min-height:96px;padding:12px 14px;resize:vertical}
.bform input:focus-visible,.bform select:focus-visible,.bform textarea:focus-visible{outline:3px solid #22d3ee;outline-offset:1px}
.bform .agree{display:flex;gap:12px;align-items:flex-start;font-weight:500;color:var(--soft);font-size:14px;line-height:1.5;cursor:pointer}
.bform .agree input{-webkit-appearance:none;appearance:none;width:24px;height:24px;margin:1px 0 0;padding:0;flex:0 0 24px;border-radius:7px;border:2px solid rgba(255,255,255,.35);background:#0d1024;display:grid;place-items:center;cursor:pointer}
.bform .agree input:checked{background:#5b8cff;border-color:#5b8cff}
.bform .agree input:checked::after{content:"";width:6px;height:11px;border:solid #fff;border-width:0 2.5px 2.5px 0;transform:translateY(-1px) rotate(45deg)}
.bform .ppc{display:none}.bform.is-ppc .ppc{display:grid}
.bform button{height:56px;border:0;border-radius:999px;background:linear-gradient(110deg,#22d3ee,#2f6bff 55%,#8b3dff);color:#fff;font:inherit;font-size:16px;font-weight:800;cursor:pointer}
.bform button[disabled]{opacity:.6;cursor:wait}
.bform .msg{margin:0;min-height:20px;font-size:14.5px}.bform .msg.err{color:#ffb3b3}
.bform .hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
.bdone{padding:28px;border-radius:var(--r-lg);text-align:center;display:grid;gap:10px}.bdone b{font-size:22px}
@media (max-width:640px){.bform .row{grid-template-columns:1fr}.bform{padding:18px}}
</style>
<div class="row">
  <label>Company<input name="company" required maxlength="100" autocomplete="organization"></label>
  <label>Your name<input name="name" required maxlength="80" autocomplete="name"></label>
</div>
<div class="row">
  <label>Work email<input name="email" type="email" required maxlength="200" autocomplete="email"></label>
  <label>Company website<input name="website_url" type="url" maxlength="300" placeholder="https://"></label>
</div>
<div class="row">
  <label>Role title<input name="role" required maxlength="120" placeholder="e.g. AI Trainer (Maths)"></label>
  <label>Application link <small>where applicants should go</small><input name="url" type="url" required maxlength="500" placeholder="https://"></label>
</div>
<div class="row">
  <label>Pay <small>optional, e.g. $40–60/hr</small><input name="pay" maxlength="60"></label>
  <label>Option<select name="option" required>${opts}</select></label>
</div>
<div class="row">
  <label>Start date<input name="start" type="date" required min="${today}"></label>
  <label class="ppc">Budget (£) <small>pay per click, minimum £100</small><input name="budget" type="number" min="100" step="10" placeholder="100"></label>
</div>
<label>Anything else? <small>optional: who you're looking for, countries, deadlines</small><textarea name="notes" maxlength="1500"></textarea></label>
<div class="hp" aria-hidden="true"><label>Leave empty<input name="website" tabindex="-1" autocomplete="off"></label></div>
<label class="agree"><input type="checkbox" name="agree" required><span>The role is real and <b>free to apply for</b>, and I'm happy for it to be labelled Sponsored. I understand GigrAI may decline roles that aren't a good fit.</span></label>
<button type="submit">Send booking request</button>
<p class="msg" aria-live="polite"></p>
<p class="note" style="margin:0;font-size:13px">Prefer to talk first? ${email ? `Email <a href="mailto:${esc(email)}">${esc(email)}</a> or ` : ""}message <a href="${DM}" target="_blank" rel="noopener">@gigr.ai</a> on Instagram.</p>
</form>
<script>
(function(){
  var f = document.getElementById("bform"); if (!f) return;
  var sel = f.option, ppc = function(){ f.classList.toggle("is-ppc", /per click/i.test(sel.value)); };
  sel.addEventListener("change", ppc); ppc();
  // pre-select an option from a link like /advertise?option=Pay%20per%20click#book
  try { var o = new URLSearchParams(location.search).get("option"); if (o) { sel.value = o; ppc(); } } catch (_) {}
  f.addEventListener("submit", async function(e){
    e.preventDefault();
    var msg = f.querySelector(".msg"), btn = f.querySelector("button[type=submit]");
    msg.className = "msg"; msg.textContent = "";
    var bad = [].slice.call(f.querySelectorAll("[required]")).find(function(x){ return x.type === "checkbox" ? !x.checked : !x.value.trim() || !x.checkValidity(); });
    if (bad) { msg.className = "msg err"; msg.textContent = bad.type === "checkbox" ? "Please tick the box to confirm the role meets our standards." : "Please check: " + (bad.closest("label").firstChild.textContent.trim()) + "."; bad.focus(); return; }
    if (f.classList.contains("is-ppc") && !(+f.budget.value >= 100)) { msg.className = "msg err"; msg.textContent = "Pay per click starts from a £100 budget."; f.budget.focus(); return; }
    btn.disabled = true; btn.textContent = "Sending…";
    var data = {}; new FormData(f).forEach(function(v, k){ data[k] = v; }); data.agree = f.agree.checked;
    try {
      var r = await fetch("/api/enquiry", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
      var d = await r.json();
      if (!d.ok) throw new Error(d.error || "Something went wrong. Please try again.");
      f.outerHTML = '<div class="bdone glass" role="status"><b>Thanks, request received ✅</b><p style="margin:0;color:var(--muted)">We\\'ll reply to your email within one working day to confirm dates and send a payment link. Your reference: <b>' + d.ref + '</b></p></div>';
    } catch (err) { msg.className = "msg err"; msg.textContent = err.message; btn.disabled = false; btn.textContent = "Send booking request"; }
  });
})();
</script>
</section>`;
}

// ---------- /advertise ----------
// Advertising options: shared by /advertise and /media-kit
export const AD_OPTIONS = [
  { name: "Featured role", price: "£49", per: "/ week", text: "Your role pinned at the top of the GigrAI homepage and All roles page, labelled Sponsored, linking straight to your application page." },
  { name: "Featured role, monthly", price: "£149", per: "/ month", text: "The same pinned, Sponsored listing for a full month. Best for ongoing hiring. Save about £47 against weekly." },
  { name: "Pay per click", price: "£1.50", per: "/ click", text: "Only pay for people who click through to your application page, counted once per person per day. Prepay from £100, follow every click in a live report, and it stops automatically when your budget is used." },
  { name: "Sponsored Instagram post", price: "£99", per: "", text: "A carousel about your role in the GigrAI style on @gigr.ai, shared to our Story. Labelled as an ad." },
  { name: "WhatsApp shout-out", price: "£49", per: "", text: "One post about your role, with your link, to the GigrAI Jobs WhatsApp channel." },
  { name: "Launch bundle", price: "£179", per: "", text: "All three: a week as a Featured role, a sponsored Instagram post and a WhatsApp shout-out. Save £18.", feat: true },
];
export const adOption = (o) => `<div class="panel glass opt${o.feat ? " feat" : ""}">${o.feat ? '<span class="badge">Best value</span>' : ""}<h3>${o.name}</h3><div class="price">${o.price}${o.per ? ` <small>${o.per}</small>` : ""}</div><p>${o.text}</p></div>`;
export const DM = "https://ig.me/m/gigr.ai";
const MAIL = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>';
export const mailLink = (email, label) => email ? `<a class="ghost" href="mailto:${esc(email)}?subject=${encodeURIComponent("Advertising on GigrAI")}">${MAIL}${esc(label || email)}</a>` : "";

// ---------- /advertise ----------
export function advertisePage(origin, liveRoles, platformCount, email = "") {
  const dm = DM;
  const body = `${crumbs([["/", "GigrAI"], ["", "Advertise"]])}
<section class="hero sm">
  <span class="eyebrow"><i></i>For AI companies and platforms</span>
  <h1>Advertise with <span class="grad-text">GigrAI</span></h1>
  <p>GigrAI is a free search engine for remote AI jobs. Everyone who visits is actively looking for AI training work, so your roles reach the right people at the moment they're ready to apply.</p>
  <div class="jump"><a class="btn btn-grad" href="#book" style="color:#fff">Book your spot ${ARROW}</a><a class="ghost" href="#options">See prices</a><a class="ghost" href="/media-kit">Media kit</a></div>
</section>

<section class="block" aria-labelledby="who"><h2 id="who">Who you'll reach</h2><p class="lead">See our latest follower, visitor and click numbers in the <a href="/media-kit">media kit</a>.</p>
<div class="cards">
  <div class="panel glass"><h3>Ready to apply</h3><p>People searching for paid remote AI work, worldwide, at the moment they're choosing where to apply.</p></div>
  <div class="panel glass"><h3>Three channels</h3><p>remotegigrai.com, <a href="https://www.instagram.com/gigr.ai/" rel="noopener">@gigr.ai on Instagram</a> and the <a href="${WA}" rel="noopener">GigrAI Jobs WhatsApp channel</a>.</p></div>
  <div class="panel glass"><h3>${liveRoles ? liveRoles + " live roles" : "Hundreds of live roles"}</h3><p>${platformCount ? `From ${platformCount} platforms and refreshed` : "Refreshed"} every 30 minutes, so people come back often.</p></div>
</div></section>

<section class="block" id="options" aria-labelledby="op"><h2 id="op">Options and launch prices</h2><p class="lead">Prices in GBP. Launch prices may change.</p>
<div class="cards" style="grid-template-columns:repeat(auto-fit,minmax(230px,1fr))">
${AD_OPTIONS.map(adOption).join("\n")}
</div></section>

<section class="block" aria-labelledby="hw"><h2 id="hw">How it works</h2><p class="lead">Live within days. We handle the copy and design.</p>
<ol class="steps">
  <li class="glass"><b>Book below</b><span>Tell us about your role and pick an option. It takes two minutes.</span></li>
  <li class="glass"><b>We confirm</b><span>Your dates, and send you a payment link.</span></li>
  <li class="glass"><b>You go live</b><span>On the agreed date. We write and design the posts.</span></li>
  <li class="glass"><b>Track your results</b><span>With a private live report showing every click to your application page, by day, channel and country.</span></li>
</ol></section>

<section class="block" aria-labelledby="st"><h2 id="st">Our standards</h2><p class="lead">So job seekers keep trusting what they see here.</p>
<ul class="checks">
  <li class="glass">${CHECK}<span>We only feature real roles that are <b>free to apply for</b>. We never promote anything that charges applicants.</span></li>
  <li class="glass">${CHECK}<span>Everything paid is clearly labelled as Sponsored or Ad.</span></li>
  <li class="glass">${CHECK}<span>We may decline roles that aren't a good fit for our audience.</span></li>
</ul></section>

${bookingForm(email)}`;
  return html(shell({
    title: "Advertise with GigrAI: reach people looking for remote AI work",
    desc: "Put your AI training roles in front of people actively looking for remote AI work. Featured roles from £49 a week, sponsored Instagram posts and WhatsApp shout-outs.",
    canonical: origin + "/advertise", body, active: "/advertise",
  }), 200, 3600);
}
