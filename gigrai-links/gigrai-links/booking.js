// Client booking checkout: /book/<ref>?t=<signed code>
// The advertiser confirms their package and dates, fills in the job details, accepts the Advertising Terms
// and pays by card (Stripe Checkout). After payment the Sponsored listing is created, waiting for approval in /admin/sponsored.
import { shell, html, esc, ARROW } from "./seo.js";

const money = (pence) => "£" + (pence / 100).toFixed(pence % 100 ? 2 : 0);
const longDate = (d) => d ? new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "–";

const STYLE = `<style>
.bk{max-width:720px;margin:0 auto;display:grid;gap:18px}
.bk .card{padding:20px;border-radius:22px;background:var(--glass);border:1px solid var(--line)}
.bk h2{margin:0 0 6px;font-size:21px;display:flex;gap:10px;align-items:center}.bk h2 i{font-style:normal;display:inline-grid;place-items:center;width:28px;height:28px;border-radius:999px;background:linear-gradient(110deg,#22d3ee,#2f6bff 55%,#8b3dff);color:#fff;font-size:14px}
.bk .sum{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 14px;font-size:15px}.bk .sum span{color:var(--muted)}.bk .sum b{text-align:right}
.bk .total{margin-top:10px;padding-top:12px;border-top:1px solid var(--line);display:flex;justify-content:space-between;font-size:20px;font-weight:800}
.bk form{display:grid;gap:14px}.bk label{display:grid;gap:6px;font-weight:700;font-size:14px;color:var(--soft)}.bk label small{font-weight:500;color:var(--muted)}
.bk input,.bk select,.bk textarea{width:100%;box-sizing:border-box;min-width:0;border-radius:12px;border:1px solid var(--line);background:#0d1024;color:var(--text);font:inherit;font-size:16px;padding:12px 14px;min-height:50px}
.bk textarea{min-height:120px;resize:vertical;line-height:1.55}
.bk .row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:end}@media (max-width:560px){.bk .row{grid-template-columns:minmax(0,1fr)}}
.bk .agree{display:flex;gap:12px;align-items:flex-start;font-weight:500;color:var(--soft);font-size:14.5px;line-height:1.55}.bk .agree input{width:24px;height:24px;min-height:0;flex:0 0 24px;margin-top:2px;accent-color:#2f6bff}
.bk .agree a,.bk .note a{color:#9fdcf0}
.bk .pay{height:56px;border:0;border-radius:999px;font:inherit;font-weight:800;font-size:17px;color:#fff;cursor:pointer;background:linear-gradient(110deg,#22d3ee,#2f6bff 55%,#8b3dff);display:flex;gap:10px;align-items:center;justify-content:center}
.bk .err{padding:12px 16px;border-radius:12px;background:rgba(255,107,107,.12);border:1px solid rgba(255,107,107,.4);color:#ffd0d0}
.bk .ok{padding:12px 16px;border-radius:12px;background:rgba(61,214,140,.12);border:1px solid rgba(61,214,140,.35)}
.bk .note{font-size:13.5px;color:var(--muted);line-height:1.6}.bk .lock{display:flex;gap:8px;align-items:center;justify-content:center;font-size:13px;color:var(--muted)}
.bk ol.next{margin:0;padding-left:20px;display:grid;gap:8px}
</style>`;

const page = (title, body, status = 200) => {
  const r = html(shell({ title: `${title} · GigrAI`, desc: "Your GigrAI booking.", canonical: "", robots: "noindex,nofollow", body: STYLE + `<div class="bk">${body}</div>` }), status);
  const h = new Headers(r.headers); h.set("cache-control", "private, no-store"); h.set("referrer-policy", "no-referrer");
  return new Response(r.body, { status, headers: h });
};

export function bookingClosed(msg, email) {
  return page("Booking link", `<section class="hero sm" style="text-align:center"><span class="eyebrow"><i></i>Your booking</span><h1>This link <span class="grad-text">isn't available</span></h1><p>${esc(msg)} Email <a href="mailto:${esc(email)}">${esc(email)}</a> and we'll sort it.</p></section>`, 410);
}

// The checkout page: 1 package, 2 job details, 3 terms, then pay
export function bookingPage({ ref, t, q, offer, error = "", cancelled = false, stripeOn = true, email }) {
  const d = q.data, det = d.details || {};
  const v = (k, fb = "") => esc(det[k] ?? fb);
  const free = offer.price === 0;
  const body = `<section class="hero sm" style="padding-bottom:0"><span class="eyebrow"><i></i>Booking ${esc(ref)}</span><h1>Confirm your <span class="grad-text">GigrAI booking</span></h1><p>Hi ${esc((d.name || "").split(" ")[0] || "there")}, check your package, add the job details, accept the terms and ${free ? "confirm" : "pay"}. It takes about 3 minutes.</p></section>
${cancelled ? `<p class="err">Payment wasn't completed, so nothing has been charged. You can try again below.</p>` : ""}${error ? `<p class="err">${esc(error)}</p>` : ""}
<div class="card"><h2><i>1</i>Your package</h2>
<div class="sum"><span>Package</span><b>${esc(offer.option)}</b><span>Company</span><b>${esc(d.company)}</b><span>Starts</span><b>${longDate(offer.start)}</b><span>Ends</span><b>${longDate(offer.until)}</b>${offer.budget ? `<span>Pay per click</span><b>${money(Math.round(offer.cpc * 100))} a unique click, up to ${Math.floor(offer.budget / offer.cpc)} clicks</b>` : ""}</div>
<div class="total"><span>Total</span><span>${free ? "Free" : money(offer.price)}</span></div>
<p class="note">Prices in GBP. Dates run on UK time. Something not right? Email <a href="mailto:${esc(email)}?subject=${encodeURIComponent("Booking " + ref)}">${esc(email)}</a> before paying.</p></div>
<form method="post" action="/book/${esc(ref)}?t=${esc(t)}" class="card" style="display:grid;gap:14px">
<h2><i>2</i>Job details</h2><p class="note" style="margin:0">We use these to write your Sponsored listing${/instagram|whatsapp|bundle/i.test(offer.option) ? " and your social posts" : ""}. Only include what's in your real job listing.</p>
<label>Job title<input name="title" required maxlength="120" value="${v("title", d.role)}" placeholder="e.g. AI Trainer (Maths)"></label>
<div class="row"><label>Pay <small>e.g. "$40–60/hr"</small><input name="pay" required maxlength="40" value="${v("pay", d.pay)}"></label><label>Who can apply <small>Countries or "Worldwide"</small><input name="countries" required maxlength="120" value="${v("countries")}"></label></div>
<label>Short line for the listing <small>Up to 140 characters, e.g. "Remote, flexible hours. Free to apply."</small><input name="blurb" maxlength="140" value="${v("blurb")}"></label>
<label>About the role <small>What the work is, hours, and what makes it worth applying</small><textarea name="desc" required minlength="60" maxlength="3000">${v("desc")}</textarea></label>
<label>Requirements <small>Skills, qualifications or languages needed</small><textarea name="reqs" maxlength="1500">${v("reqs")}</textarea></label>
<label>Application link <small>Your own page where people apply (https)</small><input name="url" type="url" required value="${v("url", d.url)}"></label>
<div class="row"><label>Logo link <small>Optional, a link to your logo image</small><input name="logo" type="url" value="${v("logo")}"></label><label>Anything else? <small>Optional</small><input name="extra" maxlength="300" value="${v("extra")}"></label></div>
<h2 style="margin-top:8px"><i>3</i>Terms</h2>
<label>Your full name <small>Typed as your signature</small><input name="sign" required maxlength="80" value="${esc(d.name || "")}"></label>
<label class="agree"><input type="checkbox" name="agree" value="1" required><span>I confirm the role is real and <b>free to apply for</b>, I'm happy for it to be labelled Sponsored, and I agree to the <a href="/advertise/terms" target="_blank">Advertising Terms</a> on behalf of ${esc(d.company)}.</span></label>
<button class="pay" type="submit">${free ? "Confirm booking" : `Continue to secure payment · ${money(offer.price)}`} ${ARROW}</button>
${free ? "" : `<p class="lock">🔒 Card payment by Stripe. GigrAI never sees your card details. A receipt is emailed to you.</p>`}
${!free && !stripeOn ? `<p class="note">Card payment isn't switched on yet: we'll email you a payment link after you submit.</p>` : ""}
</form>`;
  return page("Confirm your booking", body);
}

export function bookingDone({ ref, q, paid, reportLink, email, pending = false }) {
  const d = q.data, o = d.offer || {};
  const body = `<section class="hero sm" style="text-align:center"><span class="eyebrow"><i></i>Booking ${esc(ref)}</span><h1>${paid ? "You're booked." : pending ? "Details received." : "Payment not completed"} <span class="grad-text">${paid ? "Thank you!" : ""}</span></h1>
<p>${paid ? `${esc(o.option)} for ${esc(d.company)}, ${longDate(o.start)} to ${longDate(o.until)}.${d.paid && d.paid.amount ? ` Paid ${money(d.paid.amount)}. Your receipt is on its way from Stripe.` : ""}` : pending ? "Thanks. We'll email you a secure payment link shortly." : "Nothing was charged. You can go back and try again."}</p></section>
${paid ? `<div class="card"><h2>What happens next</h2><ol class="next"><li>We check your details and write your listing${/instagram|whatsapp|bundle/i.test(o.option || "") ? " and posts" : ""}.</li><li>It goes live on <b>${longDate(o.start)}</b>, labelled Sponsored.</li><li>Track it with your private live report:${reportLink ? ` <a href="${esc(reportLink)}" style="color:#9fdcf0;word-break:break-all">${esc(reportLink)}</a>` : ""}. Bookmark it. It works until two weeks after your campaign ends.</li></ol></div>` : ""}
<p class="note" style="text-align:center">Questions? Email <a href="mailto:${esc(email)}">${esc(email)}</a> and quote ${esc(ref)}.</p>`;
  return page(paid ? "Booking confirmed" : "Booking", body);
}
