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
  async fetch(request, env) {
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

    // TEMPORARY diagnostic (remove after checking micro1 structure)
    if (url.pathname === "/api/probe-m1-7f3k") {
      const target = "https://refer.micro1.ai/referral/jobs/?referralCode=e9ff2278-2563-4f64-bed8-214a3dfd996c";
      try {
        const r = await fetch(target, { headers: { "user-agent": "Mozilla/5.0 (compatible; GigrAI-probe)", accept: "text/html" } });
        const html = await r.text();
        const pick = (re) => [...html.matchAll(re)].map(m => m[1]).slice(0, 40);
        const nd = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
        return json({
          status: r.status, type: r.headers.get("content-type"), length: html.length,
          title: (html.match(/<title>([^<]*)/) || [])[1] || null,
          scripts: pick(/<script[^>]+src="([^"]+)"/g),
          jobLinks: pick(/href="([^"]*job[^"]*)"/gi),
          apiHints: [...new Set(pick(/(https?:\/\/[a-z0-9.-]*micro1[a-z0-9.-]*\/[^"'\s]{0,80})/gi))].slice(0, 30),
          nextData: nd ? nd[1].slice(0, 3000) : null,
          bodyText: html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 1500)
        });
      } catch (e) { return json({ error: String(e) }, 500); }
    }

    return env.ASSETS.fetch(request);
  },
};
