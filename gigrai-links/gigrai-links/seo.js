// Server-rendered pages for Google:
//   /jobs                 every live role, grouped by platform (crawlable links)
//   /jobs/<id>/<slug>     one role: full text in the HTML + JobPosting data for Google's jobs panel
// Roles that close return 404, so Google drops them.

export const slugify = (t) =>
  String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "") || "role";

export const jobPath = (j) => `/jobs/${encodeURIComponent(j.id)}/${slugify(j.title)}`;

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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
function shell({ title, desc, canonical, body, ld = [], robots = "index,follow,max-image-preview:large" }) {
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
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="https://remotegigrai.com/og-image-v2.jpg">
${canonical ? `<meta property="og:url" content="${esc(canonical)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
${ld.filter(Boolean).map((o) => `<script type="application/ld+json">${ldJson(o)}</script>`).join("\n")}
<style>
:root{--bg:#070914;--line:rgba(255,255,255,.12);--text:#f2f4ff;--soft:#e2e6f8;--muted:#b8bfdc;--link:#7dd8f0;--grad:linear-gradient(90deg,#22D3EE,#2F6BFF,#8B3DFF)}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--soft);font:16px/1.6 "Plus Jakarta Sans",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
body:before{content:"";position:fixed;inset:-20% -10% auto;height:520px;background:radial-gradient(closest-side,rgba(47,107,255,.25),transparent),radial-gradient(closest-side at 80% 30%,rgba(139,61,255,.2),transparent);pointer-events:none;z-index:-1}
a{color:var(--link)}
.wrap{max-width:780px;margin:0 auto;padding:0 16px}
header.top{padding:18px 0}
.brand{display:inline-flex;align-items:center;gap:10px;color:var(--text);font-weight:800;font-size:19px;text-decoration:none}
.brand img{border-radius:10px}
.crumbs{font-size:14px;color:var(--muted);margin:8px 0 18px}
.crumbs a{color:var(--muted)}
h1{color:var(--text);font-size:clamp(26px,5vw,36px);line-height:1.2;margin:0 0 12px;letter-spacing:-.02em}
h2{color:var(--text);font-size:21px;margin:34px 0 12px}
h3{color:var(--text);font-size:16px;margin:18px 0 4px}
.meta{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 22px}
.pill{padding:6px 12px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid var(--line);font-size:14px;color:var(--soft)}
.pill.pay{background:var(--grad);color:#fff;border:0;font-weight:700}
.card{padding:20px;border-radius:20px;background:rgba(255,255,255,.04);border:1px solid var(--line)}
.card p{margin:0 0 10px}.card ul{margin:0 0 10px;padding-left:20px}
.apply{display:inline-block;margin:22px 0 6px;padding:14px 26px;border-radius:14px;background:var(--grad);color:#fff;font-weight:700;text-decoration:none}
.note{font-size:13px;color:var(--muted)}
.list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px}
.list a{display:flex;justify-content:space-between;gap:12px;padding:12px 16px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid var(--line);color:var(--text);text-decoration:none}
.list a:hover{border-color:rgba(255,255,255,.25)}
.list .p{color:var(--muted);white-space:nowrap;font-size:14px}
footer{margin:56px 0 0;border-top:1px solid rgba(255,255,255,.08);padding:24px 0 40px;font-size:13px;color:var(--muted);display:flex;flex-direction:column;gap:6px}
footer a{color:var(--muted)}
</style>
</head>
<body>
<div class="wrap">
<header class="top"><a class="brand" href="/"><img src="/icon.png" alt="" width="34" height="34">GigrAI</a></header>
<main>
${body}
</main>
<footer>
<span>© ${new Date().getFullYear()} GigrAI · remotegigrai.com · <a href="/">Search roles</a> · <a href="/jobs">All roles</a> · <a href="/privacy">Privacy &amp; cookies</a></span>
<span>Some links are referral links. It costs you nothing and doesn't change your pay.</span>
</footer>
</div>
</body>
</html>`;
}

const html = (body, status = 200, maxAge = 600) =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": `public, max-age=${maxAge}` } });

// ---------- /jobs/<id>/<slug> ----------
export function rolePage(j, feed, origin, platforms) {
  const p = pay(j);
  const platform = (platforms || []).find((x) => x.id === j.platform);
  const canonical = origin + jobPath(j);
  const tags = [p && `<span class="pill pay">${esc(p)}</span>`, `<span class="pill">Remote</span>`, `<span class="pill">via ${esc(j.via)}</span>`,
    j.kind && `<span class="pill">${esc(j.kind)}</span>`, j.domain && `<span class="pill">${esc(j.domain)}</span>`,
    ...(j.skills || []).slice(0, 5).map((s) => `<span class="pill">${esc(s)}</span>`)].filter(Boolean).join("");

  const about = j.desc && j.desc.length >= 150
    ? descHtml(j.desc)
    : `<p>${esc(j.title)} is a remote role listed on ${esc(j.via)}${p ? `, paying ${esc(p)}` : ""}. ${j.skills && j.skills.length ? `Skills: ${esc(j.skills.join(", "))}. ` : ""}The full description, requirements and screening steps are on ${esc(j.via)}'s own listing.</p>
<p>Applying is free. You apply on ${esc(j.via)}'s site, and if you're accepted you're paid by ${esc(j.via)} directly.</p>`;

  const similar = feed.filter((x) => x.id !== j.id && ((j.domain && x.domain === j.domain) || x.platform === j.platform))
    .sort((a, b) => (b.posted || "").localeCompare(a.posted || "")).slice(0, 8);

  const body = `<nav class="crumbs"><a href="/">GigrAI</a> › <a href="/jobs">All roles</a> › ${esc(j.via)}</nav>
<h1>${esc(j.title)}</h1>
<div class="meta">${tags}</div>
<section class="card">${about}</section>
<a class="apply" href="/go/${encodeURIComponent(j.id)}?src=seo" rel="nofollow">Apply free on ${esc(j.via)}</a>
<p class="note">You'll apply on ${esc(j.via)}'s own site. This is a referral link: it costs you nothing and doesn't change your pay.${isoDate(j.posted) ? ` Posted ${isoDate(j.posted)}.` : ""}</p>
${similar.length ? `<h2>Similar remote roles</h2><ul class="list">${similar.map((x) => `<li><a href="${jobPath(x)}"><span>${esc(x.title)}</span><span class="p">${esc(pay(x) || x.via)}</span></a></li>`).join("")}</ul>` : ""}
<p style="margin-top:24px"><a href="/?q=${encodeURIComponent((j.domain || j.title.split(" ")[0] || "").toLowerCase())}">Search more roles like this →</a></p>`;

  const desc = `${p ? p + " · " : ""}Remote ${j.title} role via ${j.via}. See the details and apply free on GigrAI.`.slice(0, 160);
  return html(shell({
    title: `${j.title}${p ? ` (${p})` : ""}: remote via ${j.via} · GigrAI`,
    desc, canonical, body,
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
export function jobsIndex(feed, origin, platforms) {
  const groups = (platforms || []).map((p) => ({ p, jobs: feed.filter((j) => j.platform === p.id).sort((a, b) => (b.posted || "").localeCompare(a.posted || "")) }))
    .filter((g) => g.jobs.length);
  const body = `<nav class="crumbs"><a href="/">GigrAI</a> › All roles</nav>
<h1>All live remote AI jobs</h1>
<p>${feed.length} live remote roles training and testing AI, from ${groups.map((g) => esc(g.p.name)).join(" and ")}. Updated every 30 minutes. Every role is free to apply for on the platform's own site. <a href="/">Search and filter roles →</a></p>
${groups.map((g) => `<h2>${esc(g.p.name)} (${g.jobs.length})</h2><ul class="list">${g.jobs.map((x) => `<li><a href="${jobPath(x)}"><span>${esc(x.title)}</span><span class="p">${esc(pay(x))}</span></a></li>`).join("")}</ul>`).join("\n")}`;
  return html(shell({
    title: `All ${feed.length} live remote AI jobs · GigrAI`,
    desc: `Browse ${feed.length} live remote AI jobs from ${groups.map((g) => g.p.name).join(", ")}, with real pay rates. Free to apply.`,
    canonical: origin + "/jobs", body,
  }), 200, 900);
}

// ---------- closed role ----------
export function roleGone(origin) {
  return html(shell({
    title: "This role has closed · GigrAI",
    desc: "This remote AI role has closed. Search live roles on GigrAI.",
    canonical: "", robots: "noindex",
    body: `<h1>This role has closed</h1><p>It's no longer taking applications. There are plenty of live roles though.</p><a class="apply" href="/">Search live roles</a><p><a href="/jobs">Browse all roles →</a></p>`,
  }), 404, 300);
}
