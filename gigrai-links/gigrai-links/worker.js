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
      try {
        const r = await fetch("https://refer.micro1.ai/assets/index.js", { headers: { "user-agent": "Mozilla/5.0" } });
        const js = await r.text();
        const uniq = (arr) => [...new Set(arr)];
        const urls = uniq([...js.matchAll(/["'`](https?:\/\/[^"'`\s]{4,120})["'`]/g)].map(m => m[1]))
          .filter(u => !/w3\.org|reactjs|github|mozilla|googleapis\.com\/css|fonts\./i.test(u)).slice(0, 60);
        const paths = uniq([...js.matchAll(/["'`](\/[a-zA-Z0-9_\-/{}:$.]*(?:job|referr|opening|position|role|portal|candidate)[a-zA-Z0-9_\-/{}:$.?=&]*)["'`]/gi)].map(m => m[1])).slice(0, 60);
        const ctx = [];
        for (const m of js.matchAll(/referralCode/g)) { if (ctx.length >= 6) break; ctx.push(js.slice(Math.max(0, m.index - 160), m.index + 160)); }
        return json({ status: r.status, length: js.length, urls, paths, referralCodeContext: ctx });
      } catch (e) { return json({ error: String(e) }, 500); }
    }

    return env.ASSETS.fetch(request);
  },
};
