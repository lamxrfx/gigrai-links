import PLATFORM_CONFIG from "./public/platforms.json";
import { rolePage, jobsIndex, roleGone, jobPath, guidePage, guidesIndex, advertisePage, advertiseTermsPage, AD_TERMS_VERSION, platformsPage, liveFeatured, allSponsors, featuredHtml, clickCap, setChat, setEmail, alertsConfirmedPage } from "./seo.js";
import { track, trackUnique, countMany, isHuman, readStats, signKey, keyOk, daysAgo, presence, liveNow, geoReport, countryTotals, botKind, netName, flagged, markOwner, isOwner, roleClick, topRoles, meta, pageHit, topPages } from "./stats.js";
import { mediaKitPage, sponsorReportPage, adminPage, reportsOff } from "./report.js";
import MEDIAKIT from "./mediakit.json";
import DRAFTS from "./drafts.json";
export { Stats } from "./stats.js";
export { Content } from "./content.js";
import { content, refreshNews } from "./content.js";
import { pickWeekly, weeklyEmail, londonNow, mlSendCampaign } from "./weekly.js";
import { newsIndex, postPage, postsRss, adminHome, adminEditor } from "./news.js";
import { CATEGORIES } from "./news-sources.js";
import { slugify, AD_OPTIONS, shell as shellPage, html, ukDay } from "./seo.js";
import { vetLink } from "./vet.js";
import { EmailMessage } from "cloudflare:email";
import { systemPrompt, askAi, parseAsk } from "./chat.js";
import SPONSORED from "./sponsored.json";
import CURATED from "./curated.json";
import { menuButton, drawerHtml } from "./nav.js";
import { GUIDES } from "./guides.js";
// Serves the static link page from ./public and handles one API route:
//   POST /api/subscribe  { email, name }  -> adds the person to the MailerLite "GigrAI Jobs" group.
// Static files are served before this code runs, so only unmatched paths reach it.

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Best-effort limit: 5 sign-up attempts a minute per visitor (per server location)
const HITS = new Map();
function tooMany(request) {
  const ip = request.headers.get("cf-connecting-ip") || "?";
  const now = Date.now(), list = (HITS.get(ip) || []).filter(t => now - t < 60000);
  list.push(now); HITS.set(ip, list);
  if (HITS.size > 5000) HITS.clear();
  return list.length > 5;
}

// Make sure the custom fields we send exist in MailerLite (checked once per server start)
let fieldsReady = false;
async function mailerliteFields(env) {
  if (fieldsReady) return;
  const base = env.MAILERLITE_API || "https://connect.mailerlite.com/api";
  const h = { "content-type": "application/json", accept: "application/json", authorization: `Bearer ${env.MAILERLITE_TOKEN}` };
  const r = await fetch(`${base}/fields?limit=100`, { headers: h });
  if (!r.ok) return;
  const have = new Set(((await r.json()).data || []).map(f => f.key));
  for (const name of ["interests", "min_pay", "signup_source", "signup_page", "consent_text", "consent_at"]) {
    if (!have.has(name)) await fetch(`${base}/fields`, { method: "POST", headers: h, body: JSON.stringify({ name, type: "text" }) });
  }
  fieldsReady = true;
}

const app = {
  // Hourly (see "triggers" in wrangler.jsonc): pull the latest headlines
  async scheduled(event, env, ctx) {
    ctx.waitUntil(refreshNews(env));
    ctx.waitUntil(weeklyRun(env, ctx).catch(e => console.error("weekly email failed", String(e))));
  },

  async route(request, env, ctx) {
    const url = new URL(request.url);
    setChat(env.CHAT !== "off");
    setEmail(env.EMAIL_SIGNUP === "on");
    // Always use the secure https:// address (Google had indexed the http:// one)
    if (url.protocol === "http:" && !/^(localhost|127\.)/.test(url.hostname)) {
      url.protocol = "https:";
      return Response.redirect(url.toString(), 301);
    }
    // Owner's own devices carry a private cookie (set from the numbers page) and are never counted
    const nt = (request.headers.get("cookie") || "").match(/(?:^|;\s*)gg_nt=([a-f0-9]{20})(?:;|$)/);
    if (nt && await keyOk(env, "notrack", nt[1])) markOwner(request);
    // Count a human page view (anonymous daily totals for the media kit)
    const view = (section, title = "") => {
      if (request.method !== "GET") return;
      if (isHuman(request)) { track(env, ctx, request, "view", section, visitSource(request, url)); presence(env, ctx, request, section, true); pageHit(env, ctx, request, url.pathname.replace(/\/+$/, "") || "/", title, section); }
      else { // counted separately, never in the visitor numbers
        const kind = botKind(request);
        track(env, ctx, request, "bot", kind, section);
        if (kind === "server") track(env, ctx, request, "botnet", netName(request), section); // which company's servers
      }
    };

    // Email job alerts sign-up -> MailerLite (double opt-in). Only open when EMAIL_SIGNUP is "on".
    if (url.pathname === "/api/subscribe") {
      if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
      if (env.EMAIL_SIGNUP !== "on") return json({ ok: false, error: "Email alerts are coming soon. Join our WhatsApp channel for now." }, 403);
      const origin = request.headers.get("origin");
      if (!origin || new URL(origin).host !== url.host) return json({ ok: false, error: "Forbidden" }, 403);
      if (tooMany(request)) return json({ ok: false, error: "Too many tries. Please wait a minute and try again." }, 429);

      let data;
      try { data = JSON.parse((await request.text()).slice(0, 4000)); } catch { return json({ ok: false, error: "Bad request" }, 400); }
      if (data.website) return json({ ok: true }); // honeypot: bots fill it in

      const email = String(data.email || "").trim().toLowerCase();
      if (!EMAIL_RE.test(email) || email.length > 254) return json({ ok: false, error: "Please enter a valid email." }, 400);
      if (data.consent !== true) return json({ ok: false, error: "Please tick the box to agree to receive emails." }, 400);
      if (!env.MAILERLITE_TOKEN || !env.MAILERLITE_GROUP_ID) {
        console.error("MAILERLITE_TOKEN or MAILERLITE_GROUP_ID is not set");
        return json({ ok: false, error: "Sign-up is temporarily unavailable." }, 500);
      }
      const INTERESTS = ["Writing", "Coding", "Research", "Medical", "Finance", "Legal", "Languages", "Maths", "Design", "Data"];
      const interests = (Array.isArray(data.interests) ? data.interests : []).filter(x => INTERESTS.includes(x)).join(", ");
      const country = /^[A-Z]{3}$/.test(String(data.country || "")) ? String(data.country) : "";
      const minpay = [0, 25, 50, 100].includes(+data.minpay) ? +data.minpay : 0;
      const fields = {
        country: country ? (COUNTRY[country] || country) : "",
        interests, min_pay: minpay ? `$${minpay}+` : "",
        signup_source: cleanSrc(data.source) || "site",
        signup_page: String(data.page || "").replace(/[^\w\-/]/g, "").slice(0, 80),
        consent_text: String(data.consentText || "").slice(0, 200),
        consent_at: new Date().toISOString(),
      };
      try { await mailerliteFields(env); } catch (e) { console.error("MailerLite fields", String(e)); }
      // Our own branded confirmation email (MailerLite automation on the "pending" group), see /alerts/confirm
      if (env.EMAIL_CONFIRM === "ours" && env.MAILERLITE_PENDING_GROUP_ID) {
        const r = await mlConfirmSignup(env, email, fields, request.headers.get("cf-connecting-ip") || undefined);
        if (r.ok) { if (isHuman(request)) track(env, ctx, request, "signup", "email", fields.signup_source); return json({ ok: true, already: !!r.already }); }
        if (r.status === 422) return json({ ok: false, error: "Please enter a valid email." }, 400);
        return json({ ok: false, error: "Something went wrong. Please try again." }, 502);
      }
      const res = await fetch(`${env.MAILERLITE_API || "https://connect.mailerlite.com/api"}/subscribers`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json", authorization: `Bearer ${env.MAILERLITE_TOKEN}` },
        body: JSON.stringify({ email, fields, groups: [env.MAILERLITE_GROUP_ID], status: "unconfirmed", ip_address: request.headers.get("cf-connecting-ip") || undefined }),
      });
      if (res.ok) {
        if (isHuman(request)) track(env, ctx, request, "signup", "email", fields.signup_source);
        return json({ ok: true });
      }
      console.error("MailerLite error", res.status, (await res.text()).slice(0, 500));
      if (res.status === 422) return json({ ok: false, error: "Please enter a valid email." }, 400);
      return json({ ok: false, error: "Something went wrong. Please try again." }, 502);
    }

    // Confirm link from our own confirmation email: moves the person from "pending" into the main alerts group
    if (request.method === "GET" && url.pathname === "/alerts/confirm") {
      const email = String(url.searchParams.get("e") || "").replace(/ /g, "+").trim().toLowerCase().slice(0, 254);
      const t = url.searchParams.get("t") || "";
      if (!EMAIL_RE.test(email) || !(await keyOk(env, "confirm:" + email, t))) return Response.redirect(new URL("/alerts/confirmed?bad=1", url).toString(), 303);
      try {
        await mlConfirmDone(env, email);
        track(env, ctx, request, "signup", "confirmed", "email");
      } catch (e) {
        console.error("confirm failed", String(e));
        return Response.redirect(new URL("/alerts/confirmed?err=1", url).toString(), 303);
      }
      return Response.redirect(new URL("/alerts/confirmed", url).toString(), 303);
    }

    // Advertiser booking request from /advertise -> saved, link checked, emailed to us
    if (url.pathname === "/api/enquiry" && request.method === "POST") {
      const origin = request.headers.get("origin");
      if (!origin || new URL(origin).host !== url.host) return json({ ok: false, error: "Forbidden" }, 403);
      if (tooMany(request)) return json({ ok: false, error: "Too many tries. Please wait a minute and try again." }, 429);
      let d;
      try { d = JSON.parse((await request.text()).slice(0, 8000)); } catch { return json({ ok: false, error: "Bad request" }, 400); }
      if (d.website) return json({ ok: true, ref: "GA-OK" }); // honeypot
      const t = (k, n) => String(d[k] || "").replace(/[\r\n]+/g, k === "notes" ? "\n" : " ").trim().slice(0, n);
      const e = {
        company: t("company", 100), name: t("name", 80), email: t("email", 200).toLowerCase(), site: t("website_url", 300),
        role: t("role", 120), url: t("url", 500), pay: t("pay", 60), option: t("option", 60),
        start: /^\d{4}-\d{2}-\d{2}$/.test(d.start || "") ? d.start : "", budget: Math.max(0, Math.min(100000, +d.budget || 0)), notes: t("notes", 1500),
      };
      if (!e.company || !e.name || !e.role || !e.url || !e.start) return json({ ok: false, error: "Please fill in all the required fields." }, 400);
      if (!EMAIL_RE.test(e.email)) return json({ ok: false, error: "Please enter a valid work email." }, 400);
      if (d.agree !== true) return json({ ok: false, error: "Please tick the box to confirm the role meets our standards." }, 400);
      if (!AD_OPTIONS.some(o => o.name === e.option)) return json({ ok: false, error: "Please choose an option." }, 400);
      if (/per click/i.test(e.option) && e.budget < 100) return json({ ok: false, error: "Pay per click starts from a £100 budget." }, 400);
      if (e.site && !/^https?:\/\//i.test(e.site)) e.site = "https://" + e.site;
      const vet = await vetLink(e.url, e.site);
      if (vet.result === "fail") return json({ ok: false, error: "We can't accept that application link: " + vet.reasons.join(" ") }, 400);
      const ref = "GA-" + [...crypto.getRandomValues(new Uint8Array(3))].map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
      const db = content(env);
      if (db) await db.addEnquiry(ref, { ...e, vet, country: request.cf?.country || "", terms: AD_TERMS_VERSION, terms_at: new Date().toISOString() });
      ctx.waitUntil(notifyEnquiry(env, ref, e, vet).catch(err => console.error("notify failed", String(err))));
      console.log(JSON.stringify({ event: "enquiry", ref, option: e.option, vet: vet.result }));
      return json({ ok: true, ref });
    }

    // Link-tap counter: shows up in Cloudflare > gigrai-links > Observability (search "link_click")
    if (url.pathname === "/api/click" && request.method === "POST") {
      let link = "unknown", src = "";
      try {
        const body = JSON.parse(await request.text());
        link = String(body.link || "unknown").replace(/[^\w\- .:/]/g, "").slice(0, 60);
        src = String(body.src || "");
      } catch {}
      console.log(JSON.stringify({ event: "link_click", link, src: cleanSrc(src), country: request.cf?.country || "??" }));
      if (isHuman(request)) track(env, ctx, request, "link", link.replace(/[^a-z0-9_-]/gi, "-"), cleanSrc(src));
      return new Response(null, { status: 204 });
    }

    // Tracked apply link: /go/<jobId>?src=wa -> 302 to the job's referral link
    if (url.pathname.startsWith("/go/") && request.method === "GET") {
      const id = decodeURIComponent(url.pathname.slice(4));
      if (!/^[a-z0-9]{1,30}-[A-Za-z0-9_-]{1,80}$/.test(id)) return Response.redirect(new URL("/", url).toString(), 302);
      if (id.startsWith("sponsored-")) {
        const f = allSponsors(await sponsorsCfg(env)).find(x => "sponsored-" + x.id === id);
        const src = cleanSrc(url.searchParams.get("src")) || "direct";
        console.log(JSON.stringify({ event: "apply_click", id, platform: "sponsored", found: !!f, src, country: request.cf?.country || "??" }));
        if (f && isHuman(request)) { track(env, ctx, request, "sponsor", f.id, src); trackUnique(env, ctx, request, f.id, src); track(env, ctx, request, "apply", "sponsored", src); }
        return Response.redirect(f ? f.url : new URL("/", url).toString(), 302);
      }
      let feed = [];
      try { feed = await loadFeed(env, ctx); } catch {}
      const job = feed.find(j => j.id === id);
      console.log(JSON.stringify({ event: "apply_click", id, platform: job ? job.platform : "?", found: !!job, src: cleanSrc(url.searchParams.get("src")), country: request.cf?.country || "??" }));
      if (job && isHuman(request)) { track(env, ctx, request, "apply", job.platform, cleanSrc(url.searchParams.get("src")) || "site"); roleClick(env, ctx, request, job, jobPath(job), money(job)); }
      return Response.redirect(job ? job.url : new URL("/", url).toString(), 302);
    }

    // The redesign was tested at /new: send old links to the homepage
    if (url.pathname === "/new" || url.pathname.startsWith("/new/")) {
      return Response.redirect(new URL("/" + url.search, url).toString(), 301);
    }

    // GigrAI assistant (see chat.js). POST { messages: [{role, content}], country }
    if (url.pathname === "/api/chat" && request.method === "POST") return handleChat(request, url, env, ctx);

    // One role with its description: GET /api/job?id=mercor-list_xxx&country=GBR
    // Visitor's country from Cloudflare (no location prompt): GET /api/where
    if (url.pathname === "/api/where" && request.method === "GET") {
      const iso2 = String(request.cf?.country || "").toUpperCase();
      return new Response(JSON.stringify({ ok: true, iso2, iso3: ISO3[iso2] || "" }), { headers: { "content-type": "application/json", "cache-control": "private, no-store" } });
    }

    if (url.pathname === "/api/job" && request.method === "GET") {
      if (isHuman(request)) presence(env, ctx, request, null, false);
      const id = url.searchParams.get("id") || "";
      if (!/^[a-z0-9]{1,30}-[A-Za-z0-9_-]{1,80}$/.test(id)) return json({ ok: false, error: "Not found" }, 404);
      let feed;
      try { feed = await loadFeed(env, ctx); } catch { return json({ ok: false, error: "Live roles are unavailable right now." }, 502); }
      const j = feed.find(x => x.id === id);
      if (!j) return json({ ok: false, error: "This role has closed or moved." }, 404);
      const country = /^[A-Z]{3}$/.test(url.searchParams.get("country") || "") ? url.searchParams.get("country") : "";
      const { allow, deny, known, ...rest } = j;
      return new Response(JSON.stringify({ ok: true, job: country ? { ...rest, elig: eligibility(j, country) } : rest }), {
        headers: { "content-type": "application/json", "cache-control": "public, max-age=300" },
      });
    }

    // Live roles from all platforms: GET /api/jobs?q=photography&page=1
    if (url.pathname === "/api/jobs" && request.method === "GET") {
      if (isHuman(request)) presence(env, ctx, request, null, false);
      return handleJobs(url, env, ctx);
    }

    // ---- Google: ads.txt, robots.txt, sitemap.xml ----
    if (url.pathname === "/ads.txt") {
      const pub = adsensePub(env);
      if (!pub) return new Response("Not found", { status: 404 });
      return text(`google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`, 3600);
    }
    if (url.pathname === "/robots.txt") {
      return text(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /go/\nDisallow: /join/\nDisallow: /picks\nDisallow: /report\nDisallow: /admin\n\nSitemap: ${url.origin}/sitemap.xml\n`, 3600);
    }
    if (url.pathname === "/sitemap.xml") return sitemap(url, env, ctx);

    if (request.method === "GET" && (url.pathname === "/advertise/terms" || url.pathname === "/advertise/terms/")) {
      view("advertise", "Advertising Terms");
      return decorate(advertiseTermsPage(url.origin, MEDIAKIT.contactEmail || undefined), url, env, ctx, "/advertise");
    }
    if (request.method === "GET" && (url.pathname === "/advertise" || url.pathname === "/advertise/")) {
      let feed = [];
      try { feed = await loadFeed(env, ctx); } catch {}
      view("advertise");
      return decorate(advertisePage(url.origin, feed.length, new Set(feed.map(j => j.platform)).size, MEDIAKIT.contactEmail), url, env, ctx, "/advertise");
    }

    // ---- Media kit for advertisers ----
    if (request.method === "GET" && (url.pathname === "/media-kit" || url.pathname === "/media-kit/")) {
      let feed = [];
      try { feed = await loadFeed(env, ctx); } catch {}
      view("media-kit");
      const days = pickDays(url);
      const from = daysAgo(days - 1), to = new Date().toISOString().slice(0, 10);
      const [views, applies] = await Promise.all([readStats(env, { kind: "view", from }), readStats(env, { kind: "apply", from })]);
      if (views) Object.assign(views, { from, to });
      return decorate(mediaKitPage({ origin: url.origin, kit: MEDIAKIT, liveRoles: feed.length, platforms: new Set(feed.map(j => j.platform)).size, views, applies, days }), url, env, ctx, "/media-kit");
    }

    // ---- Private reports: /report?k=<owner key> and /report/<sponsor id>?k=<sponsor key> ----
    // Live visitors for the map on the private numbers page
    if (request.method === "GET" && url.pathname === "/report-live") {
      if (!(await keyOk(env, "owner", url.searchParams.get("k") || ""))) return json({ ok: false }, 404);
      const day = new Date().toISOString().slice(0, 10);
      const [d, tv, ta] = await Promise.all([liveNow(env), readStats(env, { kind: "view", from: day }), readStats(env, { kind: "apply", from: day })]);
      const today = { views: tv ? tv.total : 0, applies: ta ? ta.total : 0, countries: tv ? tv.byCountry.slice(0, 6) : [] };
      return json(d ? { ok: true, ...d, today } : { ok: false });
    }
    // Thank-you page after confirming email alerts (set as the redirect in MailerLite's double opt-in settings)
    if (request.method === "GET" && (url.pathname === "/alerts/confirmed" || url.pathname === "/alerts/confirmed/")) {
      const state = url.searchParams.has("bad") ? "bad" : url.searchParams.has("err") ? "err" : "";
      if (!state) view("confirmed");
      return alertsConfirmedPage(url.origin, state);
    }

    // Lost or changed the numbers-page link? This emails it to our own inbox only (never shown here)
    // Owner preview of this week's email: /report-weekly?k=... (POST emails a copy to the GigrAI inbox)
    if (url.pathname === "/report-weekly") {
      const k = url.searchParams.get("k") || "";
      if (!(await keyOk(env, "owner", k))) return linkPage("Not found", 404);
      const email = await buildWeekly(env, ctx);
      if (!email) return linkPage("<p style='font:16px system-ui;padding:24px'>Not enough paid roles to build this week's email yet.</p>");
      if (request.method === "POST" && env.NOTIFY) {
        await sendOwnerHtml(env, "[Preview] " + email.subject, email.html);
        return linkPage(`<p style="font:16px system-ui;padding:24px">Sent a preview to the GigrAI inbox. <a href="/report-weekly?k=${k}">Back</a></p>`);
      }
      const bar = `<div style="position:sticky;top:0;z-index:9;background:#0b0e1d;color:#fff;font:15px system-ui;padding:12px 16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap"><a href="/admin?k=${k}" style="color:#9fdcf0;text-decoration:none;font-weight:700">← Admin</a><b>Preview: next Monday's email</b><span style="opacity:.75">Subject: ${email.subject.replace(/</g, "&lt;")}</span><form method="post" style="margin:0 0 0 auto"><button style="height:38px;padding:0 16px;border-radius:999px;border:0;background:#2f6bff;color:#fff;font-weight:700;cursor:pointer">Email me a copy</button></form></div>`;
      return linkPage(email.html.replace('<body class="body" style="margin:0;padding:0;background:#ffffff">', '$&' + bar));
    }
    if (url.pathname === "/report/email-link") {
      if (request.method === "POST") {
        const lock = new Request("https://cache.remotegigrai.internal/owner-link-lock");
        const cache = typeof caches !== "undefined" ? caches.default : null;
        if (cache && await cache.match(lock)) return linkPage(emailLinkPage("Already sent in the last 10 minutes. Check your inbox (and spam)."), 429);
        const key = await signKey(env, "owner");
        // After a deploy (?auto=1) only send when the key has actually changed, so the inbox isn't spammed
        if (key && url.searchParams.get("auto") === "1") {
          const h = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key)))].slice(0, 8).map(b => b.toString(16).padStart(2, "0")).join("");
          if ((await meta(env, "owner_key_sent")) === h) return linkPage(emailLinkPage("No change: the link is the same as before."));
          await meta(env, "owner_key_sent", h);
        }
        if (key && env.NOTIFY) {
          if (cache) ctx.waitUntil(cache.put(lock, new Response("1", { headers: { "cache-control": "max-age=600" } })));
          ctx.waitUntil(sendOwnerLink(env, `${url.origin}/admin?k=${key}`).catch(e => console.error("owner link email failed", String(e))));
        }
        return linkPage(emailLinkPage("Sent. If this is set up, the link is on its way to the GigrAI inbox."));
      }
      return linkPage(emailLinkPage(""));
    }
    const rm = request.method === "GET" && url.pathname.match(/^\/report(?:\/([a-z0-9-]{1,40})(\.csv)?)?\/?$/);
    if (rm) {
      const k = url.searchParams.get("k") || "";
      const nocache = (res) => { const h = new Headers(res.headers); h.set("cache-control", "private, no-store"); h.set("x-robots-tag", "noindex"); return new Response(res.body, { status: res.status, headers: h }); };
      if (!rm[1]) {
        if (!(await keyOk(env, "owner", k))) return nocache(reportsOff(url.origin));
        const allTime = url.searchParams.get("days") === "all";
        let days = pickDays(url);
        let from = allTime ? "2000-01-01" : daysAgo(days - 1);
        const to = new Date().toISOString().slice(0, 10);
        const [views, applies, geo, ccViews, bots, flags, roles, pages, botnets, joins] = await Promise.all([readStats(env, { kind: "view", from }), readStats(env, { kind: "apply", from }), geoReport(env, from, to), countryTotals(env, "view", from, to), readStats(env, { kind: "bot", from }), flagged(env, from, to), topRoles(env, from, to), topPages(env, from, to), readStats(env, { kind: "botnet", from }), readStats(env, { kind: "join", from })]);
        if (allTime) { // from the day counting started
          from = (views && views.since) || to;
          days = Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1);
        }
        if (views) Object.assign(views, { from, to });
        const sponsors = allSponsors(await sponsorsCfg(env)).filter(s => s.id !== "example");
        const links = await Promise.all(sponsors.map(async s => `${url.origin}/report/${s.id}?k=${await signKey(env, "sponsor:" + s.id)}`));
        const used = await countMany(env, "sponsor_u", sponsors.map(s => ({ k: s.id, from: s.start || "2000-01-01" })));
        sponsors.forEach(s => { s._unique = used[s.id] || 0; s._cap = clickCap(s); });
        const db = content(env);
        const enquiries = db ? await db.listEnquiries(30) : [];
        // Opening the numbers page stops this device being counted (?count=1 turns counting back on)
        const countMe = url.searchParams.get("count") === "1";
        const chose = /(?:^|;\s*)gg_count=1(?:;|$)/.test(request.headers.get("cookie") || "");
        const hidden = countMe ? false : (isOwner(request) || url.searchParams.get("count") === "0" || (!nt && !chose));
        const page = withAdminNav(nocache(adminPage({ origin: url.origin, views, applies, sponsors, links, days, allTime, key: k, enquiries, geo, ccViews, bots, flags, hidden, roles, pages, botnets, joins })), k, "numbers");
        const secure = url.protocol === "https:" ? "; Secure" : "";
        if (countMe) {
          page.headers.append("set-cookie", `gg_nt=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`);
          page.headers.append("set-cookie", `gg_count=1; Path=/report; Max-Age=34560000; HttpOnly; SameSite=Lax${secure}`);
        } else if (hidden && !isOwner(request)) {
          page.headers.append("set-cookie", `gg_nt=${await signKey(env, "notrack")}; Path=/; Max-Age=34560000; HttpOnly; SameSite=Lax${secure}`);
          page.headers.append("set-cookie", `gg_count=; Path=/report; Max-Age=0; HttpOnly; SameSite=Lax${secure}`);
        }
        return page;
      }
      const sponsor = (await sponsorsCfg(env)).featured.find(s => s.id === rm[1]);
      if (!sponsor || !(await keyOk(env, "sponsor:" + sponsor.id, k))) return nocache(reportsOff(url.origin));
      const today = ukDay();
      const from = /^\d{4}-\d{2}-\d{2}$/.test(sponsor.start || "") ? sponsor.start : daysAgo(29);
      const to = (sponsor.until || today) < today ? sponsor.until : today;
      const empty = { total: 0, byDay: [], bySrc: [], byCountry: [] };
      const [stats, uniq] = await Promise.all([readStats(env, { kind: "sponsor", k: sponsor.id, from, to }), readStats(env, { kind: "sponsor_u", k: sponsor.id, from, to })]);
      const cap = clickCap(sponsor);
      const unique = (uniq || empty).total;
      const billing = cap ? { cpc: +sponsor.cpc, budget: +sponsor.budget, cap, billable: Math.min(unique, cap), spent: Math.min(unique, cap) * +sponsor.cpc } : null;
      if (rm[2]) {
        // CSV for invoices: one row per day
        const all = Object.fromEntries(((stats || empty).byDay).map(r => [r.day, r.n]));
        const u = Object.fromEntries(((uniq || empty).byDay).map(r => [r.day, r.n]));
        const days = [...new Set([...Object.keys(all), ...Object.keys(u)])].sort();
        const lines = ["date,unique_clicks,all_clicks", ...days.map(d => `${d},${u[d] || 0},${all[d] || 0}`), `total,${unique},${(stats || empty).total}`];
        if (billing) lines.push(`billable_clicks,${billing.billable},`, `price_per_click_gbp,${billing.cpc},`, `amount_gbp,${billing.spent.toFixed(2)},`);
        return new Response(lines.join("\n") + "\n", { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="gigrai-${sponsor.id}-${from}-to-${to}.csv"`, "cache-control": "private, no-store" } });
      }
      return nocache(sponsorReportPage({ origin: url.origin, sponsor, stats: stats || empty, uniq: uniq || empty, billing, from, to: to < from ? from : to, csv: `/report/${sponsor.id}.csv?k=${encodeURIComponent(k)}` }));
    }

    // ---- News: /news, /news/rss.xml, /news/<slug> ----
    if (request.method === "GET" && /^\/news\/?$/.test(url.pathname)) {
      const db = content(env);
      if (!db) return Response.redirect(new URL("/", url).toString(), 302);
      const cat = CATEGORIES.some(c => c.id === url.searchParams.get("cat")) ? url.searchParams.get("cat") : "";
      const page = Math.max(1, Math.min(50, parseInt(url.searchParams.get("page") || "1", 10) || 1));
      const perPage = 25;
      const [posts, list, fetched] = await Promise.all([db.listPosts({ cat, limit: 13 }), db.listNews({ cat, limit: perPage, offset: (page - 1) * perPage }), db.lastFetched()]);
      // Top up if the hourly job hasn't run for a while
      if (!fetched || Date.now() - Date.parse(fetched) > 2 * 3600e3) ctx.waitUntil(refreshNews(env));
      view("news");
      return decorate(newsIndex({ origin: url.origin, posts, news: list.rows, total: list.total, cat, page, perPage, fetched }), url, env, ctx, "/news");
    }
    if (request.method === "GET" && url.pathname === "/news/rss.xml") {
      const db = content(env);
      return postsRss(url.origin, db ? await db.listPosts({ limit: 30 }) : []);
    }
    const nm = request.method === "GET" && url.pathname.match(/^\/news\/([a-z0-9-]{1,80})\/?$/);
    if (nm) {
      const db = content(env);
      const post = db ? await db.getPost(nm[1]) : null;
      const preview = url.searchParams.get("preview") === "1" && (await keyOk(env, "owner", url.searchParams.get("k") || ""));
      if (!post || (post.status !== "published" && !preview)) return Response.redirect(new URL("/news", url).toString(), 302);
      const more = (await db.listPosts({ limit: 4 })).filter(p => p.slug !== post.slug).slice(0, 3);
      view("post", post.title);
      let roles = [];
      // roles from the platform the article is about (or its affiliate), otherwise good general roles
      const about = `${post.affiliate || ""} ${post.title} ${post.summary || ""}`.toLowerCase();
      try { roles = guideRoles({ slug: "news-" + post.slug, roles: ["micro1", "mercor", "ethos", "handshake"].find(p => about.includes(p)) || "general" }, await loadFeed(env, ctx)); } catch {}
      const res = postPage({ origin: url.origin, post, more, platforms: PLATFORM_CONFIG.platforms, preview: post.status !== "published", roles });
      if (post.status !== "published") { const h = new Headers(res.headers); h.set("cache-control", "private, no-store"); return new Response(res.body, { headers: h }); }
      return decorate(res, url, env, ctx, "/news");
    }

    // ---- Images uploaded in the editor: /media/<id>.<ext> ----
    const mm = request.method === "GET" && url.pathname.match(/^\/media\/([a-z0-9]{12,40})\.(webp|jpg|png|gif)$/);
    if (mm) {
      const db = content(env);
      const img = db ? await db.getImage(mm[1]) : null;
      if (!img) return new Response("Not found", { status: 404 });
      return new Response(img.data, { headers: { "content-type": img.type, "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" } });
    }

    // ---- Private blog editor: /admin?k=<owner key> ----
    if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) {
      return handleAdmin(request, url, env, ctx);
    }

    // ---- Platforms page and tracked sign-up links (/join/<platform>?src=...) ----
    if (request.method === "GET" && (url.pathname === "/platforms" || url.pathname === "/platforms/")) {
      let feed = [];
      try { feed = await loadFeed(env, ctx); } catch {}
      view("platforms");
      return decorate(platformsPage(feed, url.origin, PLATFORM_CONFIG.platforms, GUIDES), url, env, ctx, "/platforms");
    }
    const joinM = request.method === "GET" && url.pathname.match(/^\/join\/([a-z0-9-]{1,30})\/?$/);
    if (joinM) {
      const p = (PLATFORM_CONFIG.platforms || []).find(x => x.id === joinM[1] && x.active && /^https:\/\//.test(x.signupUrl || ""));
      const src = cleanSrc(url.searchParams.get("src")) || "site";
      console.log(JSON.stringify({ event: "link_click", link: "platform-" + joinM[1], src, country: request.cf?.country || "??" }));
      if (p && isHuman(request)) { track(env, ctx, request, "link", "platform-" + p.id, src); track(env, ctx, request, "join", p.id, src); } // "join" feeds the numbers page
      return Response.redirect(p ? p.signupUrl : new URL("/platforms", url).toString(), 302);
    }

    // ---- Guides: /guides and /guides/<slug> ----
    if (request.method === "GET" && (url.pathname === "/guides" || url.pathname === "/guides/")) {
      view("guides");
      return decorate(guidesIndex(GUIDES, url.origin), url, env, ctx, "/guides");
    }
    const gm = request.method === "GET" && url.pathname.match(/^\/guides\/([a-z0-9-]+)\/?$/);
    if (gm) {
      const g = GUIDES.find(x => x.slug === gm[1]);
      if (g) view("guides", g.title);
      if (g) {
        let roles = [];
        let feed = [];
        try { feed = await loadFeed(env, ctx); roles = guideRoles(g, feed); } catch {}
        // Guides marked live: "pay" get a pay table worked out from today's roles
        const page = g.live === "pay" ? { ...g, body: g.body.replace("<!--LIVE_PAY-->", livePayTable(feed)) } : g;
        return decorate(guidePage(page, GUIDES, url.origin, roles, PLATFORM_CONFIG.platforms), url, env, ctx, "/guides");
      }
      return Response.redirect(new URL("/guides", url).toString(), 301);
    }

    // ---- Role pages for Google: /jobs and /jobs/<id>/<slug> ----
    if (request.method === "GET" && (url.pathname === "/jobs" || url.pathname === "/jobs/")) {
      let feed;
      try { feed = await loadFeed(env, ctx); } catch { return Response.redirect(new URL("/", url).toString(), 302); }
      view("jobs");
      return decorate(jobsIndex(feed, url.origin, PLATFORM_CONFIG.platforms, await activeFeatured(env)), url, env, ctx, "/jobs");
    }
    const jm = request.method === "GET" && url.pathname.match(/^\/jobs\/([^/]+)(?:\/([^/]*))?\/?$/);
    if (jm) {
      const id = decodeURIComponent(jm[1]);
      if (!/^[a-z0-9]{1,30}-[A-Za-z0-9_-]{1,80}$/.test(id)) return decorate(roleGone(url.origin), url, env, ctx, "/jobs");
      let feed;
      try { feed = await loadFeed(env, ctx); } catch { return new Response("Live roles are unavailable right now. Please try again shortly.", { status: 503, headers: { "retry-after": "600" } }); }
      const j = feed.find(x => x.id === id);
      if (!j) return decorate(roleGone(url.origin), url, env, ctx, "/jobs");
      // One address per role: fix old or missing title slugs
      if (url.pathname !== jobPath(j)) return Response.redirect(new URL(jobPath(j), url).toString(), 301);
      view("role", `${j.title} (${j.via})`);
      return decorate(rolePage(j, feed, url.origin, PLATFORM_CONFIG.platforms, url.searchParams.get("from") || ""), url, env, ctx, "/jobs");
    }

    const res = await env.ASSETS.fetch(request);
    // Pages listed in wrangler.jsonc "run_worker_first" get Google tags and link previews added here
    const page = url.pathname.replace(/\/index\.html$/, "/").replace(/\.html$/, "");
    if (request.method === "GET" && (page === "/" || page === "/privacy") &&
        (res.headers.get("content-type") || "").includes("text/html")) {
      view(page === "/" ? "home" : "privacy");
      return decorate(res, url, env, ctx, page);
    }
    return res;
  },
};

// Security headers on every page and API response from the worker (static files get them from public/_headers)
const CSP = "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'";
function secure(res, url) {
  const r = new Response(res.body, res); // copy, so redirect/asset headers can be changed
  const h = r.headers;
  h.set("x-content-type-options", "nosniff");
  h.set("x-frame-options", "SAMEORIGIN");
  h.set("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  if (!h.has("content-security-policy")) h.set("content-security-policy", CSP);
  if (url.protocol === "https:") h.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  // private pages carry the owner key in the address, so never send it on as a referrer
  h.set("referrer-policy", /^\/(report|admin)/.test(url.pathname) ? "no-referrer" : "strict-origin-when-cross-origin");
  return r;
}

export default {
  scheduled: (event, env, ctx) => app.scheduled(event, env, ctx),
  async fetch(request, env, ctx) {
    return secure(await app.route(request, env, ctx), new URL(request.url));
  },
};

// ---------------- Google AdSense, Search Console and link previews ----------------
const text = (body, maxAge = 300) => new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": `public, max-age=${maxAge}` } });

// ADSENSE_CLIENT in wrangler.jsonc, e.g. "ca-pub-1234567890123456". Empty = no ads.
function adsenseClient(env) {
  const c = String(env.ADSENSE_CLIENT || "").trim();
  return /^ca-pub-\d{10,20}$/.test(c) ? c : "";
}
const adsensePub = (env) => adsenseClient(env).replace(/^ca-/, "");

const money = (j) => {
  const lo = j.min, hi = j.max;
  if (!lo && !hi) return "";
  return lo && hi && lo !== hi ? `$${lo}–${hi}/hr` : `$${lo || hi}/hr`;
};

async function decorate(res, url, env, ctx, page) {
  const client = adsenseClient(env);
  const verify = String(env.GOOGLE_SITE_VERIFICATION || "").trim().replace(/[^A-Za-z0-9_-]/g, "");

  // A shared role link (/?role=<id>) gets its own title and description in previews and on Google
  let meta = null;
  const roleId = page === "/" ? (url.searchParams.get("role") || "") : "";
  const q = page === "/" ? (url.searchParams.get("q") || "").trim().slice(0, 40) : "";
  if (/^[a-z0-9]{1,30}-[A-Za-z0-9_-]{1,80}$/.test(roleId)) {
    try {
      const j = (await loadFeed(env, ctx)).find(x => x.id === roleId);
      if (j) {
        const pay = money(j);
        meta = {
          title: `${j.title}${pay ? ` · ${pay}` : ""} · GigrAI`,
          desc: `${pay ? pay + " · " : ""}Remote · via ${j.via}. See the full details and apply free on GigrAI.`,
          canonical: url.origin + jobPath(j), // Google indexes the role's own page
        };
      }
    } catch {}
  } else if (q && /^[\p{L}\p{N} .+#&'-]+$/u.test(q)) {
    const nice = q.replace(/\s+/g, " ");
    meta = {
      title: `Remote ${nice} AI jobs · GigrAI`,
      desc: `Live remote AI jobs for "${nice}", with real pay rates. Search free and apply on the platform's own site.`,
      canonical: `${url.origin}/?q=${encodeURIComponent(nice.toLowerCase())}`,
    };
  }

  let rw = new HTMLRewriter().on("head", {
    element(el) {
      if (env.EMAIL_SIGNUP === "on") el.append(`<script src="/alerts.js?v=6" defer></script>`, { html: true });
      if (env.CHAT !== "off") el.append(`<script src="/chat.js?v=9" defer></script>`, { html: true });
      if (verify) el.append(`<meta name="google-site-verification" content="${verify}">`, { html: true });
      if (client) {
        el.append(`<meta name="google-adsense-account" content="${client}">`, { html: true });
        el.append(`<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}" crossorigin="anonymous"></script>`, { html: true });
      }
    },
  });
  // Privacy page: show the email section only once email alerts are switched on
  if (page === "/privacy") {
    const on = env.EMAIL_SIGNUP === "on";
    rw = rw.on(".if-email", { element(el) { if (on) el.removeAttribute("hidden"); else el.remove(); } })
      .on("[data-noemail]", { element(el) { if (on) el.remove(); } });
  }
  if (page === "/") {
    rw = rw.on("header.top .wrap", { element(el) { el.append(menuButton(), { html: true }); } })
      .on("body", { element(el) { el.append(drawerHtml(), { html: true }); } });
  }
  const feat = page === "/" ? await activeFeatured(env) : [];
  if (feat.length) rw = rw.on("#trust", { element(el) { el.after(featuredHtml(feat), { html: true }); } });
  if (meta) {
    rw = rw
      .on("title", { element(el) { el.setInnerContent(meta.title); } })
      .on('meta[name="description"], meta[property="og:description"], meta[name="twitter:description"]', { element(el) { el.setAttribute("content", meta.desc); } })
      .on('meta[property="og:title"], meta[name="twitter:title"]', { element(el) { el.setAttribute("content", meta.title); } })
      .on('meta[property="og:url"]', { element(el) { el.setAttribute("content", meta.canonical); } })
      .on('link[rel="canonical"]', { element(el) { el.setAttribute("href", meta.canonical); } });
  }
  const out = rw.transform(res);
  const headers = new Headers(out.headers);
  if (meta) headers.set("cache-control", "public, max-age=300");
  return new Response(out.body, { status: out.status, headers });
}

// Sitemap: homepage, privacy, popular searches and every live role
const SITEMAP_SEARCHES = ["writing", "coding", "research", "medical", "finance", "legal", "language", "maths", "photographer", "designer", "voice", "python"];
async function sitemap(url, env, ctx) {
  const o = url.origin;
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${o}/`, freq: "hourly", pri: "1.0" },
    { loc: `${o}/privacy`, freq: "monthly", pri: "0.3" },
    { loc: `${o}/jobs`, freq: "hourly", pri: "0.9" },
    { loc: `${o}/guides`, freq: "weekly", pri: "0.7" },
    { loc: `${o}/platforms`, freq: "daily", pri: "0.8" },
    { loc: `${o}/news`, freq: "hourly", pri: "0.8" },
    { loc: `${o}/advertise`, freq: "monthly", pri: "0.4" },
    { loc: `${o}/media-kit`, freq: "weekly", pri: "0.4" },
    { loc: `${o}/advertise/terms`, freq: "yearly", pri: "0.3" },
    ...GUIDES.map(g => ({ loc: `${o}/guides/${g.slug}`, freq: "monthly", pri: "0.8", mod: g.updated })),
    ...SITEMAP_SEARCHES.map(s => ({ loc: `${o}/?q=${encodeURIComponent(s)}`, freq: "daily", pri: "0.7" })),
  ];
  try {
    const db = content(env);
    if (db) for (const p of await db.listPosts({ limit: 200 })) urls.push({ loc: `${o}/news/${p.slug}`, freq: "weekly", pri: "0.7", mod: (p.updated || "").slice(0, 10) });
  } catch {}
  try {
    for (const j of await loadFeed(env, ctx)) {
      urls.push({ loc: o + jobPath(j), freq: "daily", pri: "0.6", mod: (j.posted || "").slice(0, 10) });
    }
  } catch {}
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map(u => `<url><loc>${esc(u.loc)}</loc><lastmod>${/^\d{4}-\d{2}-\d{2}$/.test(u.mod || "") ? u.mod : today}</lastmod><changefreq>${u.freq}</changefreq><priority>${u.pri}</priority></url>`).join("\n") +
    `\n</urlset>\n`;
  return new Response(body, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=1800" } });
}

// ---------------- live jobs from every platform in public/platforms.json ----------------
const FEED_TTL = 30 * 60; // seconds: refresh the job list at most every 30 mins
const PAGE_SIZE = 8;
const livePlatforms = () => (PLATFORM_CONFIG.platforms || []).filter(p => p.active && p.feed && p.feed.type);

// Each adapter turns one platform's job list into our standard job shape.
const ADAPTERS = {
  // micro1 public referral feed: every apply_url already carries the referral code
  async micro1(p, env) {
    const base = env.MICRO1_API || "https://prod-api.micro1.ai/api/v1";
    const code = p.feed.referralCode;
    const rows = [];
    for (let page = 1; page <= 6; page++) {
      const r = await fetch(`${base}/job/portal/referral/${code}/jobs?page=${page}&limit=100`, {
        headers: { accept: "application/json", "x-custom-lang": "en" },
      });
      if (!r.ok) throw new Error(`micro1 feed ${r.status}`);
      const body = await r.json();
      const data = Array.isArray(body.data) ? body.data : [];
      rows.push(...data);
      if (data.length < 100 || rows.length >= (body.total || 0)) break;
    }
    return rows.map(j => {
      const url = withReferral(j.apply_url, /(^|\.)micro1\.ai$/, u => u.searchParams.set("referralCode", code));
      if (!url || !j.job_name) return null;
      const hr = j.ideal_hourly_rate || {};
      return {
        id: `micro1-${j.job_id}`,
        title: String(j.job_name).trim(),
        min: hourlyOk(hr.min),
        max: hourlyOk(hr.max),
        skills: Array.isArray(j.skills) ? j.skills.slice(0, 8).map(String) : [],
        domain: pretty(j.domain_slug),
        posted: j.date_posted || null,
        hot: String(j.is_high_demand_job) === "1",
        url,
      };
    });
  },

  // Mercor public explore feed: one call returns every live listing
  async mercor(p, env) {
    const base = env.MERCOR_API || "https://aws.api.mercor.com/work";
    const code = p.feed.referralCode;
    const r = await fetch(`${base}/listings-explore-page`, { headers: { accept: "application/json" } });
    if (!r.ok) throw new Error(`mercor feed ${r.status}`);
    const body = await r.json();
    const slug = t => String(t).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 45).replace(/-+$/, "");
    return (body.listings || []).map(j => {
      if (!j || !j.listingId || !j.title) return null;
      if (j.status !== "active" || j.deletedAt || j.disableApplications || j.isPrivate) return null;
      if (!/^[A-Za-z0-9_-]+$/.test(j.listingId)) return null;
      const url = `https://work.mercor.com/jobs/${encodeURIComponent(j.listingId)}/${slug(j.title)}?referralCode=${encodeURIComponent(code)}&utm_source=referral`;
      const hourly = (j.payRateFrequency || "hourly") === "hourly";
      const lo = +j.rateMin > 0 ? +j.rateMin : null, hi = +j.rateMax > 0 ? +j.rateMax : null;
      const tags = [];
      const list = v => Array.isArray(v) ? v.filter(Boolean).map(c => String(c).toUpperCase()) : [];
      const where = list(j.eligibleLocation), res = list(j.eligibleResidenceLocation);
      const only = where.length ? where : res;
      const deny = [...new Set([...list(j.ineligibleLocation), ...list(j.ineligibleResidenceLocation)])];
      if (only.length) tags.push(only.length > 2
        ? `${only.slice(0, 2).map(countryName).join(", ")} +${only.length - 2} more`
        : `${only.map(countryName).join(", ")} only`);
      else tags.push("Most countries");
      if (+j.hoursPerWeek > 0) tags.push(`${+j.hoursPerWeek} hrs/wk`);
      if (!hourly && (lo || hi)) tags.push(`$${lo || hi}${hi && lo && hi !== lo ? `–$${hi}` : ""}/${String(j.payRateFrequency).replace(/ly$/, "").replace(/^dai$/, "day")}`);
      return {
        id: `mercor-${j.listingId}`,
        title: String(j.title).replace(/\s+/g, " ").trim(),
        min: hourly ? lo : null,
        max: hourly ? hi : null,
        skills: tags,
        domain: j.listingDomain ? String(j.listingDomain) : "",
        posted: (j.postedAt || j.createdAt || "").replace("T", " ").slice(0, 19) || null,
        hot: false,
        known: true, allow: only, deny,
        hours: +j.hoursPerWeek > 0 ? +j.hoursPerWeek : null,
        kind: hourly ? "Hourly" : "Contract",
        slots: +j.remainingSlots > 0 && +j.remainingSlots <= 5 ? +j.remainingSlots : null,
        desc: plainText(j.description),
        url,
      };
    });
  },

  // Greenhouse public job boards (e.g. Alignerr). No pay data in this feed.
  // Greenhouse public job board. feed: { type: "greenhouse", board, include: "regex on title", applyVia: "listing" | "signup" }
  async greenhouse(p, env) {
    const base = env.GREENHOUSE_API || "https://boards-api.greenhouse.io/v1";
    const r = await fetch(`${base}/boards/${encodeURIComponent(p.feed.board)}/jobs?content=true`, { headers: { accept: "application/json" } });
    if (!r.ok) throw new Error(`greenhouse ${p.feed.board} ${r.status}`);
    const body = await r.json();
    const viaSignup = p.feed.applyVia !== "listing";
    const inc = p.feed.include ? new RegExp(p.feed.include, "i") : null;
    return (body.jobs || []).filter(j => j.title && (!inc || inc.test(j.title))).map(j => {
      const url = viaSignup ? p.signupUrl : listingUrl(j.absolute_url);
      if (!url) return null;
      const loc = j.location && j.location.name ? String(j.location.name) : "";
      const desc = htmlText(j.content || "");
      const [min, max] = payFromText(desc);
      const cc = countriesFromText(loc);
      return {
        id: `${p.id}-${j.id}`, title: String(j.title).trim(), min, max,
        skills: loc ? [loc] : [], domain: p.feed.domain || "",
        posted: (j.first_published || j.updated_at || "").replace("T", " ").slice(0, 19) || null,
        hot: false, url, desc: desc.slice(0, 4000),
        ...(cc.length ? { known: true, allow: cc, deny: [] } : {}),
      };
    });
  },
  // Lever public postings. feed: { type: "lever", board, include: "regex on title" }
  async lever(p, env) {
    const base = env.LEVER_API || "https://api.lever.co/v0";
    const r = await fetch(`${base}/postings/${encodeURIComponent(p.feed.board)}?mode=json`, { headers: { accept: "application/json" } });
    if (!r.ok) throw new Error(`lever ${p.feed.board} ${r.status}`);
    const list = await r.json();
    const inc = p.feed.include ? new RegExp(p.feed.include, "i") : null;
    return (Array.isArray(list) ? list : []).filter(j => j.text && (!inc || inc.test(j.text))).map(j => {
      const url = listingUrl(j.hostedUrl || j.applyUrl);
      if (!url) return null;
      const desc = String(j.descriptionPlain || htmlText(j.description || "")).replace(/\s+\n/g, "\n").trim();
      const sr = j.salaryRange || {};
      let [min, max] = /hour/i.test(sr.interval || "") && /usd/i.test(sr.currency || "USD") ? [hourlyOk(Math.round(sr.min)), hourlyOk(Math.round(sr.max))] : payFromText(desc);
      const iso3 = ISO3[String(j.country || "").toUpperCase()];
      const cc = iso3 ? [iso3] : countriesFromText((j.categories && j.categories.location) || "");
      const loc = (j.categories && j.categories.location) || "";
      return {
        id: `${p.id}-${j.id}`, title: String(j.text).trim(), min: min || null, max: max || null,
        skills: loc ? [loc] : [], domain: p.feed.domain || "",
        posted: j.createdAt ? new Date(j.createdAt).toISOString().replace("T", " ").slice(0, 19) : null,
        hot: false, url, desc: desc.slice(0, 4000),
        ...(cc.length ? { known: true, allow: cc, deny: [] } : {}),
      };
    });
  },
};

// ISO 3166 alpha-3 -> short name for the common ones; others shown as the code
const ISO3 = { GB:"GBR", US:"USA", CA:"CAN", IE:"IRL", AU:"AUS", NZ:"NZL", IN:"IND", NG:"NGA", ZA:"ZAF", KE:"KEN", GH:"GHA", UG:"UGA", ET:"ETH", EG:"EGY", MA:"MAR", DE:"DEU", FR:"FRA", ES:"ESP", IT:"ITA", PT:"PRT", NL:"NLD", BE:"BEL", LU:"LUX", CH:"CHE", AT:"AUT", SE:"SWE", NO:"NOR", DK:"DNK", FI:"FIN", IS:"ISL", PL:"POL", CZ:"CZE", SK:"SVK", HU:"HUN", RO:"ROU", BG:"BGR", GR:"GRC", HR:"HRV", SI:"SVN", RS:"SRB", EE:"EST", LV:"LVA", LT:"LTU", UA:"UKR", TR:"TUR", CY:"CYP", MT:"MLT", AE:"ARE", SA:"SAU", QA:"QAT", IL:"ISR", PK:"PAK", BD:"BGD", LK:"LKA", NP:"NPL", PH:"PHL", SG:"SGP", MY:"MYS", ID:"IDN", TH:"THA", VN:"VNM", JP:"JPN", KR:"KOR", CN:"CHN", HK:"HKG", TW:"TWN", BR:"BRA", MX:"MEX", AR:"ARG", CO:"COL", CL:"CHL", PE:"PER", JM:"JAM", TT:"TTO", BB:"BRB" };
const COUNTRY = { USA: "US", GBR: "UK", CAN: "Canada", AUS: "Australia", IND: "India", DEU: "Germany", FRA: "France", ESP: "Spain", ITA: "Italy", NLD: "Netherlands", IRL: "Ireland", NZL: "New Zealand", BRA: "Brazil", MEX: "Mexico", PHL: "Philippines", NGA: "Nigeria", ZAF: "South Africa", KEN: "Kenya", JPN: "Japan", KOR: "South Korea", CHN: "China", SGP: "Singapore", ARE: "UAE", PAK: "Pakistan", EGY: "Egypt", POL: "Poland", PRT: "Portugal", SWE: "Sweden", ARG: "Argentina", COL: "Colombia" };
const countryName = c => COUNTRY[String(c).toUpperCase()] || String(c).toUpperCase();

// Is this job open to someone in `country` (ISO alpha-3)? "unknown" when the platform doesn't say.
function eligibility(j, country) {
  if (!j.known) return "unknown";
  if ((j.deny || []).includes(country)) return "no";
  if ((j.allow || []).length && !j.allow.includes(country)) return "no";
  return "yes";
}
// Email us about a new booking request (Cloudflare Email Routing, to our own verified inbox)
async function notifyEnquiry(env, ref, e, vet) {
  if (!env.NOTIFY) return;
  const from = "partners@remotegigrai.com", to = env.NOTIFY_TO || "remotegigr.ai@gmail.com";
  const flag = vet.result === "pass" ? "Link check: passed" : `Link check: NEEDS A LOOK\n- ${vet.warns.join("\n- ")}`;
  const body = [
    `New booking request ${ref}`, "",
    `Company: ${e.company}`, `Contact: ${e.name} <${e.email}>`, `Website: ${e.site || "-"}`, "",
    `Option: ${e.option}${e.budget ? ` (budget £${e.budget})` : ""}`, `Start: ${e.start}`,
    `Role: ${e.role}`, `Pay: ${e.pay || "-"}`, `Link: ${e.url}`, vet.finalUrl && vet.finalUrl !== e.url ? `Ends up at: ${vet.finalUrl}` : "",
    "", flag, "", `Notes: ${e.notes || "-"}`, "",
    "Reply to this email to answer them directly. All requests: your private dashboard (/report).",
  ].filter(x => x !== null).join("\r\n");
  const subj = `New booking: ${e.company} (${e.option})${vet.result === "warn" ? " - check link" : ""}`;
  const b64 = (str) => btoa(String.fromCharCode(...new TextEncoder().encode(str)));
  const raw = [
    `From: GigrAI bookings <${from}>`, `To: ${to}`, `Reply-To: ${e.email.replace(/[^\w.@+-]/g, "")}`,
    `Subject: =?UTF-8?B?${b64(subj)}?=`, `Message-ID: <${ref}.${Date.now()}@remotegigrai.com>`, `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0", "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: base64", "", b64(body).replace(/.{76}/g, "$&\r\n"),
  ].join("\r\n");
  await env.NOTIFY.send(new EmailMessage(from, to, raw));
}

// Live pay by field, from today's roles (for /guides/ai-trainer-pay)
const PAY_FIELDS = [
  ["Medicine and health", /medic|health|nurs|doctor|physician|clinic|pharmac|dent|radiolog|psychiatr|surgeon|therap/i],
  ["Law", /\blaw|legal|attorney|lawyer|paralegal|solicitor|barrister/i],
  ["Finance and accounting", /financ|account|bank|invest|\btax|audit|econom|actuar/i],
  ["Coding and software", /software|engineer|develop|coding|\bcode|python|javascript|typescript|programm|data scien|machine learning|devops/i],
  ["Maths and science", /math|physic|chemist|biolog|scien|statistic/i],
  ["Languages and translation", /translat|language|linguist|spanish|french|german|arabic|hindi|portuguese|japanese|chinese|mandarin|korean|italian|dutch|polish|turkish|swahili|yoruba/i],
  ["Writing and general", /./],
];
function livePayTable(feed) {
  const paid = (feed || []).filter(j => j.min || j.max);
  if (paid.length < 5) return `<p>Live pay data isn't available right now. <a href="/">Search live roles</a> to see current rates.</p>`;
  const groups = PAY_FIELDS.map(([name]) => ({ name, lo: [], hi: [] }));
  for (const j of paid) {
    const text = `${j.title} ${j.domain || ""}`;
    const i = PAY_FIELDS.findIndex(([, re]) => re.test(text));
    groups[i].lo.push(j.min || j.max); groups[i].hi.push(j.max || j.min);
  }
  const med = (a) => { const b = a.slice().sort((x, y) => x - y); const m = b.length >> 1; return Math.round(b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2); };
  const rows = groups.filter(g => g.hi.length).sort((a, b) => med(b.hi) - med(a.hi)).map(g => {
    const lo = med(g.lo), hi = med(g.hi);
    return `<tr><th>${g.name}</th><td>${lo === hi ? `$${lo}/hr` : `$${lo} to $${hi}/hr`}</td><td>$${Math.max(...g.hi)}/hr</td><td>${g.hi.length}</td></tr>`;
  }).join("");
  const day = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
  return `<div class="tbl"><table><thead><tr><th>Field</th><th>Typical pay</th><th>Highest</th><th>Live roles</th></tr></thead><tbody>${rows}</tbody></table></div>
<p class="note">Worked out from ${paid.length} live roles with pay shown on GigrAI, ${day}. "Typical pay" is the middle of the advertised ranges. Updates automatically as roles change.</p>`;
}

// 3 live roles for the end of a guide: the guide's platform first, roles most people can do, best pay
const EXPERT = /doctor|nurs|physician|medical|clinic|lawyer|attorney|legal|paralegal|dentist|pharmac|phd|professor|surgeon|radiolog|psychiatr/i;
const EASY = /generalist|writ|editor|annotat|evaluat|rater|review|tester|english|content|quality|data label/i;
// ---- Role cards on guides: each guide has its own filter (roles: in guides.js) ----
// Roles come from the live feed on every page load (refreshed every 30 minutes), so closed roles drop off by themselves.
// The cards also rotate daily: each guide picks 3 from its best ~9 matches, so returning readers see new roles.
const BEGINNER = /generalist|writer|writing|editor|annotat|evaluat|rater|rating|tester|transcri|translat|language|native|bilingual|fluent|content|data label|labell?er|chat|tutor|english|voice|speaker/i;
const SENIOR = /senior|principal|\blead\b|staff|scientist|phd|professor|expert|specialist|engineer|developer|architect|manager|director|consultant|research|analyst|clinical|python|software|coding|\bcode/i;
const dedupe = (list, n) => { const out = [], seen = new Set(); for (const j of list) { const k = j.title.toLowerCase().replace(/\s*\d+$/, ""); if (seen.has(k)) continue; seen.add(k); out.push(j); if (out.length >= n) break; } return out; };
// Pick 3 of the top matches, changing each day (same for everyone on a given day)
function rotate(list, n = 3, salt = "") {
  if (list.length <= n) return list;
  const pool = list.slice(0, Math.max(n, Math.min(list.length, n * 3)));
  const day = Math.floor(Date.now() / 864e5);
  let h = 0; for (const c of salt) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const start = (day + h) % pool.length;
  return Array.from({ length: n }, (_, i) => pool[(start + i * Math.max(1, Math.floor(pool.length / n))) % pool.length]).filter((j, i, a) => a.indexOf(j) === i);
}
const payOf = (j) => j.max || j.min || 0;
function guideRoles(g, feed) {
  const paid = feed.filter(j => j.min || j.max);
  const mode = g.roles || "general";
  const byScore = (list, score) => dedupe(list.slice().sort((a, b) => score(b) - score(a)), 9);
  let pool;
  if (mode === "beginner") {
    // only roles anyone can try; lower barrier first. Empty is fine: no cards beats unsuitable ones
    pool = byScore(paid.filter(j => BEGINNER.test(j.title) && (!SENIOR.test(j.title) || /voice record/i.test(j.title)) && !EXPERT.test(j.title)),
      j => (j.hot ? 1 : 0) + (/generalist|rater|evaluat|annotat/i.test(j.title) ? 1 : 0) - Math.max(0, ((j.min || j.max) - 60) / 20));
  } else if (mode === "top-pay") {
    // the best-paid role in different fields, to back up a pay guide
    const seenField = new Set(); const top = [];
    for (const j of paid.slice().sort((a, b) => payOf(b) - payOf(a))) {
      const f = (PAY_FIELDS.find(([, re]) => re.test(`${j.title} ${j.domain || ""}`)) || ["x"])[0];
      if (seenField.has(f)) continue; seenField.add(f); top.push(j);
    }
    return dedupe(top, 3);
  } else if (mode === "mix") {
    // a guide comparing platforms: the best role from each of them
    const plats = g.platforms || ["micro1", "mercor"];
    const best = (id) => byScore(paid.filter(j => j.platform === id), j => (EASY.test(j.title) ? 2 : 0) - (EXPERT.test(j.title) ? 2 : 0) + (j.hot ? 1 : 0) + Math.min(2, payOf(j) / 50));
    const lists = plats.map(id => rotate(best(id), 2, g.slug + id));
    const out = []; for (let i = 0; out.length < 3 && i < 3; i++) for (const l of lists) if (l[i] && out.length < 3) out.push(l[i]);
    return out;
  } else {
    // "micro1" / "mercor" / "ethos" = that platform only; "general" = any platform, roles most people can do, good pay
    const only = ["micro1", "mercor", "ethos", "handshake"].includes(mode) ? paid.filter(j => j.platform === mode) : paid;
    pool = byScore(only, j => (EASY.test(j.title) ? 3 : 0) - (EXPERT.test(j.title) ? 4 : 0) + (j.hot ? 1 : 0) + Math.min(2, payOf(j) / 50));
  }
  return rotate(pool, 3, g.slug);
}

// ---------------- GigrAI assistant ----------------
const CHAT_HITS = new Map();
function chatTooMany(request) {
  const ip = request.headers.get("cf-connecting-ip") || "?";
  const now = Date.now(), list = (CHAT_HITS.get(ip) || []).filter(t => now - t < 3600e3);
  list.push(now); CHAT_HITS.set(ip, list);
  if (CHAT_HITS.size > 5000) CHAT_HITS.clear();
  return list.filter(t => now - t < 60e3).length > 6 || list.length > 40; // 6 a minute, 40 an hour
}

function chatRoles(feed, text, country) {
  const { words, minpay } = parseAsk(text);
  const groups = words.map(expand);
  const forMe = country && /my country|where i live|near me|my area|open to me|can i apply|from (the )?(uk|us|usa|india|nigeria|canada|kenya|philippines)/i.test(text);
  const top = /highest|top pay|best pay|best paid|most money|pays? (the )?most|latest|newest|any roles|show me (some )?roles/i.test(text);
  const scored = [];
  for (const j of feed) {
    if (country && eligibility(j, country) === "no") continue;
    if (forMe && eligibility(j, country) !== "yes") continue;
    if (minpay && (j.max || j.min || 0) < minpay) continue;
    const title = j.title.toLowerCase();
    const score = groups.reduce((n, alts) => n + (alts.some(a => title.includes(a)) ? 2 : matches(j, [alts]) ? 1 : 0), 0); // title matches count double
    if (groups.length && !score) continue;
    if (!groups.length && !minpay && !forMe && !top) continue; // nothing to search for (e.g. "is this legit?")
    scored.push({ j, score });
  }
  scored.sort((a, b) => b.score - a.score || (b.j.max || b.j.min || 0) - (a.j.max || a.j.min || 0) || (b.j.posted || "").localeCompare(a.j.posted || ""));
  return scored.slice(0, 4).map(({ j }) => ({
    id: j.id, title: j.title, via: j.via, pay: money(j), path: jobPath(j),
    elig: country ? eligibility(j, country) : "", hot: !!j.hot,
  }));
}

async function handleChat(request, url, env, ctx) {
  if (env.CHAT === "off") return json({ ok: false, error: "The assistant is switched off." }, 404);
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).host !== url.host) return json({ ok: false, error: "Forbidden" }, 403);
  if (chatTooMany(request)) return json({ ok: false, error: "You've sent a lot of messages. Please wait a few minutes and try again." }, 429);
  let d;
  try { d = JSON.parse((await request.text()).slice(0, 12000)); } catch { return json({ ok: false, error: "Bad request" }, 400); }
  const msgs = (Array.isArray(d.messages) ? d.messages : []).slice(-8)
    .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map(m => ({ role: m.role, content: m.content.trim().slice(0, 600) }));
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return json({ ok: false, error: "Please type a question." }, 400);
  const iso2 = String(request.cf?.country || "").toUpperCase();
  const country = /^[A-Z]{3}$/.test(d.country || "") ? d.country : (ISO3[iso2] || "");
  const question = msgs[msgs.length - 1].content;

  let feed = [];
  try { feed = await loadFeed(env, ctx); } catch {}
  // Search with the latest message; if it has nothing to search for, use the one before ("any that pay more?")
  let roles = chatRoles(feed, question, country);
  if (!roles.length && msgs.length >= 3 && /\b(more|other|another|else|similar|those|them|higher|better|cheaper|instead)\b/i.test(question)) roles = chatRoles(feed, msgs[msgs.length - 3].content + " " + question, country);

  const cap = Math.max(0, parseInt(env.CHAT_DAILY_CAP || "150", 10) || 0);
  const used = (await countMany(env, "chat", [{ k: "reply", from: new Date().toISOString().slice(0, 10) }])).reply || 0;
  const src = cleanSrc(url.searchParams.get("src"));
  const fallback = roles.length
    ? "I can't write a full answer right now, but here are live roles that match what you asked."
    : "I can't answer right now. Try the job search at /jobs, our guides at /guides, or ask on our WhatsApp channel.";
  if (cap && used >= cap) {
    track(env, ctx, request, "chat", "capped", src);
    return json({ ok: true, reply: fallback, roles, limited: true });
  }
  try {
    const { reply, provider } = await askAi(env, systemPrompt({ roles, country: country ? countryName(country) : "", total: feed.length }), msgs);
    track(env, ctx, request, "chat", "reply", src);
    return json({ ok: true, reply: reply.trim().slice(0, 1500), roles, provider });
  } catch (e) {
    console.error("chat failed", String(e));
    track(env, ctx, request, "chat", "failed", src);
    return json({ ok: true, reply: fallback, roles, limited: true });
  }
}

// ---- our own double opt-in with MailerLite ----
const ML = (env) => env.MAILERLITE_API || "https://connect.mailerlite.com/api";
const mlHeaders = (env) => ({ "content-type": "application/json", accept: "application/json", authorization: `Bearer ${env.MAILERLITE_TOKEN}` });
async function mlGet(env, email) {
  const r = await fetch(`${ML(env)}/subscribers/${encodeURIComponent(email)}`, { headers: mlHeaders(env) });
  return r.ok ? (await r.json()).data : null;
}
// New sign-up: save details + a confirm code, put them in "pending" (which sends our confirmation email)
async function mlConfirmSignup(env, email, fields, ip) {
  const existing = await mlGet(env, email);
  const inMain = existing && existing.status === "active" && (existing.groups || []).some(g => String(g.id) === String(env.MAILERLITE_GROUP_ID));
  if (inMain) return { ok: true, already: true }; // already subscribed and confirmed
  const token = await signKey(env, "confirm:" + email);
  const r = await fetch(`${ML(env)}/subscribers`, { method: "POST", headers: mlHeaders(env),
    body: JSON.stringify({ email, fields: { ...fields, confirm_token: token }, status: "active", resubscribe: true, ip_address: ip }) });
  if (!r.ok) { console.error("MailerLite signup", r.status, (await r.text()).slice(0, 300)); return { ok: false, status: r.status }; }
  const id = (await r.json()).data.id;
  const g = `${ML(env)}/subscribers/${id}/groups/${env.MAILERLITE_PENDING_GROUP_ID}`;
  if (existing && (existing.groups || []).some(x => String(x.id) === String(env.MAILERLITE_PENDING_GROUP_ID))) await fetch(g, { method: "DELETE", headers: mlHeaders(env) }); // re-join resends the email
  const a = await fetch(g, { method: "POST", headers: mlHeaders(env) });
  if (!a.ok) { console.error("MailerLite pending group", a.status); return { ok: false, status: a.status }; }
  return { ok: true };
}
// Confirmed: add to the main group (starts the welcome series) and take them out of "pending"
async function mlConfirmDone(env, email) {
  const r = await fetch(`${ML(env)}/subscribers`, { method: "POST", headers: mlHeaders(env),
    body: JSON.stringify({ email, fields: { confirmed_at: new Date().toISOString(), confirm_token: "" }, groups: [String(env.MAILERLITE_GROUP_ID)], status: "active" }) });
  if (!r.ok) throw new Error(`MailerLite ${r.status}`);
  const id = (await r.json()).data.id;
  await fetch(`${ML(env)}/subscribers/${id}/groups/${env.MAILERLITE_PENDING_GROUP_ID}`, { method: "DELETE", headers: mlHeaders(env) });
}

// Email the private numbers-page link to our own inbox (Cloudflare Email Routing)
// ---- Admin menu (on every private page) and admin home ----
const ADMIN_LINKS = [["home", "Home", "/admin"], ["numbers", "Numbers", "/report"], ["sponsored", "Sponsored", "/admin/sponsored"], ["roles", "Add roles", "/admin/roles"], ["blog", "Blog", "/admin/blog"], ["weekly", "Weekly email", "/report-weekly"]];
function adminNavHtml(k, active) {
  const q = encodeURIComponent(k);
  return `<style>.anav{position:sticky;top:76px;z-index:30;display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin:6px 0 4px;padding:6px;border-radius:999px;background:rgba(13,16,36,.85);border:1px solid rgba(255,255,255,.1);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}.anav::-webkit-scrollbar{display:none}
.anav a{flex:none;padding:9px 15px;border-radius:999px;color:#c9cfee;text-decoration:none;font-weight:700;font-size:14px;white-space:nowrap}.anav a:hover{background:rgba(255,255,255,.07);color:#fff}.anav a.on{background:linear-gradient(110deg,#22d3ee,#2f6bff 55%,#8b3dff);color:#fff}
@media (max-width:700px){.anav{top:68px}}</style>
<nav class="anav" aria-label="Admin">${ADMIN_LINKS.map(([id, label, path]) => `<a href="${path}?k=${q}"${id === active ? ' class="on" aria-current="page"' : ""}>${label}</a>`).join("")}</nav>`;
}
function withAdminNav(res, k, active) {
  if (!k || !(res.headers.get("content-type") || "").includes("text/html")) return res;
  let done = false;
  return new HTMLRewriter().on("#main > .wrap", { element(el) { if (!done) { done = true; el.prepend(adminNavHtml(k, active), { html: true }); } } }).transform(res);
}

async function adminDashboard(env, ctx, k, url) {
  const e = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const q = encodeURIComponent(k), today = ukDay(), utcToday = new Date().toISOString().slice(0, 10);
  const db = content(env);
  const [live, tv, ta, ts, feed, cfg, enq, added, sentWeekly] = await Promise.all([
    liveNow(env), readStats(env, { kind: "view", from: utcToday }), readStats(env, { kind: "apply", from: utcToday }), readStats(env, { kind: "signup", from: utcToday }),
    loadFeed(env, ctx).catch(() => []), sponsorsCfg(env), db ? db.listEnquiries(30).catch(() => []) : [], db ? db.listRoles().catch(() => []) : [], meta(env, "weekly_sent"),
  ]);
  const sp = cfg.featured.filter(f => f.id !== "example");
  const liveSp = sp.filter(f => !f.ended && f.start <= today && f.until >= today), soonSp = sp.filter(f => !f.ended && f.start > today);
  const newEnq = enq.filter(x => x.status === "new");
  const expiring = added.filter(r => r.expires <= ukDay(7));
  const nextMon = (() => { for (let i = 0; i < 8; i++) { const d = ukDay(i); if (new Date(d + "T12:00:00Z").getUTCDay() === 1 && (i > 0 || sentWeekly !== d)) return d; } return ""; })();
  const nice = (d) => d ? new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }) : "–";
  const stat = (n, label) => `<div class="ds"><b>${(n ?? 0).toLocaleString("en-GB")}</b><span>${label}</span></div>`;
  const tile = (path, icon, title, line, alert = "") => `<a class="dt" href="${path}?k=${q}"><span class="di">${icon}</span><span class="dtt">${title}${alert ? `<i>${alert}</i>` : ""}</span><span class="dl">${line}</span></a>`;
  const todo = [
    ...newEnq.slice(0, 3).map(x => `<li>📩 New booking: <b>${e(x.data.company)}</b> · ${e(x.data.option)} · starts ${e(x.data.start)} · <a href="/admin/sponsored?k=${q}&from=${e(x.ref)}">Paid? Set up →</a></li>`),
    ...soonSp.slice(0, 3).map(f => `<li>🗓️ Sponsored <b>${e(f.title)}</b> (${e(f.company)}) goes live ${nice(f.start)}</li>`),
    ...liveSp.filter(f => f.until <= ukDay(2)).map(f => `<li>⏳ Sponsored <b>${e(f.title)}</b> ends ${nice(f.until)}: offer them another week?</li>`),
    ...expiring.slice(0, 3).map(r => `<li>⌛ Added role <b>${e(r.title)}</b> expires ${nice(r.expires)} · <a href="/admin/roles?k=${q}">Check →</a></li>`),
  ];
  const body = `<style>
.dash{display:grid;gap:18px}.dstats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}
.ds{padding:16px;border-radius:18px;background:var(--glass);border:1px solid var(--line)}.ds b{display:block;font-size:30px;font-weight:800;letter-spacing:-.02em}.ds span{color:var(--muted);font-size:13.5px}
.dtiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr));gap:12px}
.dt{display:grid;gap:6px;padding:18px;border-radius:20px;background:var(--glass);border:1px solid var(--line);text-decoration:none;color:var(--text);transition:transform .15s,border-color .15s}
.dt:hover{transform:translateY(-2px);border-color:rgba(91,140,255,.6)}.di{font-size:26px}.dtt{font-weight:800;font-size:18px;display:flex;gap:8px;align-items:center}.dtt i{font-style:normal;font-size:12px;padding:2px 9px;border-radius:999px;background:#ff6b6b;color:#fff}
.dl{color:var(--muted);font-size:14px;line-height:1.5}.dtodo{margin:0;padding:16px 18px;list-style:none;display:grid;gap:10px;border-radius:18px;background:var(--glass);border:1px solid var(--line)}.dtodo li{font-size:14.5px;line-height:1.5}.dtodo a{color:#9fdcf0}
</style><div class="dash">
<section class="hero sm" style="padding-bottom:0"><span class="eyebrow"><i></i>Private · only for you</span><h1>GigrAI <span class="grad-text">admin</span></h1><p>Everything in one place. Bookmark this page.</p></section>
<div class="dstats">${stat(live && live.total, "on the site now")}${stat(tv && tv.total, "page views today")}${stat(ta && ta.total, "apply clicks today")}${stat(ts && ts.total, "email sign-ups today")}${stat(feed.length, "live roles")}</div>
<section><h2 style="margin:6px 0 10px">To do</h2>${todo.length ? `<ul class="dtodo">${todo.join("")}</ul>` : `<p class="note" style="margin:0">Nothing needs you right now. 👌</p>`}</section>
<div class="dtiles">
${tile("/report", "📊", "Numbers", "Live map, visitors, clicks, popular pages, bots and booking requests.")}
${tile("/admin/sponsored", "⭐", "Sponsored listings", `${liveSp.length} live${soonSp.length ? ` · ${soonSp.length} scheduled` : ""}. Set up paid listings with dates and click reports.`, newEnq.length ? `${newEnq.length} new` : "")}
${tile("/admin/roles", "➕", "Add roles", `${added.length} added role${added.length === 1 ? "" : "s"} live. Add roles you find, with an expiry date.`, expiring.length ? `${expiring.length} expiring` : "")}
${tile("/admin/blog", "📝", "Blog and news", "Write posts, publish news, hide headlines.")}
${tile("/report-weekly", "📧", "Weekly email", `Next send ${nice(nextMon)}, 9am. ${sentWeekly ? `Last sent ${nice(sentWeekly)}.` : "Not sent yet."} Preview it here.`)}
<a class="dt" href="/" target="_blank"><span class="di">🌐</span><span class="dtt">View the site</span><span class="dl">Opens remotegigrai.com in a new tab.</span></a>
</div></div>`;
  return html(shellPage({ title: "Admin · GigrAI", desc: "Private.", canonical: "", robots: "noindex,nofollow", body }));
}

// ---- /admin/sponsored: paid listings with dates ----
function adminSponsoredPage({ k, rows, used, links, prefill, origin, msg }) {
  const e = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const today = ukDay();
  const pf = prefill || {};
  const status = (r) => (r.ended || r.until < today) ? ["Ended", "#9aa3c7"] : r.start > today ? ["Scheduled", "#ffe0a3"] : (clickCap(r) && (used[r.id] || 0) >= clickCap(r)) ? ["Budget used", "#ffb3b3"] : ["Live", "#9ff0c5"];
  const fileRows = (SPONSORED.featured || []).filter(x => x.id !== "example");
  const card = (r, fromFile) => { const [st, col] = status(r); const cap = clickCap(r); return `<div class="sp">
<div class="sp-h"><b>${e(r.title)}</b><span class="badge" style="color:${col};border-color:${col}">${st}</span></div>
<div class="sp-m">${e(r.company)} · ${e(r.option || "Featured")} · ${e(r.start)} → ${e(r.until)}${r.pin !== false ? " · pinned on site" : " · posts only"}${r.ref ? " · " + e(r.ref) : ""}${fromFile ? " · (set in sponsored.json)" : ""}</div>
<div class="sp-m">Unique clicks: <b>${used[r.id] || 0}</b>${cap ? ` of ${cap} paid for (£${(+r.cpc).toFixed(2)}/click, £${r.budget} budget)` : ""}</div>
${links[r.id] ? `<label>Report link to send them<input readonly value="${e(links[r.id])}" onclick="this.select()"></label>` : ""}
<div class="sp-m">Instagram link: <code>${e(origin)}/go/sponsored-${e(r.id)}?src=ig</code><br>WhatsApp link: <code>${e(origin)}/go/sponsored-${e(r.id)}?src=wa</code></div>
${fromFile ? "" : `<form method="post" class="sp-a"><input type="hidden" name="k" value="${e(k)}">${st === "Live" || st === "Budget used" ? `<button class="b tiny danger" name="end" value="${e(r.id)}">End now</button>` : ""}${st === "Scheduled" ? `<button class="b tiny danger" name="delete" value="${e(r.id)}">Delete</button>` : ""}</form>`}</div>`; };
  const opts = AD_OPTIONS.map(o => `<option value="${e(o.name)}" ${pf.option === o.name ? "selected" : ""}>${e(o.name)} (${e(o.price)}${o.per ? " " + e(o.per) : ""})</option>`).join("");
  const body = `<style>
.adm{display:grid;gap:14px;max-width:880px;margin:0 auto}.adm form.add{display:grid;gap:14px}
.adm label{display:grid;gap:6px;font-weight:700;font-size:14px;color:var(--soft)}.adm label small{font-weight:500;color:var(--muted)}
.adm input,.adm select,.adm textarea{width:100%;border-radius:12px;border:1px solid var(--line);background:#0d1024;color:var(--text);font:inherit;font-size:15px;padding:12px 14px}
.adm textarea{min-height:80px;resize:vertical}.adm .row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:end}
.adm button,.adm .b{height:48px;padding:0 20px;border-radius:999px;border:1px solid var(--line);background:var(--glass);color:var(--text);font:inherit;font-weight:700;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center}
.adm .primary{background:linear-gradient(110deg,#22d3ee,#2f6bff 55%,#8b3dff);border:0;color:#fff}.adm .danger{border-color:rgba(255,107,107,.5);color:#ffb3b3}.adm .tiny{height:34px;padding:0 12px;font-size:13px}
.adm .msg{padding:12px 16px;border-radius:12px;background:rgba(61,214,140,.12);border:1px solid rgba(61,214,140,.35)}.adm .help{font-size:13.5px;color:var(--muted);line-height:1.6}
.adm .tog{display:flex;gap:10px;align-items:center;font-weight:600}.adm .tog input{width:22px;height:22px}
.sp{padding:16px;border-radius:16px;border:1px solid var(--line);background:var(--glass);display:grid;gap:8px}.sp-h{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.sp-m{font-size:13.5px;color:var(--muted);line-height:1.6}.sp-m code{font-size:12.5px;word-break:break-all}.badge{font-size:12px;font-weight:800;padding:3px 10px;border-radius:999px;border:1px solid}
.sp-a{display:flex;gap:8px}
.adm [hidden]{display:none!important}.adm input:not([type=checkbox]),.adm select{min-width:0;max-width:100%;box-sizing:border-box;min-height:50px}.adm .tog input{width:24px!important;height:24px!important;flex:0 0 24px;accent-color:#2f6bff}.adm input[type=date]{-webkit-appearance:none;appearance:none;display:block;text-align:left;line-height:1.2}.adm input[type=date]::-webkit-date-and-time-value{text-align:left}.adm .row>label{min-width:0}
@media (max-width:560px){.adm .row{grid-template-columns:minmax(0,1fr)!important}}
</style><div class="adm">
<section class="hero sm" style="padding-bottom:4px"><span class="eyebrow"><i></i>Private · only for you</span><h1>Sponsored <span class="grad-text">listings</span></h1>
<p>Set up a paid listing once the advertiser has paid. It goes live on the start date, shows with a "Sponsored" label, and comes down by itself after the end date.</p>
<p><a class="b" href="/advertise/terms" target="_blank">Advertising Terms</a></p></section>
${msg ? `<p class="msg">${e(msg)}</p>` : ""}
<form method="post" class="add"><input type="hidden" name="k" value="${e(k)}"><input type="hidden" name="ref" value="${e(pf.ref || "")}">
${pf.ref ? `<p class="help">Filled in from booking request <b>${e(pf.ref)}</b>. Check everything before saving.</p>` : ""}
<div class="row"><label>Package bought<select name="option" id="spOpt">${opts}</select></label><label>Company<input name="company" required maxlength="80" value="${e(pf.company || "")}"></label></div>
<label>Listing title <small>What the Sponsored card says, e.g. "AI Trainer (Maths)"</small><input name="title" required maxlength="120" value="${e(pf.role || "")}"></label>
<div class="row"><label>Pay <small>e.g. "$40–60/hr"</small><input name="pay" maxlength="40" value="${e(pf.pay || "")}"></label><label>Short line <small>e.g. "Remote, flexible hours. Free to apply."</small><input name="blurb" maxlength="140"></label></div>
<label>Their application link <small>Must be their own https page. Checked automatically.</small><input name="url" type="url" required value="${e(pf.url || "")}"></label>
<input type="hidden" name="site" value="${e(pf.site || "")}">
<div class="row"><label>Start date<input name="start" id="spStart" type="date" required value="${e(pf.start || today)}"></label><label>End date <small>Set from the package, change if agreed</small><input name="until" id="spUntil" type="date" required></label></div>
<label class="tog"><input type="checkbox" name="pin" value="1" id="spPin" checked> Pin on the website (homepage and All roles, labelled Sponsored). Untick for Instagram/WhatsApp-only packages.</label>
<div class="row" id="spPpc" hidden><label>Price per click (£)<input name="cpc" type="number" step="0.01" min="0.1" value="1.50"></label><label>Budget (£)<input name="budget" type="number" min="1" value="${e(pf.budget || 100)}"></label></div>
<label>Private notes <small>Only you see these</small><textarea name="notes" maxlength="500">${e(pf.notes || "")}</textarea></label>
<p class="help">Only set this up after they've paid and you've checked the role is real and free to apply for. They agree to the <a href="/advertise/terms" target="_blank">Advertising Terms</a> when they book.</p>
<div><button class="primary">Save listing</button></div></form>
<script>(function(){var o=document.getElementById("spOpt"),s=document.getElementById("spStart"),u=document.getElementById("spUntil"),p=document.getElementById("spPin"),c=document.getElementById("spPpc");
function days(n){return /monthly/i.test(n)?29:/per click/i.test(n)?29:6}
function upd(){var n=o.value,d=new Date(s.value+"T12:00:00Z");if(!isNaN(d)){d.setUTCDate(d.getUTCDate()+days(n));u.value=d.toISOString().slice(0,10)}p.checked=!/instagram|whatsapp/i.test(n);c.hidden=!/per click/i.test(n)}
o.addEventListener("change",upd);s.addEventListener("change",upd);upd()})();</script>
<section><h2>Listings</h2>${rows.length || fileRows.length ? [...rows.map(r => card(r, false)), ...fileRows.map(r => card(r, true))].join("") : "<p class='help'>No sponsored listings yet.</p>"}</section></div>`;
  return html(shellPage({ title: "Sponsored listings · GigrAI admin", desc: "Private.", canonical: "", robots: "noindex,nofollow", body }));
}

// ---- /admin/roles: add roles by hand ----
function adminRolesPage({ k, roles, msg }) {
  const e = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const plats = (PLATFORM_CONFIG.platforms || []).filter(p => p.active);
  const today = ukDay(), month = ukDay(30);
  const fileRoles = (CURATED.roles || []).map(r => `<tr><td><b>${e(r.title)}</b><br><small>${e(r.platform)} · built in (curated.json)</small></td><td>${r.min || ""}${r.max ? "–" + r.max : ""}</td><td>${e(r.expires)}</td><td></td></tr>`).join("");
  const rows = roles.map(r => `<tr><td><b>${e(r.title)}</b><br><small>${e(r.company || r.platform)}${r.url ? " · own link" : " · our referral link"}</small></td><td>${r.min || ""}${r.max ? "–" + r.max : ""}</td><td>${r.expires < today ? `<span style="color:#ffb3b3">Expired ${e(r.expires)}</span>` : e(r.expires)}</td><td><form method="post" style="margin:0"><input type="hidden" name="k" value="${e(k)}"><button class="b tiny danger" name="delete" value="${e(r.id)}">Remove</button></form></td></tr>`).join("");
  const body = `<style>
.adm{display:grid;gap:14px;max-width:860px;margin:0 auto}.adm form.add{display:grid;gap:14px}
.adm label{display:grid;gap:6px;font-weight:700;font-size:14px;color:var(--soft)}.adm label small{font-weight:500;color:var(--muted)}
.adm input,.adm select,.adm textarea{width:100%;border-radius:12px;border:1px solid var(--line);background:#0d1024;color:var(--text);font:inherit;font-size:15px;padding:12px 14px}
.adm textarea{min-height:110px;resize:vertical}.adm .row{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:12px;align-items:end}
.adm button,.adm .b{height:48px;padding:0 20px;border-radius:999px;border:1px solid var(--line);background:var(--glass);color:var(--text);font:inherit;font-weight:700;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center}
.adm .primary{background:linear-gradient(110deg,#22d3ee,#2f6bff 55%,#8b3dff);border:0;color:#fff}.adm .danger{border-color:rgba(255,107,107,.5);color:#ffb3b3}.adm .tiny{height:34px;padding:0 12px;font-size:13px}
.adm table{width:100%;border-collapse:collapse;font-size:14.5px}.adm th,.adm td{text-align:left;padding:10px 8px;border-bottom:1px solid var(--line);vertical-align:top}.adm th{color:var(--muted);font-size:13px}.adm small{color:var(--muted)}
.adm .msg{padding:12px 16px;border-radius:12px;background:rgba(61,214,140,.12);border:1px solid rgba(61,214,140,.35)}.adm .help{font-size:13.5px;color:var(--muted);line-height:1.6}
.adm [hidden]{display:none!important}.adm input:not([type=checkbox]),.adm select{min-width:0;max-width:100%;box-sizing:border-box;min-height:50px}.adm .tog input{width:24px!important;height:24px!important;flex:0 0 24px;accent-color:#2f6bff}.adm input[type=date]{-webkit-appearance:none;appearance:none;display:block;text-align:left;line-height:1.2}.adm input[type=date]::-webkit-date-and-time-value{text-align:left}.adm .row>label{min-width:0}
@media (max-width:560px){.adm .row{grid-template-columns:minmax(0,1fr)!important}}
</style><div class="adm">
<section class="hero sm" style="padding-bottom:4px"><span class="eyebrow"><i></i>Private · only for you</span><h1>Add <span class="grad-text">roles</span></h1>
<p>Add roles you find (Handshake, Mindrift, Instagram finds). They appear in search, role pages, guides and the Monday email straight away, and disappear on their expiry date.</p>
<p class="help">Paid or sponsored roles go in <a href="/admin/sponsored?k=${e(k)}">Sponsored listings</a> instead, so they get dates, a Sponsored label and a click report.</p></section>
${msg ? `<p class="msg">${e(msg)}</p>` : ""}
<form method="post" class="add"><input type="hidden" name="k" value="${e(k)}">
<label>Role title<input name="title" required maxlength="140" placeholder="e.g. Generalist AI Trainer (English)"></label>
<div class="row"><label>Platform<select name="platform">${plats.map(p => `<option value="${e(p.id)}">${e(p.name)}</option>`).join("")}<option value="other">Other company…</option></select></label>
<label>Company <small>(only for "Other")</small><input name="company" maxlength="60"></label></div>
<label>Application link <small>Leave empty to use our referral link for that platform. Must start with https://</small><input name="url" type="url" placeholder="https://"></label>
<div class="row"><label>Pay from ($/hr)<input name="min" type="number" min="0" max="1000"></label><label>Pay to ($/hr)<input name="max" type="number" min="0" max="1000"></label><label>Field <small>e.g. Writing, Law</small><input name="domain" maxlength="60"></label></div>
<label>Short description <small>What the work is, who it's for, any country limits. Only facts from the listing.</small><textarea name="desc" maxlength="3000"></textarea></label>
<div class="row"><label>Expires<input name="expires" type="date" value="${month}" min="${today}"></label></div>
<p class="help">Only add real roles from the company's own site. Never add anything that charges people to apply. Links are checked automatically.</p>
<div><button class="primary">Add role</button></div></form>
<section><h2>Your added roles</h2><table><thead><tr><th>Role</th><th>$/hr</th><th>Expires</th><th></th></tr></thead><tbody>${fileRoles}${rows || ""}</tbody></table>${!rows && !fileRoles ? "<p class='help'>None yet.</p>" : ""}</section></div>`;
  return html(shellPage({ title: "Add roles · GigrAI admin", desc: "Private.", canonical: "", robots: "noindex,nofollow", body }));
}

// ---- Weekly "Top roles" email ----
async function buildWeekly(env, ctx) {
  const feed = await loadFeed(env, ctx);
  const db = content(env);
  const [featured, posts] = await Promise.all([activeFeatured(env).catch(() => []), db ? db.listPosts({ limit: 1 }).catch(() => []) : []]);
  return weeklyEmail({ roles: pickWeekly(feed), total: feed.length, sponsor: featured[0] || null, post: posts[0] || null });
}
// Runs every hour from the cron; sends once, on Monday from 9am UK time
async function weeklyRun(env, ctx) {
  const mode = String(env.WEEKLY_EMAIL || "off");
  if (mode === "off" || !env.MAILERLITE_TOKEN || !env.MAILERLITE_GROUP_ID) return;
  const t = londonNow();
  if (t.day !== "Mon" || t.hour < 9) return;
  if ((await meta(env, "weekly_sent")) === t.date) return;
  await meta(env, "weekly_sent", t.date); // mark first, so two runs can never double-send
  const email = await buildWeekly(env, ctx);
  if (!email) { console.log("weekly email skipped: not enough roles"); return; }
  const r = await mlSendCampaign(env, email, mode);
  console.log(JSON.stringify({ event: "weekly_email", date: t.date, ...r }));
}
async function sendOwnerHtml(env, subject, html) {
  const from = "partners@remotegigrai.com", to = env.NOTIFY_TO || "remotegigr.ai@gmail.com";
  const b64 = (str) => btoa(String.fromCharCode(...new TextEncoder().encode(str)));
  const raw = [`From: GigrAI <${from}>`, `To: ${to}`, `Subject: =?UTF-8?B?${b64(subject)}?=`, `Message-ID: <weekly.${Date.now()}@remotegigrai.com>`, `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0", "Content-Type: text/html; charset=utf-8", "Content-Transfer-Encoding: base64", "", b64(html).replace(/.{76}/g, "$&\r\n")].join("\r\n");
  await env.NOTIFY.send(new EmailMessage(from, to, raw));
}

async function sendOwnerLink(env, link) {
  const from = "partners@remotegigrai.com", to = env.NOTIFY_TO || "remotegigr.ai@gmail.com";
  const b64 = (str) => btoa(String.fromCharCode(...new TextEncoder().encode(str)));
  const body = ["Your private GigrAI admin page (numbers, sponsored listings, roles, blog and the weekly email, all in one place):", "", link, "", "Bookmark it and don't share it. Opening it on a device also stops that device being counted in your numbers.", "If you didn't ask for this, you can ignore it: the link only ever goes to this inbox."].join("\r\n");
  const raw = [`From: GigrAI <${from}>`, `To: ${to}`, `Subject: Your GigrAI admin link`, `Message-ID: <owner.${Date.now()}@remotegigrai.com>`, `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0", "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: base64", "", b64(body).replace(/.{76}/g, "$&\r\n")].join("\r\n");
  await env.NOTIFY.send(new EmailMessage(from, to, raw));
}
const linkPage = (body, status = 200) => new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
const emailLinkPage = (msg) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Numbers link · GigrAI</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#070914;color:#eef1ff;font:16px/1.5 system-ui,sans-serif;padding:20px}main{max-width:420px;text-align:center}button{margin-top:14px;height:48px;padding:0 22px;border:0;border-radius:999px;color:#fff;font-weight:700;font-size:15px;background:linear-gradient(110deg,#22d3ee,#2f6bff 55%,#8b3dff);cursor:pointer}p{color:#a9b0cc}</style></head>
<body><main><h1>Email the numbers link</h1><p>This sends the private numbers-page link to the GigrAI inbox. It never shows the link here.</p>${msg ? `<p><b style="color:#fff">${msg}</b></p>` : `<form method="post"><button type="submit">Email me the link</button></form>`}</main></body></html>`;

// Sponsored listings: sponsored.json plus ones added in /admin/sponsored (cached for a minute)
let sponsorMemo = { at: 0, rows: [] };
async function sponsorsCfg(env) {
  if (Date.now() - sponsorMemo.at > 60000) {
    const db = content(env);
    try { sponsorMemo = { at: Date.now(), rows: db ? await db.listSponsors() : [] }; } catch {}
  }
  return { featured: [...((SPONSORED && SPONSORED.featured) || []), ...sponsorMemo.rows] };
}

// Pinned sponsors, minus pay-per-click ones whose budget is used up
async function activeFeatured(env) {
  const live = liveFeatured(await sponsorsCfg(env));
  const cpc = live.filter(f => clickCap(f));
  if (!cpc.length) return live;
  const used = await countMany(env, "sponsor_u", cpc.map(f => ({ k: f.id, from: f.start || "2000-01-01" })));
  return live.filter(f => !clickCap(f) || (used[f.id] || 0) < clickCap(f));
}

// ---------------- private blog editor ----------------
async function handleAdmin(request, url, env, ctx) {
  const noStore = (res) => { const h = new Headers(res.headers); h.set("cache-control", "private, no-store"); h.set("x-robots-tag", "noindex"); return new Response(res.body, { status: res.status, headers: h }); };
  const db = content(env);
  // Image upload from the editor (raw image body, key in the address)
  if (url.pathname === "/admin/upload" && request.method === "POST") {
    if (!db || !(await keyOk(env, "owner", url.searchParams.get("k") || ""))) return json({ ok: false, error: "Not allowed" }, 403);
    const origin = request.headers.get("origin");
    if (origin && new URL(origin).host !== url.host) return json({ ok: false, error: "Not allowed" }, 403);
    const TYPES = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif" };
    const type = (request.headers.get("content-type") || "").split(";")[0].trim();
    if (!TYPES[type]) return json({ ok: false, error: "Use a JPG, PNG, WebP or GIF image." }, 400);
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (!bytes.length) return json({ ok: false, error: "That file is empty." }, 400);
    if (bytes.length > 1900000) return json({ ok: false, error: "That image is too big (max about 1.8 MB). Try a smaller one." }, 413);
    // check the file really is that kind of image
    const sig = [...bytes.slice(0, 12)];
    const real = (sig[0] === 0xff && sig[1] === 0xd8) ? "image/jpeg" : (sig[0] === 0x89 && sig[1] === 0x50) ? "image/png" : (sig[0] === 0x47 && sig[1] === 0x49) ? "image/gif" : (String.fromCharCode(...sig.slice(0, 4)) === "RIFF" && String.fromCharCode(...sig.slice(8, 12)) === "WEBP") ? "image/webp" : "";
    if (real !== type) return json({ ok: false, error: "That file doesn't look like an image." }, 400);
    const id = [...crypto.getRandomValues(new Uint8Array(10))].map(b => b.toString(16).padStart(2, "0")).join("");
    await db.saveImage(id, type, bytes);
    return json({ ok: true, url: `/media/${id}.${TYPES[type]}` });
  }
  let form = null;
  if (request.method === "POST") {
    try { form = await request.formData(); } catch { return new Response("Bad request", { status: 400 }); }
    const origin = request.headers.get("origin");
    if (origin && new URL(origin).host !== url.host) return new Response("Forbidden", { status: 403 });
  }
  const k = (form ? form.get("k") : url.searchParams.get("k")) || "";
  if (!db || !(await keyOk(env, "owner", String(k)))) return noStore(reportsOff(url.origin));
  const back = (msg) => Response.redirect(new URL(`/admin/blog?k=${encodeURIComponent(k)}${msg ? "&msg=" + encodeURIComponent(msg) : ""}`, url).toString(), 303);
  const nav = (res, active) => withAdminNav(res, k, active);
  const platforms = PLATFORM_CONFIG.platforms;

  // Admin home: everything in one place
  if ((url.pathname === "/admin" || url.pathname === "/admin/") && request.method === "GET") {
    const res = nav(noStore(await adminDashboard(env, ctx, k, url)), "home");
    // like the numbers page: opening admin stops this device being counted in the stats
    if (!isOwner(request)) { const h = new Headers(res.headers); h.append("set-cookie", `gg_nt=${await signKey(env, "notrack")}; Path=/; Max-Age=34560000; HttpOnly; SameSite=Lax${url.protocol === "https:" ? "; Secure" : ""}`); return new Response(res.body, { status: res.status, headers: h }); }
    return res;
  }
  if (url.pathname === "/admin/blog" && request.method === "GET") {
    const [posts, news, fetched] = await Promise.all([db.listPosts({ status: "all", limit: 100 }), db.listNews({ limit: 60, includeHidden: true }), db.lastFetched()]);
    const taken = new Set(posts.map(p => p.slug));
    const suggested = ((DRAFTS && DRAFTS.drafts) || []).filter(d => d && d.id && d.title && !taken.has(slugify(d.slug || d.title)));
    return nav(noStore(adminHome({ k, posts, news: news.rows, msg: url.searchParams.get("msg") || "", fetched, suggested })), "blog");
  }
  if (url.pathname === "/admin/post" && request.method === "GET") {
    const slug = url.searchParams.get("slug") || "";
    if (slug) {
      const post = await db.getPost(slug);
      if (!post) return back("That post wasn't found.");
      return nav(noStore(adminEditor({ k, post, isNew: false, platforms })), "blog");
    }
    let post = null;
    const draftId = url.searchParams.get("draft");
    if (draftId) {
      const d = ((DRAFTS && DRAFTS.drafts) || []).find(x => x.id === draftId);
      if (d) post = { title: d.title, slug: slugify(d.slug || d.title), cat: d.cat, summary: d.summary || "", body: d.body || "", sources: (d.sources || []).map(x => `${x.title} | ${x.url}`).join("\n"), affiliate: d.affiliate || "", author: "GigrAI" };
    }
    const from = url.searchParams.get("from");
    if (from) {
      const n = await db.getNews(from);
      if (n) post = { title: n.title, cat: n.cat, summary: "", body: "", sources: `${n.source}: ${n.title} | ${n.link}`, author: "GigrAI" };
    }
    return nav(noStore(adminEditor({ k, post, isNew: true, platforms })), "blog");
  }
  if (url.pathname === "/admin/post" && request.method === "POST") {
    const f = (n, max) => String(form.get(n) || "").replace(/\r/g, "").trim().slice(0, max);
    const title = f("title", 160);
    const status = form.get("status") === "published" ? "published" : "draft";
    const post = {
      title, status,
      slug: slugify(f("slug", 80) || title).slice(0, 80),
      cat: CATEGORIES.some(c => c.id === form.get("cat")) ? String(form.get("cat")) : "ai-work",
      summary: f("summary", 300), body: f("body", 40000), sources: f("sources", 4000),
      affiliate: platforms.some(p => p.id === form.get("affiliate") && p.active) ? String(form.get("affiliate")) : "",
      author: f("author", 60) || "GigrAI",
      image: /^(https:\/\/|\/)[^\s"'<>]+$/.test(f("image", 300)) ? f("image", 300) : "",
    };
    const original = f("original", 80);
    if (!title) return noStore(adminEditor({ k, post, isNew: !original, error: "Add a headline first.", platforms }));
    if (status === "published" && post.body.length < 80) return noStore(adminEditor({ k, post, isNew: !original, error: "The article is very short. Add more before publishing, or save it as a draft.", platforms }));
    const r = await db.savePost(post, original);
    if (!r.ok) return noStore(adminEditor({ k, post, isNew: !original, error: r.error, platforms }));
    return back(status === "published" ? `Published: "${title}" is live at /news/${post.slug}` : `Saved as a draft: "${title}"`);
  }
  // ---- sponsored listings ----
  if (url.pathname === "/admin/sponsored" && request.method === "GET") {
    const rows = await db.listSponsors();
    const used = await countMany(env, "sponsor_u", rows.map(r => ({ k: r.id, from: r.start || "2000-01-01" })));
    const links = Object.fromEntries(await Promise.all(rows.map(async r => [r.id, `${url.origin}/report/${r.id}?k=${await signKey(env, "sponsor:" + r.id)}`])));
    let prefill = null;
    const ref = url.searchParams.get("from");
    if (ref) { const q = (await db.listEnquiries(100)).find(x => x.ref === ref); if (q) prefill = { ...q.data, ref }; }
    return nav(noStore(adminSponsoredPage({ k, rows, used, links, prefill, origin: url.origin, msg: url.searchParams.get("msg") || "" })), "sponsored");
  }
  if (url.pathname === "/admin/sponsored" && request.method === "POST") {
    const backS = (msg) => Response.redirect(new URL(`/admin/sponsored?k=${encodeURIComponent(k)}&msg=${encodeURIComponent(msg)}`, url).toString(), 303);
    const f = (n, max) => String(form.get(n) || "").replace(/\r/g, "").trim().slice(0, max);
    const today = ukDay(), yesterday = ukDay(-1);
    if (form.get("end")) {
      const s0 = await db.getSponsor(f("end", 60)); if (!s0) return backS("Listing not found.");
      await db.saveSponsor({ ...s0, until: yesterday, ended: today }); sponsorMemo.at = 0; // comes off the site straight away
      return backS(`Ended "${s0.title}" today. Its report and links keep working for 60 days.`);
    }
    if (form.get("delete")) {
      const s0 = await db.getSponsor(f("delete", 60));
      if (s0 && s0.start <= today) return backS("This listing has already started, so it can't be deleted (its click report is needed for billing). Use End now instead.");
      await db.deleteSponsor(f("delete", 60)); sponsorMemo.at = 0; return backS("Scheduled listing deleted.");
    }
    const option = AD_OPTIONS.find(o => o.name === f("option", 60));
    const company = f("company", 80), title = f("title", 120), link = f("url", 600);
    const start = /^\d{4}-\d{2}-\d{2}$/.test(f("start", 10)) ? f("start", 10) : "", until = /^\d{4}-\d{2}-\d{2}$/.test(f("until", 10)) ? f("until", 10) : "";
    if (!option) return backS("Choose the package they bought.");
    if (!company || !title || !link) return backS("Company, title and application link are all needed.");
    if (!start || !until || until < start) return backS("Check the dates: the end date must be on or after the start date.");
    const v = await vetLink(link, f("site", 300));
    if (v.result === "fail") return backS("Link not accepted: " + (v.reasons || []).join(" "));
    const base = slugify(company).slice(0, 24) || "sponsor";
    let id = base; for (let i = 2; await db.getSponsor(id) || ((SPONSORED.featured || []).some(x => x.id === id)); i++) id = `${base}-${i}`;
    const ppc = /per click/i.test(option.name);
    const sp = {
      id, company, title, url: link, pay: f("pay", 40), blurb: f("blurb", 140), option: option.name, start, until,
      pin: form.get("pin") === "1", ref: f("ref", 20), notes: f("notes", 500),
      ...(ppc ? { cpc: Math.max(0.1, Math.min(20, +f("cpc", 6) || 1.5)), budget: Math.max(1, Math.min(100000, +f("budget", 8) || 100)) } : {}),
    };
    await db.saveSponsor(sp); sponsorMemo.at = 0;
    if (sp.ref) await db.setEnquiryStatus(sp.ref, "booked");
    return backS(`Saved "${title}" for ${company}: ${start} to ${until}${sp.pin ? ", pinned on the site" : ", posts only"}. Send them the report link below.`);
  }
  // ---- hand-added roles ----
  if (url.pathname === "/admin/roles" && request.method === "GET") {
    return nav(noStore(adminRolesPage({ k, roles: await db.listRoles({ includeExpired: true }), msg: url.searchParams.get("msg") || "" })), "roles");
  }
  if (url.pathname === "/admin/roles" && request.method === "POST") {
    const backR = (msg) => Response.redirect(new URL(`/admin/roles?k=${encodeURIComponent(k)}&msg=${encodeURIComponent(msg)}`, url).toString(), 303);
    if (form.get("delete")) { await db.deleteRole(String(form.get("delete"))); curatedMemo.at = 0; return backR("Role removed."); }
    const f = (n, max) => String(form.get(n) || "").replace(/\r/g, "").trim().slice(0, max);
    const platform = f("platform", 30);
    const p = platforms.find(x => x.id === platform && x.active);
    const role = {
      id: "c-" + (f("id", 40) || [...crypto.getRandomValues(new Uint8Array(5))].map(b => b.toString(16).padStart(2, "0")).join("")),
      title: f("title", 140), platform: p ? p.id : "other", company: p ? "" : f("company", 60),
      url: f("url", 600), min: Math.min(1000, Math.max(0, parseInt(f("min", 5)) || 0)) || null, max: Math.min(1000, Math.max(0, parseInt(f("max", 5)) || 0)) || null,
      domain: f("domain", 60), desc: f("desc", 3000), posted: ukDay(),
      expires: /^\d{4}-\d{2}-\d{2}$/.test(f("expires", 10)) ? f("expires", 10) : ukDay(30),
    };
    if (!role.title) return backR("Add a role title.");
    if (!p && !role.company) return backR("Pick a platform, or type the company name for 'Other'.");
    if (!role.url && !p) return backR("Add the application link (needed when the platform isn't one of ours).");
    if (role.url) {
      const v = await vetLink(role.url);
      if (v.result === "fail") return backR("Link not added: " + (v.reasons || []).join(" "));
    }
    if (role.min && role.max && role.min > role.max) [role.min, role.max] = [role.max, role.min];
    await db.saveRole(role); curatedMemo.at = 0;
    return backR(`Added "${role.title}". It's live now and drops off on ${role.expires}.`);
  }
  if (url.pathname === "/admin/delete" && request.method === "POST") {
    await db.deletePost(String(form.get("slug") || ""));
    return back("Post deleted.");
  }
  if (url.pathname === "/admin/news" && request.method === "POST") {
    await db.setHidden(String(form.get("id") || ""), form.get("hide") === "1");
    return back(form.get("hide") === "1" ? "Headline hidden from /news." : "Headline shown on /news again.");
  }
  if (url.pathname === "/admin/refresh" && request.method === "POST") {
    const r = await refreshNews(env);
    const bad = (r.sources || []).filter(s => !s.ok).map(s => s.id);
    return back(`Fetched headlines: ${r.added || 0} new.${bad.length ? " Couldn't reach: " + bad.join(", ") + "." : ""}`);
  }
  return back("");
}

// ?days=7|30|90 on the stats pages (default 30)
const pickDays = (url) => ([7, 30, 90].includes(+url.searchParams.get("days")) ? +url.searchParams.get("days") : 30);

// Where a page view came from: ?src= tag first, otherwise the referring site
const REF_SRC = [[/instagram\./, "ig"], [/whatsapp\./, "wa"], [/(^|\.)google\./, "google"], [/bing\.com/, "bing"], [/(^|\.)(x|twitter)\.com|^t\.co$/, "x"], [/linkedin\./, "li"], [/facebook\.|fb\.com/, "fb"], [/tiktok\./, "tt"], [/reddit\./, "reddit"]];
function visitSource(request, url) {
  const tag = cleanSrc(url.searchParams.get("src"));
  if (tag) return tag;
  let host = "";
  try { host = new URL(request.headers.get("referer") || "").hostname.replace(/^www\./, ""); } catch {}
  if (!host) return "direct";
  if (host === url.hostname.replace(/^www\./, "")) return "internal";
  const hit = REF_SRC.find(([re]) => re.test(host));
  return hit ? hit[1] : "other";
}

// An hourly rate we trust: drops blanks and obvious data errors (e.g. an annual salary typed as hourly)
const hourlyOk = v => (Number.isFinite(+v) && +v > 0 && +v <= 1000 ? +v : null);

const cleanSrc = v => String(v || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 20);

// Markdown-ish job description -> tidy plain text (headings "## ", bullets "- " kept), capped for size
function plainText(md) {
  if (!md) return "";
  return String(md)
    .replace(/\r/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")            // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")          // links -> text
    .replace(/<[^>]+>/g, "")                            // html tags
    .replace(/^\s*#{1,6}\s*/gm, "## ")                 // headings
    .replace(/^\s*[*\u2022]\s+/gm, "- ")              // bullets
    .replace(/\*\*|__|`/g, "")                        // bold / code marks
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 4000);
}

// Only allow https links on the platform's own domain, then apply the referral rule.
// Company's own listing link (no referral): https only, tagged so they can see the visit came from GigrAI
function listingUrl(raw) {
  try { const u = new URL(raw); if (u.protocol !== "https:") return null; if (!u.searchParams.get("utm_source")) u.searchParams.set("utm_source", "gigrai"); return u.toString(); } catch { return null; }
}
const htmlText = (h) => String(h || "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
  .replace(/<\/(p|div|li|h\d|br)\s*>|<br\s*\/?>/gi, "\n").replace(/<li[^>]*>/gi, "- ").replace(/<[^>]+>/g, "").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
// "$40–$60 per hour" / "$45/hr" / "USD 30 - 50 an hour" -> [min, max] (US dollars an hour only)
function payFromText(t) {
  const m = String(t).match(/(?:\$|USD\s?)(\d{2,3}(?:\.\d+)?)(?:\s*(?:-|–|to)\s*(?:\$|USD\s?)?(\d{2,3}(?:\.\d+)?))?\s*(?:USD\s*)?(?:\/\s*h(?:ou)?r|per\s+hour|an\s+hour|\/\s*hour|hourly)/i);
  if (!m) return [null, null];
  const a = hourlyOk(Math.round(+m[1])), b = m[2] ? hourlyOk(Math.round(+m[2])) : null;
  return [a, b || a];
}
// "London; United Kingdom" -> ["GBR"]; unknown places -> []
const PLACE = [["GBR", /united kingdom|\buk\b|london|england|scotland|wales/i], ["USA", /united states|\busa?\b|new york|san francisco|california|texas|washington, dc/i], ["CAN", /canada|toronto|vancouver/i], ["AUS", /australia/i], ["IRL", /ireland|dublin/i], ["IND", /india/i], ["DEU", /germany/i], ["FRA", /france/i], ["ESP", /spain/i], ["ITA", /italy/i], ["NLD", /netherlands/i], ["POL", /poland/i], ["PRT", /portugal/i], ["NGA", /nigeria/i], ["KEN", /kenya/i], ["ZAF", /south africa/i], ["PHL", /philippines/i], ["BRA", /brazil/i], ["MEX", /mexico/i]];
function countriesFromText(t) {
  if (!t || /europe|european union|\bemea\b|global|worldwide|anywhere/i.test(t)) return [];
  return PLACE.filter(([, re]) => re.test(t)).map(([c]) => c);
}

function withReferral(raw, hostRe, addCode) {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || !hostRe.test(u.hostname)) return null;
    addCode(u);
    if (!u.searchParams.get("utm_source")) u.searchParams.set("utm_source", "referral");
    return u.toString();
  } catch { return null; }
}

// Every live role: the platform feeds plus hand-added roles (curated.json and /admin/roles)
async function loadFeed(env, ctx) {
  const [feed, extra] = await Promise.all([loadPlatformFeed(env, ctx).catch(e => ({ error: e })), curatedRoles(env)]);
  if (feed.error) { if (extra.length) return extra; throw feed.error; }
  return [...feed, ...extra];
}
// Hand-added roles become normal feed roles. They expire on their date and drop off by themselves.
let curatedMemo = { at: 0, rows: [] };
async function curatedRoles(env) {
  const today = ukDay();
  let stored = curatedMemo.rows;
  if (Date.now() - curatedMemo.at > 60000) {
    const db = content(env);
    try { stored = db ? await db.listRoles() : []; curatedMemo = { at: Date.now(), rows: stored }; } catch { stored = curatedMemo.rows; }
  }
  const plats = PLATFORM_CONFIG.platforms || [];
  return [...(CURATED.roles || []), ...stored].filter(r => r && r.id && r.title && (r.expires || "") >= today).map(r => {
    const p = plats.find(x => x.id === r.platform && x.active);
    const url = r.url || (p && p.signupUrl) || "";
    if (!/^https:\/\//.test(url)) return null;
    return {
      id: String(r.id).startsWith("c-") || String(r.id).includes("-") ? String(r.id) : "c-" + r.id,
      title: r.title, min: +r.min || null, max: +r.max || null,
      via: p ? p.name : (r.company || "Other"), platform: p ? p.id : "other",
      domain: r.domain || "", skills: [], desc: r.desc || "", hot: false, url,
      posted: r.posted || (r.created || "").slice(0, 10) || today, expires: r.expires, curated: true,
    };
  }).filter(Boolean);
}
async function loadPlatformFeed(env, ctx) {
  const sources = livePlatforms();
  const cacheKey = new Request(`https://cache.remotegigrai.internal/feed-v3/${sources.map(p => p.id).join(",")}`);
  const cache = typeof caches !== "undefined" ? caches.default : null;
  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit.json();
  }
  const results = await Promise.allSettled(sources.map(async p => {
    const adapter = ADAPTERS[p.feed.type];
    if (!adapter) throw new Error(`no adapter for ${p.feed.type}`);
    const jobs = (await adapter(p, env)).filter(Boolean);
    return jobs.map(j => ({ ...j, via: p.name, platform: p.id }));
  }));
  const jobs = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") jobs.push(...r.value);
    else console.error("feed failed", sources[i].id, String(r.reason)); // other platforms still load
  });
  if (!jobs.length && sources.length) throw new Error("all feeds failed");
  if (cache && jobs.length) {
    const res = new Response(JSON.stringify(jobs), { headers: { "content-type": "application/json", "cache-control": `max-age=${FEED_TTL}` } });
    ctx?.waitUntil ? ctx.waitUntil(cache.put(cacheKey, res)) : await cache.put(cacheKey, res);
  }
  return jobs;
}

const pretty = (slug) => String(slug || "").split("-").filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(" ");

// Related words, so "coding" finds Developer roles and "medical" finds Doctor/Nurse roles
const SYNONYMS = [
  ["code", "coding", "coder", "developer", "develop", "software", "engineer", "programm", "python", "javascript", "java"],
  ["medic", "doctor", "nurs", "health", "clinic", "physician", "pharma", "dentist"],
  ["legal", "law", "lawyer", "attorney", "paralegal"],
  ["language", "translat", "linguist", "bilingual", "spanish", "french", "german", "arabic", "portuguese", "japanese", "chinese", "hindi", "italian"],
  ["financ", "account", "bank", "invest", "econom"],
  ["math", "statistic", "quant"],
  ["writ", "editor", "copywrit", "content"],
  ["photo", "camera"],
  ["research", "scien", "phd", "academ"],
];
const stem = (t) => t.length > 5 && t.endsWith("ing") ? t.slice(0, -3) : t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t;
function expand(term) {
  const t = stem(term);
  const hit = (x) => (w) => x.startsWith(w) || (x.length >= 4 && w.startsWith(x));
  const group = SYNONYMS.find(g => g.some(hit(term)) || g.some(hit(t)));
  return group ? [t, ...group] : [t];
}

function matches(job, groups) {
  const hay = `${job.title} ${job.domain} ${job.skills.join(" ")}`.toLowerCase();
  return groups.every(alts => alts.some(a => hay.includes(a)));
}

async function handleJobs(url, env, ctx) {
  const q = (url.searchParams.get("q") || "").trim().toLowerCase().slice(0, 60);
  const page = Math.max(1, Math.min(50, parseInt(url.searchParams.get("page") || "1", 10) || 1));
  let feed;
  try {
    feed = await loadFeed(env, ctx);
  } catch (e) {
    console.error("job feeds failed", String(e));
    return json({ ok: false, error: "Live roles are unavailable right now." }, 502);
  }
  const hot = url.searchParams.get("hot") === "1";
  const minpay = Math.max(0, Math.min(500, parseInt(url.searchParams.get("minpay") || "0", 10) || 0));
  const maxpay = Math.max(0, Math.min(1000, parseInt(url.searchParams.get("maxpay") || "0", 10) || 0));
  const field = (url.searchParams.get("field") || "").slice(0, 60);
  const sort = url.searchParams.get("sort") === "pay" ? "pay" : "new";
  const via = (url.searchParams.get("via") || "").slice(0, 40);
  const country = /^[A-Z]{3}$/.test(url.searchParams.get("country") || "") ? url.searchParams.get("country") : "";
  const size = Math.max(1, Math.min(24, parseInt(url.searchParams.get("limit") || PAGE_SIZE, 10) || PAGE_SIZE));

  const groups = q.split(/\s+/).filter(t => t.length > 1).map(expand);
  let list = feed.filter(j =>
    (!groups.length || matches(j, groups)) &&
    (!hot || j.hot) &&
    (!minpay || (j.max || j.min || 0) >= minpay) &&
    (!maxpay || ((j.min || j.max) && (j.min || j.max) <= maxpay)) &&
    (!via || j.platform === via) &&
    (!country || eligibility(j, country) !== "no"));
  // field counts for the dropdown (before the field filter is applied)
  const counts = {};
  for (const j of list) if (j.domain) counts[j.domain] = (counts[j.domain] || 0) + 1;
  const fields = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n }));
  // platform filter: every platform with live roles, including ones added by hand (Handshake AI, "Other")
  const sources = [...(PLATFORM_CONFIG.platforms || []).filter(p => p.active).map(p => ({ id: p.id, name: p.name, n: feed.filter(j => j.platform === p.id).length })),
    { id: "other", name: "Other companies", n: feed.filter(j => j.platform === "other").length }].filter(x => x.n);
  if (field) list = list.filter(j => j.domain === field);

  list = list.slice().sort(sort === "pay"
    ? (a, b) => (b.max || b.min || 0) - (a.max || a.min || 0) || (b.posted || "").localeCompare(a.posted || "")
    : (a, b) => (b.posted || "").localeCompare(a.posted || ""));
  const total = list.length;
  const yes = country ? list.filter(j => eligibility(j, country) === "yes").length : null; // roles that say they're open to this country
  const items = list.slice((page - 1) * size, page * size).map(j => {
    const { allow, deny, known, desc, ...rest } = j;
    return country ? { ...rest, elig: eligibility(j, country) } : rest;
  });
  if (q && page === 1) console.log(JSON.stringify({ event: "job_search", q, results: total, src: cleanSrc(url.searchParams.get("src")) }));
  const dayAgo = new Date(Date.now() - 864e5).toISOString().replace("T", " ").slice(0, 19);
  const newToday = feed.filter(j => (j.posted || "") >= dayAgo).length;
  return new Response(JSON.stringify({ ok: true, q, total, yes, all: feed.length, newToday, page, pages: Math.ceil(total / size), fields, sources, items }), {
    headers: { "content-type": "application/json", "cache-control": "public, max-age=120" },
  });
}
