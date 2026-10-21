// Serves the static link page from ./public and handles one API route:
//   POST /api/subscribe  { email, name }  -> adds the person to the MailerLite "GigrAI Jobs" group.
// Static files are served before this code runs, so only unmatched paths reach it.

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/subscribe") {
      if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

      // Only accept submissions from our own page
      const origin = request.headers.get("origin");
      if (origin && new URL(origin).host !== url.host) return json({ ok: false, error: "Forbidden" }, 403);

      let data;
      try {
        data = await request.json();
      } catch {
        return json({ ok: false, error: "Bad request" }, 400);
      }

      // Honeypot field: real people never fill it in
      if (data.website) return json({ ok: true });

      const email = String(data.email || "").trim().toLowerCase();
      const name = String(data.name || "").trim().slice(0, 80);
      if (!EMAIL_RE.test(email) || email.length > 254) {
        return json({ ok: false, error: "Please enter a valid email." }, 400);
      }

      if (!env.MAILERLITE_TOKEN) {
        console.error("MAILERLITE_TOKEN secret is not set");
        return json({ ok: false, error: "Signup is temporarily unavailable." }, 500);
      }

      const res = await fetch("https://connect.mailerlite.com/api/subscribers", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          authorization: `Bearer ${env.MAILERLITE_TOKEN}`,
        },
        body: JSON.stringify({
          email,
          fields: name ? { name } : {},
          groups: [env.MAILERLITE_GROUP_ID],
        }),
      });

      if (res.ok) return json({ ok: true });

      // Make failures visible in Cloudflare's logs
      console.error("MailerLite error", res.status, await res.text());
      if (res.status === 422) return json({ ok: false, error: "Please enter a valid email." }, 400);
      return json({ ok: false, error: "Something went wrong. Please try again." }, 502);
    }

    // Link-tap counter: shows up in Cloudflare > gigrai-links > Observability (search "link_click")
    if (url.pathname === "/api/click" && request.method === "POST") {
      let link = "unknown";
      try {
        const body = JSON.parse(await request.text());
        link = String(body.link || "unknown").replace(/[^\w\- .:/]/g, "").slice(0, 60);
      } catch {}
      console.log(JSON.stringify({ event: "link_click", link, country: request.cf?.country || "??" }));
      return new Response(null, { status: 204 });
    }

    // Live micro1 roles: GET /api/jobs?q=photography&page=1
    if (url.pathname === "/api/jobs" && request.method === "GET") {
      return handleJobs(url, env, ctx);
    }

    return env.ASSETS.fetch(request);
  },
};

// ---------------- micro1 live jobs ----------------
const REFERRAL_CODE = "e9ff2278-2563-4f64-bed8-214a3dfd996c";
const FEED_TTL = 30 * 60; // seconds: refresh the job list at most every 30 mins
const PAGE_SIZE = 8;

async function loadFeed(env, ctx) {
  const base = env.MICRO1_API || "https://prod-api.micro1.ai/api/v1";
  const cacheKey = new Request("https://cache.remotegigrai.internal/micro1-feed-v1");
  const cache = typeof caches !== "undefined" ? caches.default : null;
  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit.json();
  }
  const all = [];
  for (let page = 1; page <= 6; page++) {
    const r = await fetch(`${base}/job/portal/referral/${REFERRAL_CODE}/jobs?page=${page}&limit=100`, {
      headers: { accept: "application/json", "x-custom-lang": "en" },
    });
    if (!r.ok) throw new Error(`micro1 feed ${r.status}`);
    const body = await r.json();
    const rows = Array.isArray(body.data) ? body.data : [];
    all.push(...rows);
    if (rows.length < 100 || all.length >= (body.total || 0)) break;
  }
  const jobs = all.map(cleanJob).filter(Boolean);
  if (cache) {
    const res = new Response(JSON.stringify(jobs), { headers: { "content-type": "application/json", "cache-control": `max-age=${FEED_TTL}` } });
    ctx?.waitUntil ? ctx.waitUntil(cache.put(cacheKey, res)) : await cache.put(cacheKey, res);
  }
  return jobs;
}

function safeApplyUrl(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || !/(^|\.)micro1\.ai$/.test(u.hostname)) return null;
    u.searchParams.set("referralCode", REFERRAL_CODE); // always credit GigrAI
    if (!u.searchParams.get("utm_source")) u.searchParams.set("utm_source", "referral");
    return u.toString();
  } catch { return null; }
}

const pretty = (slug) => String(slug || "").split("-").filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(" ");

function cleanJob(j) {
  const url = safeApplyUrl(j.apply_url);
  if (!url || !j.job_name) return null;
  const hr = j.ideal_hourly_rate || {};
  return {
    id: String(j.job_id || ""),
    title: String(j.job_name).trim(),
    min: Number.isFinite(+hr.min) ? +hr.min : null,
    max: Number.isFinite(+hr.max) ? +hr.max : null,
    skills: Array.isArray(j.skills) ? j.skills.slice(0, 8).map(String) : [],
    domain: pretty(j.domain_slug),
    posted: j.date_posted || null,
    hot: String(j.is_high_demand_job) === "1",
    openings: +j.no_of_openings || null,
    url,
  };
}

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
    console.error("micro1 feed failed", String(e));
    return json({ ok: false, error: "Live roles are unavailable right now." }, 502);
  }
  const groups = q.split(/\s+/).filter(t => t.length > 1).map(expand);
  let list = groups.length ? feed.filter(j => matches(j, groups)) : feed;
  list = list.slice().sort((a, b) => (b.posted || "").localeCompare(a.posted || ""));
  const total = list.length;
  const items = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  if (q && page === 1) console.log(JSON.stringify({ event: "job_search", q, results: total }));
  return new Response(JSON.stringify({ ok: true, q, total, page, pages: Math.ceil(total / PAGE_SIZE), items }), {
    headers: { "content-type": "application/json", "cache-control": "public, max-age=120" },
  });
}
