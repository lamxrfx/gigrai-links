// /news (headlines + GigrAI's own posts), /news/<slug> (one post) and the private editor at /admin
import { shell, html, esc, crumbs, ARROW, WA, MONEY_CSS, refBox, mailCard, roleCard, pagePlatforms } from "./seo.js";
import { CATEGORIES } from "./news-sources.js";

const catName = (id) => (CATEGORIES.find((c) => c.id === id) || { name: "News" }).name;
const longDate = (iso) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
function ago(iso) {
  const m = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr${h > 1 ? "s" : ""} ago`;
  const d = Math.round(h / 24);
  return d < 14 ? `${d} day${d > 1 ? "s" : ""} ago` : longDate(iso);
}
const EXT = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>';

// ---- tiny safe Markdown: ## headings, lists, **bold**, *italic*, [links](https://...), > quotes ----
export function md(src) {
  const inline = (t) => esc(t)
    .replace(/!\[([^\]]*)\]\((\/media\/[a-z0-9]+\.(?:webp|jpg|png|gif)|https:\/\/[^\s)]+)\)/g, (_, alt, url) => `<img src="${url}" alt="${alt}" loading="lazy" class="art-img">`)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g, (_, text, url) => {
      const ext = /^https?:/.test(url) && !/^https:\/\/(www\.)?remotegigrai\.com/.test(url);
      return `<a href="${url}"${ext ? ' target="_blank" rel="noopener"' : ""}>${text}</a>`;
    });
  const out = [];
  let list = null;
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of String(src || "").replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    let m;
    if (!line) { close(); continue; }
    if ((m = line.match(/^(#{2,3})\s+(.*)$/))) { close(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); continue; }
    if ((m = line.match(/^[-*]\s+(.*)$/))) { if (list !== "ul") { close(); out.push("<ul>"); list = "ul"; } out.push(`<li>${inline(m[1])}</li>`); continue; }
    if ((m = line.match(/^\d+[.)]\s+(.*)$/))) { if (list !== "ol") { close(); out.push("<ol>"); list = "ol"; } out.push(`<li>${inline(m[1])}</li>`); continue; }
    if ((m = line.match(/^>\s?(.*)$/))) { close(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); continue; }
    close();
    if (/^!\[[^\]]*\]\([^)]+\)$/.test(line)) { out.push(`<figure>${inline(line)}</figure>`); continue; }
    out.push(`<p>${inline(line)}</p>`);
  }
  close();
  return out.join("\n");
}

// "Title | https://link" per line -> [{title, url}]
export const parseSources = (txt) => String(txt || "").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
  const [a, b] = l.includes("|") ? l.split("|").map((x) => x.trim()) : ["", l];
  const url = /^https?:\/\//.test(b) ? b : /^https?:\/\//.test(a) ? a : "";
  return url ? { title: (url === a ? b : a) || new URL(url).hostname.replace(/^www\./, ""), url } : null;
}).filter(Boolean);

const STYLE = `<style>
.ntabs{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 4px}
.ntabs a{padding:9px 16px;border-radius:999px;border:1px solid var(--line);background:var(--glass);color:var(--soft);font-weight:600;font-size:14px;text-decoration:none}
.ntabs a[aria-current]{background:#f2f4ff;color:#070914;border-color:#f2f4ff}
.posts{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:14px}
.pcard{display:flex;flex-direction:column;align-items:flex-start;text-align:left;gap:10px;padding:22px;border-radius:var(--r-lg);text-decoration:none;color:inherit;transition:transform .15s,border-color .15s}
.pcard:hover{transform:translateY(-2px);border-color:rgba(139,61,255,.5)}
.pcard.lead{grid-column:1/-1;padding:28px;background:linear-gradient(160deg,rgba(47,107,255,.2),rgba(139,61,255,.1) 60%,rgba(255,255,255,.04))}
.pcard.lead h3{font-size:clamp(22px,3vw,30px)}
.pcard h3{margin:0;font-size:19px;font-weight:800;line-height:1.3;letter-spacing:-.01em}
.pcard p{margin:0;color:var(--muted);font-size:15px}
.kicker{display:flex;gap:8px;align-items:center;font-size:12.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#9fbcff}
.kicker span{color:var(--muted);font-weight:600;text-transform:none;letter-spacing:0}
.wire{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.wire li{border-radius:var(--r-md)}
.wire a{display:grid;gap:6px;padding:18px 20px;border-radius:var(--r-md);text-decoration:none;color:inherit}
.wire a:hover{background:rgba(255,255,255,.04)}
.wire .src{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13px;color:var(--muted)}
.wire .src b{color:var(--soft);font-weight:700}
.wire .pill{padding:2px 9px;border-radius:999px;background:rgba(91,140,255,.16);color:#cfe0ff;font-size:12px;font-weight:600}
.wire h3{margin:0;font-size:17.5px;font-weight:700;line-height:1.35}
.wire p{margin:0;color:var(--muted);font-size:14.5px;line-height:1.5}
.wire .go{display:inline-flex;gap:6px;align-items:center;color:#9fdcf0;font-size:13.5px;font-weight:600}
.pager{display:flex;gap:10px;justify-content:center;margin-top:18px}
.pager a{padding:10px 18px;border-radius:999px;border:1px solid var(--line);background:var(--glass);color:var(--soft);text-decoration:none;font-weight:600}
.article{max-width:720px;margin:0 auto}
.article .meta{color:var(--muted);font-size:14.5px}
.article .body{font-size:17.5px;line-height:1.75;color:#e2e6f8}
.article .body h2{font-size:25px;margin:34px 0 10px;line-height:1.3}
.article .body h3{font-size:20px;margin:26px 0 8px}
.article .body a{color:#7fdcf0}
.article .body figure{margin:22px 0}.article .art-img{width:100%;height:auto;border-radius:16px;border:1px solid var(--line)}
.article .body blockquote{margin:18px 0;padding:6px 0 6px 18px;border-left:3px solid #5b8cff;color:var(--soft)}
.article .hero-img{width:100%;border-radius:var(--r-lg);border:1px solid var(--line);margin:18px 0 6px;aspect-ratio:16/9;object-fit:cover}
.srcbox{margin-top:30px;padding:20px 22px;border-radius:var(--r-md)}
.srcbox h2{margin:0 0 10px;font-size:17px}
.srcbox ol{margin:0;padding-left:20px;display:grid;gap:6px;color:var(--muted)}
.srcbox a{color:#9fdcf0}
.affbox{margin-top:24px;padding:22px;border-radius:var(--r-lg);display:flex;gap:16px;align-items:center;flex-wrap:wrap;background:linear-gradient(160deg,rgba(47,107,255,.22),rgba(139,61,255,.12) 60%,rgba(255,255,255,.04));border:1px solid rgba(139,61,255,.4)}
.affbox img{width:52px;height:52px;border-radius:14px;background:#fff}
.affbox .t{flex:1;min-width:200px}.affbox b{display:block;font-size:17px}.affbox span{color:var(--muted);font-size:14px}
.affbox .btn{height:50px;padding:0 22px;color:#fff}
.wa-cta{margin-top:18px;padding:18px 20px;border-radius:var(--r-md);display:flex;gap:14px;align-items:center;flex-wrap:wrap;border:1px solid rgba(37,211,102,.35);background:rgba(37,211,102,.08)}
.wa-cta p{margin:0;flex:1;min-width:200px}.wa-cta a{display:inline-flex;align-items:center;height:46px;padding:0 20px;border-radius:999px;background:#25d366;color:#04210f;font-weight:700;text-decoration:none}
.disc{margin-top:16px;color:var(--muted);font-size:13px}
</style>`;

const tabs = (base, cat) => `<nav class="ntabs" aria-label="Categories"><a href="${base}"${!cat ? ' aria-current="page"' : ""}>All</a>${CATEGORIES.map((c) => `<a href="${base}?cat=${c.id}"${cat === c.id ? ' aria-current="page"' : ""}>${esc(c.name)}</a>`).join("")}</nav>`;

const postCard = (p, lead) => `<a class="pcard glass${lead ? " lead" : ""}" href="/news/${esc(p.slug)}">
  <span class="kicker">${esc(catName(p.cat))}<span>· ${longDate(p.published_at || p.updated)}</span></span>
  <h3>${esc(p.title)}</h3>${p.summary ? `<p>${esc(p.summary)}</p>` : ""}</a>`;

// ---------- /news ----------
export function newsIndex({ origin, posts, news, total, cat, page, perPage, fetched }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const q = (p) => `/news?${cat ? `cat=${cat}&` : ""}page=${p}`;
  const body = `${STYLE}${MONEY_CSS}${crumbs([["/", "GigrAI"], ["", "News"]])}
<section class="hero sm">
  <span class="eyebrow"><i></i>Updated every hour</span>
  <h1>Remote work &amp; <span class="grad-text">AI news</span></h1>
  <p>The stories that matter if you work, or want to work, training AI from home: new platforms, pay, remote work trends and scams to avoid. Our own articles first, then the latest headlines from trusted sources.</p>
  ${tabs("/news", cat)}
</section>
${posts.length && page === 1 ? `<section class="block" aria-labelledby="ours"><h2 id="ours">From GigrAI</h2><div class="posts">${posts.map((p, i) => postCard(p, i === 0)).join("")}</div></section>` : ""}
<section class="block" aria-labelledby="wire"><h2 id="wire">Latest headlines</h2>
<p class="lead">From ${cat ? esc(catName(cat).toLowerCase()) + " sources" : "trusted news sites"}. Tap a story to read it on the original site.${fetched ? ` Checked ${ago(fetched)}.` : ""}</p>
${news.length ? `<ul class="wire">${news.map((n) => `<li class="glass"><a href="${esc(n.link)}" target="_blank" rel="noopener nofollow">
  <span class="src"><b>${esc(n.source)}</b><span>${ago(n.published)}</span><span class="pill">${esc(catName(n.cat))}</span></span>
  <h3>${esc(n.title)}</h3>${n.summary ? `<p>${esc(n.summary)}</p>` : ""}
  <span class="go">Read on ${esc(n.source)} ${EXT}</span></a></li>`).join("")}</ul>` : `<p class="note">Headlines are being collected. Check back in a few minutes.</p>`}
${pages > 1 ? `<nav class="pager" aria-label="More headlines">${page > 1 ? `<a href="${q(page - 1)}">Newer</a>` : ""}${page < pages ? `<a href="${q(page + 1)}">Older</a>` : ""}</nav>` : ""}
</section>
${MONEY_CSS}${mailCard("news-list", "Get new roles before anyone else", "The best new remote AI roles and news, once a week by email. Free.")}
<p class="disc">Headlines and short summaries belong to their publishers and link to the original articles.</p>`;
  return html(shell({
    title: `${cat ? catName(cat) + " · " : ""}Remote work & AI news · GigrAI`,
    desc: "The latest news on AI training work, remote jobs, AI companies and job scams, updated every hour, plus GigrAI's own guides and analysis.",
    canonical: origin + "/news" + (cat ? `?cat=${cat}` : ""), body, active: "/news",
    robots: page > 1 ? "noindex,follow" : undefined,
  }));
}

// ---------- /news/<slug> ----------
export function postPage({ origin, post, more, platforms, preview, roles = [] }) {
  const sources = parseSources(post.sources);
  const plat = (platforms || []).find((p) => p.id === post.affiliate && p.active && p.signupUrl);
  // platforms the article talks about (no box if it doesn't name one and has no affiliate set)
  const named = plat ? [] : pagePlatforms(`${post.title} ${post.summary || ""} ${post.body || ""}`, platforms, []);
  const when = post.published_at || post.updated;
  const ld = {
    "@context": "https://schema.org", "@type": "NewsArticle", headline: post.title, description: post.summary || "",
    datePublished: when, dateModified: post.updated, author: { "@type": "Organization", name: post.author || "GigrAI", url: origin },
    publisher: { "@type": "Organization", name: "GigrAI", logo: { "@type": "ImageObject", url: origin + "/favicon-512.png", width: 512, height: 512 } },
    mainEntityOfPage: origin + "/news/" + post.slug, ...(post.image ? { image: [post.image.startsWith("/") ? origin + post.image : post.image] } : {}),
  };
  const body = `${STYLE}${crumbs([["/", "GigrAI"], ["/news", "News"], ["", catName(post.cat)]])}
${preview ? `<p class="note" style="padding:12px 16px;border-radius:12px;background:rgba(255,200,80,.12);border:1px solid rgba(255,200,80,.4);color:#ffe0a3">Preview: this post is a <b>${esc(post.status)}</b> and only you can see it.</p>` : ""}
<article class="article">
  <span class="kicker" style="margin-top:18px">${esc(catName(post.cat))}</span>
  <h1 style="font-size:clamp(30px,4.6vw,46px);line-height:1.12;margin:10px 0 12px;letter-spacing:-.02em">${esc(post.title)}</h1>
  <p class="meta">By ${esc(post.author || "GigrAI")} · ${longDate(when)}</p>
  ${post.image ? `<img class="hero-img" src="${esc(post.image)}" alt="" loading="eager">` : ""}
  ${post.summary ? `<p style="font-size:20px;line-height:1.6;color:var(--text);margin:18px 0 6px">${esc(post.summary)}</p>` : ""}
  <div class="body">${md(post.body)}</div>
  ${plat ? `<div class="affbox">${plat.icon ? `<img src="/${esc(plat.icon)}" alt="">` : ""}<div class="t"><b>Try ${esc(plat.name)}</b><span>${esc(plat.tagline || "")}. Free to join.</span></div><a class="btn btn-grad" href="/join/${esc(plat.id)}?src=news" target="_blank" rel="sponsored noopener">Sign up free ${ARROW}</a></div>` : ""}
  ${sources.length ? `<section class="srcbox glass" aria-labelledby="srcs"><h2 id="srcs">Sources</h2><ol>${sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></li>`).join("")}</ol></section>` : ""}
  ${named.length ? refBox(named.slice(0, 2), "news-box", { title: "Want to try it yourself?", h: "h3" }) : ""}
  ${roles.length ? `<section class="block" aria-labelledby="nr"><h2 id="nr">Live roles you can apply for now</h2><p class="lead">Open right now, with the pay shown. Free to apply.</p><div class="cards">${roles.map((x) => roleCard(x, platforms, "news")).join("")}</div></section>` : ""}
  ${mailCard("news-post", "Never miss a new role", "The best new remote AI roles and news, once a week by email. Free.")}
  ${plat ? `<p class="disc">Some links are referral links. It costs you nothing and doesn't change your pay.</p>` : ""}
</article>
${more.length ? `<section class="block" aria-labelledby="more"><h2 id="more">More from GigrAI</h2><div class="posts">${more.map((p) => postCard(p)).join("")}</div></section>` : ""}`;
  return html(shell({
    title: `${post.title} · GigrAI`, desc: post.summary || post.title,
    canonical: origin + "/news/" + post.slug, body, active: "/news", ld: [ld], image: post.image || "",
    robots: preview ? "noindex,nofollow" : undefined,
  }));
}

// ---------- /news/rss.xml (our own posts) ----------
export function postsRss(origin, posts) {
  const x = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>GigrAI News</title><link>${origin}/news</link><description>Remote work and AI news from GigrAI</description>
${posts.map((p) => `<item><title>${x(p.title)}</title><link>${origin}/news/${x(p.slug)}</link><guid>${origin}/news/${x(p.slug)}</guid><pubDate>${new Date(p.published_at || p.updated).toUTCString()}</pubDate><description>${x(p.summary)}</description></item>`).join("\n")}
</channel></rss>`, { headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=900" } });
}

// ---------- private editor ----------
const ADMIN_STYLE = `<style>
.adm{display:grid;gap:14px}
.adm form{display:grid;gap:14px}
.adm label{display:grid;gap:6px;font-weight:700;font-size:14px;color:var(--soft)}
.adm label small{font-weight:500;color:var(--muted)}
.adm input,.adm select,.adm textarea{width:100%;border-radius:12px;border:1px solid var(--line);background:#0d1024;color:var(--text);font:inherit;font-size:15px;padding:12px 14px}
.adm textarea{min-height:120px;resize:vertical;line-height:1.55}
.adm textarea.big{min-height:380px}
.adm .row{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
.adm .bar{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.adm button,.adm .b{height:48px;padding:0 20px;border-radius:999px;border:1px solid var(--line);background:var(--glass);color:var(--text);font:inherit;font-weight:700;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center}
.adm .primary{background:linear-gradient(110deg,#22d3ee,#2f6bff 55%,#8b3dff);border:0;color:#fff}
.adm .danger{border-color:rgba(255,107,107,.5);color:#ffb3b3}
.adm table{width:100%;border-collapse:collapse;font-size:14.5px}
.adm th,.adm td{text-align:left;padding:10px 8px;border-bottom:1px solid var(--line);vertical-align:top}
.adm th{color:var(--muted);font-weight:600;font-size:13px}
.adm .st{padding:2px 9px;border-radius:999px;font-size:12px;font-weight:700}
.adm .st.published{background:rgba(61,214,140,.16);color:#9ff0c5}.adm .st.draft{background:rgba(255,200,80,.14);color:#ffe0a3}
.adm .msg{padding:12px 16px;border-radius:12px;background:rgba(61,214,140,.12);border:1px solid rgba(61,214,140,.35)}
.adm .err{background:rgba(255,107,107,.12);border-color:rgba(255,107,107,.4)}
.adm .help{font-size:13.5px;color:var(--muted);line-height:1.6}
.adm .help code{background:rgba(255,255,255,.08);padding:1px 6px;border-radius:6px}
.adm .nl a{color:var(--text);text-decoration:none;font-weight:600}.adm .nl small{color:var(--muted)}
.adm .tiny{height:36px!important;padding:0 14px!important;font-size:13px}
.imgpick{display:grid;gap:10px}.imgpick .lbl{display:grid;gap:4px;font-weight:700;font-size:14px;color:var(--soft)}.imgpick .lbl small{font-weight:500;color:var(--muted)}
.imgrow{display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap}
.imgprev{width:220px;aspect-ratio:16/9;border-radius:14px;border:1px dashed var(--line);display:grid;place-items:center;overflow:hidden;background:#0d1024;color:var(--muted);font-size:13px}
.imgprev img{width:100%;height:100%;object-fit:cover}
.imgbtns{display:flex;flex-direction:column;gap:8px;align-items:flex-start}
.adm .upl{cursor:pointer;background:linear-gradient(110deg,#22d3ee,#2f6bff 55%,#8b3dff);border:0;color:#fff}
.imgpick details summary{cursor:pointer;color:#9fdcf0;font-size:14px;font-weight:600;margin-bottom:8px}
@media (max-width:700px){.adm table,.adm tbody,.adm tr,.adm td{display:block;width:100%}.adm thead{display:none}.adm tr{padding:10px 0;border-bottom:1px solid var(--line)}.adm td{border:0;padding:4px 0}}
</style>`;

const admShell = (title, body) => html(shell({ title: `${title} · GigrAI admin`, desc: "Private.", canonical: "", robots: "noindex,nofollow", body: ADMIN_STYLE + `<div class="adm">${body}</div>` }));
const hidden = (k) => `<input type="hidden" name="k" value="${esc(k)}">`;

export function adminHome({ k, posts, news, msg, fetched, suggested = [] }) {
  const a = (path) => `${path}${path.includes("?") ? "&" : "?"}k=${encodeURIComponent(k)}`;
  return admShell("Blog", `<section class="hero sm" style="padding-bottom:6px"><span class="eyebrow"><i></i>Private · only for you</span><h1>Blog <span class="grad-text">editor</span></h1>
<p>Write your own posts, publish or keep them as drafts, and turn any headline into a post. Bookmark this page and don't share the link.</p>
<div class="bar"><a class="b primary" href="${a("/admin/post")}">+ New post</a><a class="b" href="/news" target="_blank">View /news</a><a class="b" href="${a("/admin/roles")}">Add roles</a><a class="b" href="${a("/admin/sponsored")}">Sponsored listings</a><a class="b" href="${a("/report")}">Site numbers</a></div></section>
${msg ? `<p class="msg">${esc(msg)}</p>` : ""}
<section class="block"><h2>Your posts</h2>
${posts.length ? `<table><thead><tr><th>Title</th><th>Status</th><th>Updated</th><th></th></tr></thead><tbody>${posts.map((p) => `<tr>
<td><b>${esc(p.title)}</b><br><small style="color:var(--muted)">${esc(catName(p.cat))} · /news/${esc(p.slug)}</small></td>
<td><span class="st ${esc(p.status)}">${p.status === "published" ? "Live" : "Draft"}</span></td>
<td style="white-space:nowrap">${ago(p.updated)}</td>
<td style="white-space:nowrap"><a class="b tiny" href="${a("/admin/post?slug=" + encodeURIComponent(p.slug))}">Edit</a> <a class="b tiny" href="${p.status === "published" ? "/news/" + esc(p.slug) : a("/news/" + encodeURIComponent(p.slug) + "?preview=1")}" target="_blank">View</a></td></tr>`).join("")}</tbody></table>` : `<p class="note">No posts yet. Start one with "New post", or use "Write about this" on a headline below.</p>`}
</section>
${suggested.length ? `<section class="block"><h2>Suggested drafts</h2><p class="note" style="margin:0 0 10px">Written for you each week from the latest news. Open one, check it, edit it, then publish. Nothing goes live until you press Publish.</p>
<table><tbody>${suggested.map((d) => `<tr><td><b>${esc(d.title)}</b><br><small style="color:var(--muted)">${esc(catName(d.cat))}${d.created ? " · suggested " + ago(d.created) : ""}</small>${d.summary ? `<br><small style="color:var(--muted)">${esc(d.summary)}</small>` : ""}</td>
<td style="white-space:nowrap"><a class="b tiny" href="${a("/admin/post?draft=" + encodeURIComponent(d.id))}">Open in editor</a></td></tr>`).join("")}</tbody></table></section>` : ""}
<section class="block"><h2>Latest headlines</h2>
<div class="bar" style="margin-bottom:10px"><form method="post" action="/admin/refresh">${hidden(k)}<button type="submit">Fetch new headlines now</button></form><span class="note">${fetched ? `Last checked ${ago(fetched)}. ` : ""}Checked automatically every hour. Hide anything off-topic.</span></div>
<table><tbody>${news.map((n) => `<tr class="nl"><td><a href="${esc(n.link)}" target="_blank" rel="noopener">${esc(n.title)}</a><br><small>${esc(n.source)} · ${esc(catName(n.cat))} · ${ago(n.published)}${n.hidden ? " · <b>hidden</b>" : ""}</small></td>
<td style="white-space:nowrap"><a class="b tiny" href="${a("/admin/post?from=" + encodeURIComponent(n.id))}">Write about this</a>
<form method="post" action="/admin/news" style="display:inline">${hidden(k)}<input type="hidden" name="id" value="${esc(n.id)}"><input type="hidden" name="hide" value="${n.hidden ? "0" : "1"}"><button class="tiny" type="submit">${n.hidden ? "Show" : "Hide"}</button></form></td></tr>`).join("")}</tbody></table>
</section>`);
}

export function adminEditor({ k, post, isNew, error, platforms }) {
  const p = post || {};
  const opt = (v, t, cur) => `<option value="${esc(v)}"${v === cur ? " selected" : ""}>${esc(t)}</option>`;
  return admShell(isNew ? "New post" : "Edit post", `<p style="margin:0"><a href="/admin?k=${encodeURIComponent(k)}" style="color:#9fdcf0">← All posts</a></p>
<h1 style="margin:0">${isNew ? "New post" : "Edit post"}</h1>
${error ? `<p class="msg err">${esc(error)}</p>` : ""}
<form method="post" action="/admin/post">${hidden(k)}<input type="hidden" name="original" value="${esc(isNew ? "" : p.slug || "")}">
<label>Headline<input name="title" required maxlength="160" value="${esc(p.title || "")}" placeholder="e.g. Mercor raises $100M: what it means for AI trainers"></label>
<div class="row">
<label>Category<select name="cat">${CATEGORIES.map((c) => opt(c.id, c.name, p.cat || "ai-work")).join("")}</select></label>
<label>Web address <small>remotegigrai.com/news/…  (leave blank to make one from the headline)</small><input name="slug" maxlength="80" pattern="[a-z0-9-]*" value="${esc(p.slug || "")}" placeholder="mercor-raises-100m"></label>
</div>
<label>Summary <small>1–2 sentences. Shown on the news page, in Google and when shared.</small><textarea name="summary" maxlength="300" style="min-height:80px">${esc(p.summary || "")}</textarea></label>
<label>Article
<textarea class="big" name="body" placeholder="Write in plain text. Leave an empty line between paragraphs.">${esc(p.body || "")}</textarea>
<span class="help">Formatting: <code>![description](image link)</code> for a picture · <code>## Heading</code> · <code>- bullet</code> · <code>1. numbered</code> · <code>**bold**</code> · <code>*italic*</code> · <code>[link text](https://...)</code> · <code>&gt; quote</code>. Write in your own words and keep quotes short.</span></label>
<label>Sources <small>One per line: <code>Title | https://link</code>. Shown at the bottom of the post.</small><textarea name="sources" placeholder="TechCrunch: Mercor raises $100M | https://techcrunch.com/...">${esc(p.sources || "")}</textarea></label>
<div class="row">
<label>Sign-up box <small>Adds a referral sign-up card under the article</small><select name="affiliate">${opt("", "None", p.affiliate || "")}${(platforms || []).filter((x) => x.active && x.signupUrl).map((x) => opt(x.id, x.name, p.affiliate || "")).join("")}</select></label>
<label>Author<input name="author" maxlength="60" value="${esc(p.author || "GigrAI")}"></label>
</div>
<div class="imgpick">
  <span class="lbl">Cover image <small>Optional. Shown at the top of the post and when it's shared. Use your own photos or ones you have the rights to.</small></span>
  <div class="imgrow">
    <div class="imgprev" id="imgPrev">${p.image ? `<img src="${esc(p.image)}" alt="">` : "<span>No image</span>"}</div>
    <div class="imgbtns">
      <label class="b upl">Upload image<input type="file" id="coverFile" accept="image/jpeg,image/png,image/webp,image/gif" hidden></label>
      <button type="button" class="b" id="bodyImgBtn">Add image inside the article</button>
      <button type="button" class="b tiny" id="coverClear"${p.image ? "" : " hidden"}>Remove cover</button>
      <input type="file" id="bodyFile" accept="image/jpeg,image/png,image/webp,image/gif" hidden>
      <span class="note" id="imgMsg" aria-live="polite"></span>
    </div>
  </div>
  <details><summary>Or paste an image link</summary><input name="image" id="imageUrl" maxlength="300" value="${esc(p.image || "")}" placeholder="https://... or /media/..."></details>
</div>
<div class="bar">
<button class="primary" type="submit" name="status" value="published">${p.status === "published" ? "Update live post" : "Publish"}</button>
<button type="submit" name="status" value="draft">${p.status === "published" ? "Unpublish (back to draft)" : "Save draft"}</button>
${!isNew && p.slug ? `<a class="b" href="/news/${esc(p.slug)}?preview=1&k=${encodeURIComponent(k)}" target="_blank">Preview</a>` : ""}
</div>
</form>
<script>
(function(){
  var K = ${JSON.stringify(k)};
  var $ = function(id){ return document.getElementById(id); };
  // Shrink big photos in the browser (max 1600px wide) so pages stay fast
  function shrink(file){
    return new Promise(function(ok, bad){
      if (file.type === "image/gif") return ok(file);
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function(){
        var w = img.naturalWidth, h = img.naturalHeight, max = 1600;
        if (w > max) { h = Math.round(h * max / w); w = max; }
        var c = document.createElement("canvas"); c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        c.toBlob(function(b){ b ? ok(b) : bad(new Error("Couldn't read that image")); }, "image/webp", 0.82);
      };
      img.onerror = function(){ bad(new Error("Couldn't read that image")); };
      img.src = url;
    });
  }
  async function upload(file){
    $("imgMsg").textContent = "Uploading…";
    var blob = await shrink(file);
    if (blob.size > 1800000) throw new Error("That image is too big. Try a smaller one.");
    var r = await fetch("/admin/upload?k=" + encodeURIComponent(K), { method: "POST", headers: { "content-type": blob.type || file.type }, body: blob });
    var d = await r.json();
    if (!d.ok) throw new Error(d.error || "Upload failed");
    $("imgMsg").textContent = "Uploaded.";
    return d.url;
  }
  $("coverFile").addEventListener("change", async function(){
    var f = this.files[0]; if (!f) return;
    try { var u = await upload(f); $("imageUrl").value = u; $("imgPrev").innerHTML = '<img src="' + u + '" alt="">'; $("coverClear").hidden = false; }
    catch (e) { $("imgMsg").textContent = e.message; }
    this.value = "";
  });
  $("coverClear").addEventListener("click", function(){ $("imageUrl").value = ""; $("imgPrev").innerHTML = "<span>No image</span>"; this.hidden = true; });
  $("imageUrl").addEventListener("change", function(){ var v = this.value.trim(); $("imgPrev").innerHTML = v ? '<img src="' + v.replace(/"/g, "") + '" alt="">' : "<span>No image</span>"; });
  $("bodyImgBtn").addEventListener("click", function(){ $("bodyFile").click(); });
  $("bodyFile").addEventListener("change", async function(){
    var f = this.files[0]; if (!f) return;
    try {
      var u = await upload(f), ta = document.querySelector("textarea[name=body]");
      var at = ta.selectionStart || ta.value.length, md = "\\n\\n![Image](" + u + ")\\n\\n";
      ta.value = ta.value.slice(0, at) + md + ta.value.slice(at); ta.focus();
      $("imgMsg").textContent = "Image added to the article. You can change the word 'Image' to describe it.";
    } catch (e) { $("imgMsg").textContent = e.message; }
    this.value = "";
  });
})();
</script>
${!isNew && p.slug ? `<form method="post" action="/admin/delete" onsubmit="return confirm('Delete this post for good? This cannot be undone.')">${hidden(k)}<input type="hidden" name="slug" value="${esc(p.slug)}"><button class="danger" type="submit">Delete post</button></form>` : ""}`);
}
