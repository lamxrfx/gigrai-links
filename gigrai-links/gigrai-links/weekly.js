// Weekly "Top roles" email (Mondays, 9am UK) sent to the GigrAI Jobs group through MailerLite.
// WEEKLY_EMAIL in wrangler.jsonc: "on" = send, "draft" = create the campaign but don't send, "off" = nothing.
// Same light design as the welcome emails (survives Gmail's dark mode).

const S = "https://remotegigrai.com";
const IMG = S + "/email";
const F = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pay = (j) => { const lo = j.min, hi = j.max; if (!lo && !hi) return ""; return lo && hi && lo !== hi ? `$${lo}–${hi}/hr` : `$${lo || hi}/hr`; };
const SRC = "email-weekly";

const EASY = /writ|edit|research|review|evaluat|annotat|rater|rating|generalist|tutor|language|translat|transcri|content|data label|labell|labeler|prompt|chat/i;
const EXPERT = /doctor|nurs|physician|medical|clinic|lawyer|attorney|legal|paralegal|dentist|pharmac|phd|professor|surgeon|radiolog|psychiatr/i;

// 5 roles: newest and best-paid first, mostly roles anyone can do, one specialist pick, max 3 per platform
export function pickWeekly(feed, n = 5) {
  const now = Date.now();
  const fresh = (j) => { const t = Date.parse(String(j.posted || "").replace(" ", "T")); return t && now - t < 8 * 864e5; };
  const score = (j) => (fresh(j) ? 3 : 0) + (j.hot ? 1 : 0) + Math.min(3, (j.max || j.min || 0) / 50) + (EASY.test(j.title) ? 2 : 0) - (EXPERT.test(j.title) ? 2 : 0);
  const paid = feed.filter((j) => j.min || j.max);
  const out = [], seen = new Set(), per = {};
  const add = (j) => {
    const key = j.title.toLowerCase().replace(/\s*\d+$/, "");
    if (seen.has(key) || (per[j.platform] || 0) >= 3) return false;
    seen.add(key); per[j.platform] = (per[j.platform] || 0) + 1; out.push(j); return true;
  };
  for (const j of paid.slice().sort((a, b) => score(b) - score(a))) { if (out.length >= n - 1) break; add(j); }
  // one best-paid specialist role
  const top = paid.filter((j) => EXPERT.test(j.title)).sort((a, b) => (b.max || b.min) - (a.max || a.min));
  for (const j of top) if (add(j)) break;
  for (const j of paid.slice().sort((a, b) => score(b) - score(a))) { if (out.length >= n) break; add(j); }
  return out.slice(0, n);
}

const btn = (url, label) => `<table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:26px auto 6px"><tr><td align="center" bgcolor="#2f6bff" style="border-radius:999px;background-color:#2f6bff;background-image:linear-gradient(110deg,#22d3ee,#2f6bff 55%,#8b3dff)"><a href="${url}" style="display:inline-block;padding:15px 30px;${F};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px"><span class="gb-s"><span class="gb-d">${label}</span></span></a></td></tr></table>`;

const section = (title, rows) => `<tr><td style="padding:34px 36px 0"><div style="${F};font-size:24px;font-weight:800;color:#0b0e1d;letter-spacing:-.02em;padding-bottom:14px">${title}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}<tr><td style="border-top:1px solid #d9dcea;font-size:0;line-height:0">&nbsp;</td></tr></table></td></tr>`;

const row = (href, title, line, label = "", cta = "Apply →") => `<tr><td style="padding:16px 4px;border-top:1px solid #d9dcea">${label ? `<div style="${F};font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#8b3dff;padding-bottom:4px">${label}</div>` : ""}<a href="${href}" style="${F};font-size:16px;font-weight:700;color:#0b0e1d;text-decoration:none">${esc(title)}</a><div style="${F};font-size:15px;color:#6b7290;margin-top:3px">${line}</div><a href="${href}" style="${F};display:inline-block;margin-top:8px;font-size:15px;font-weight:700;color:#2f6bff;text-decoration:none">${cta}</a></td></tr>`;

// Returns { subject, preheader, html } or null when there's nothing worth sending
export function weeklyEmail({ roles, total = 0, sponsor = null, post = null, date = new Date() }) {
  if (!roles || roles.length < 3) return null;
  const best = Math.max(...roles.map((j) => j.max || j.min || 0));
  const when = date.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "Europe/London" });
  const subject = best ? `This week's best remote AI roles (up to $${best}/hr)` : "This week's best remote AI roles";
  const preheader = `${roles.length} hand-picked roles with the pay shown. Free to apply.`;
  const roleRows = roles.map((j) => row(`${S}/go/${encodeURIComponent(j.id)}?src=${SRC}`, j.title, [pay(j), `via ${esc(j.via || j.platform)}`, j.domain ? esc(j.domain) : ""].filter(Boolean).join(" · "))).join("");
  const sponsorRows = sponsor ? row(`${S}/go/sponsored-${encodeURIComponent(sponsor.id)}?src=email`, sponsor.title, [esc(sponsor.company || ""), sponsor.pay ? esc(sponsor.pay) : ""].filter(Boolean).join(" · "), "Sponsored") : "";
  const news = post ? section("From the news", row(`${S}/news/${encodeURIComponent(post.slug)}?src=email`, post.title, esc(String(post.summary || "").slice(0, 160)), "", "Read more →")) : "";
  const join = `<tr><td align="center" style="padding:30px 40px 0;${F};font-size:16px;line-height:1.6;color:#5d6482">New here? Join the platforms free: <a href="${S}/join/micro1?src=email" style="color:#2f6bff;font-weight:700;text-decoration:none">micro1</a> · <a href="${S}/join/mercor?src=email" style="color:#2f6bff;font-weight:700;text-decoration:none">Mercor</a> · <a href="${S}/join/ethos?src=email" style="color:#2f6bff;font-weight:700;text-decoration:none">Ethos</a><br><span style="font-size:14px">Real platforms never charge you to apply.</span></td></tr>`;

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>GigrAI</title><style>u + .body .gb-s{background:#000;mix-blend-mode:screen;display:inline-block}u + .body .gb-d{background:#000;mix-blend-mode:difference;display:inline-block}.addr a,a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important;font-weight:inherit!important}</style></head>
<body class="body" style="margin:0;padding:0;background:#ffffff">
<div style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff"><tr><td align="center" style="padding:0 10px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<tr><td align="center" style="padding:36px 36px 0"><a href="${S}/?src=email"><img src="${IMG}/gigrai-icon.png" width="56" height="56" alt="GigrAI" style="display:block;width:56px;height:56px;border:0;border-radius:14px"></a></td></tr>
<tr><td align="center" style="padding:18px 36px 0;${F};font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8b3dff">Week of ${esc(when)}</td></tr>
<tr><td align="center" style="padding:10px 36px 0;${F};font-size:38px;line-height:1.12;font-weight:800;color:#0b0e1d;letter-spacing:-.03em">This week's best<br>remote AI roles.</td></tr>
<tr><td align="center" style="padding:14px 40px 0;${F};font-size:17px;line-height:1.5;color:#5d6482">${total ? `${total.toLocaleString("en-GB")} live roles on GigrAI right now. ` : ""}Here are ${roles.length} worth a look, with the pay shown.</td></tr>
<tr><td align="center">${btn(`${S}/?src=email`, "See every live role")}</td></tr>
${section("Top picks", roleRows + sponsorRows)}
${news}
${join}
<tr><td style="padding:40px 10px 30px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="#f3f4fa" style="background:#f3f4fa;border-radius:20px;padding:28px 26px 0;${F};font-size:13px;line-height:1.6;color:#6b7290">
You're getting this because you signed up for job alerts at <a href="${S}/?src=email" style="color:#6b7290;text-decoration:none">remotegigrai.com</a>. Pay and details come from each platform's listing, so check them before you apply.<br><br>
Some links are referral links: we may get a reward if you join a platform, at no cost to you. It never changes your pay.<br><br>
<span class="addr">GigrAI<br>Suite RA01, 195-197 Wood Street<br>London E17 3NU, United Kingdom</span><br><br>
<a href="https://www.instagram.com/gigr.ai" style="color:#0b0e1d;font-weight:700;text-decoration:none">Instagram</a> &nbsp;|&nbsp; <a href="{$unsubscribe}" style="color:#0b0e1d;font-weight:700;text-decoration:none">Unsubscribe</a>
<div style="${F};font-size:96px;line-height:.9;font-weight:900;letter-spacing:-.04em;color:#e3e5f6;padding-top:22px;overflow:hidden;white-space:nowrap">GigrAI</div>
</td></tr></table></td></tr>
</table></td></tr></table></body></html>`;
  return { subject, preheader, html };
}

// Is it Monday, 9am or later, in the UK?
export function londonNow(d = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", hour: "numeric", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d).map((p) => [p.type, p.value]));
  return { day: parts.weekday, hour: +parts.hour, date: `${parts.year}-${parts.month}-${parts.day}` };
}

// Create the MailerLite campaign for the GigrAI Jobs group and (if mode is "on") send it now
export async function mlSendCampaign(env, email, mode) {
  const api = env.MAILERLITE_API || "https://connect.mailerlite.com/api";
  const headers = { "content-type": "application/json", accept: "application/json", authorization: `Bearer ${env.MAILERLITE_TOKEN}` };
  const name = `Weekly top roles · ${londonNow().date}`;
  const r = await fetch(`${api}/campaigns`, { method: "POST", headers, body: JSON.stringify({
    name, type: "regular", groups: [String(env.MAILERLITE_GROUP_ID)],
    emails: [{ subject: email.subject, from_name: "GigrAI", from: "alerts@remotegigrai.com", reply_to: "partners@remotegigrai.com", content: email.html }],
  }) });
  if (!r.ok) throw new Error(`campaign create ${r.status} ${(await r.text()).slice(0, 300)}`);
  const id = (await r.json()).data?.id;
  if (mode !== "on") return { id, sent: false };
  const s = await fetch(`${api}/campaigns/${id}/schedule`, { method: "POST", headers, body: JSON.stringify({ delivery: "instant" }) });
  if (!s.ok) throw new Error(`campaign send ${s.status} ${(await s.text()).slice(0, 300)}`);
  return { id, sent: true };
}
