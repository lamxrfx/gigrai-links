// Checks a link an advertiser gives us before it can go on the site.
// fail = we refuse it; warn = accepted but flagged for a human to look at.
const SHORTENERS = /(^|\.)(bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|is\.gd|cutt\.ly|rebrand\.ly|shorturl\.at|t\.ly|buff\.ly|tiny\.cc|rb\.gy|s\.id|bl\.ink|lnkd\.in|short\.io|shorte\.st|adf\.ly|linktr\.ee)$/i;
const RISKY_TLD = /\.(zip|mov|top|xyz|click|country|kim|gq|tk|ml|cf|ga|work|rest|cam|loan|men|mom|lol|quest|sbs|cfd|buzz|monster)$/i;
const PRIVATE = /^(localhost|.*\.local|.*\.internal)$|^(\d{1,3}\.){3}\d{1,3}$|^\[|:/;

const host = (u) => { try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; } };
const base = (h) => h.split(".").slice(-2).join(".");
// Well-known hiring and form tools: fine for an application link to live on these
const ATS = /(^|\.)(greenhouse\.io|lever\.co|ashbyhq\.com|workable\.com|bamboohr\.com|smartrecruiters\.com|recruitee\.com|teamtailor\.com|breezy\.hr|jobvite\.com|myworkdayjobs\.com|icims\.com|rippling-ats\.com|wellfound\.com|typeform\.com|tally\.so|jotform\.com|airtable\.com|notion\.site|forms\.gle|docs\.google\.com)$/i;

// Cloudflare's free malware-blocking DNS answers 0.0.0.0 for known malware/phishing sites
async function flaggedByCloudflare(h) {
  try {
    const r = await fetch(`https://security.cloudflare-dns.com/dns-query?name=${encodeURIComponent(h)}&type=A`, { headers: { accept: "application/dns-json" }, signal: AbortSignal.timeout(4000) });
    const d = await r.json();
    return (d.Answer || []).some((a) => a.data === "0.0.0.0");
  } catch { return false; }
}

export async function vetLink(raw, companySite = "") {
  const reasons = [], warns = [];
  let u;
  try { u = new URL(String(raw || "").trim()); } catch { return { result: "fail", reasons: ["That isn't a valid web address."], warns }; }
  if (u.protocol !== "https:") reasons.push("The link must start with https:// (secure).");
  if (u.username || u.password) reasons.push("Links with a username or password in them aren't allowed.");
  const h = u.hostname.toLowerCase();
  if (PRIVATE.test(h)) reasons.push("Please use the public web address, not an IP address or local address.");
  if (SHORTENERS.test(h)) reasons.push("Please use the full application link, not a shortened link.");
  if (reasons.length) return { result: "fail", reasons, warns };
  if (RISKY_TLD.test(h)) warns.push(`Unusual domain ending (${h.split(".").pop()}).`);
  if (h.startsWith("xn--") || h.includes(".xn--")) warns.push("Domain uses special characters (possible look-alike).");

  if (await flaggedByCloudflare(h)) return { result: "fail", reasons: ["This site is flagged for malware or phishing."], warns };

  // Open it the way a visitor would, following redirects one at a time
  let url = u.toString(), finalUrl = url, status = 0, type = "", hops = 0;
  try {
    for (; hops < 6; hops++) {
      const r = await fetch(url, { redirect: "manual", headers: { "user-agent": "Mozilla/5.0 (compatible; GigrAI link check; +https://remotegigrai.com/advertise)", accept: "text/html,*/*" }, signal: AbortSignal.timeout(6000) });
      status = r.status; type = r.headers.get("content-type") || "";
      const loc = r.headers.get("location");
      if (status >= 300 && status < 400 && loc) {
        const next = new URL(loc, url);
        if (next.protocol !== "https:") { reasons.push("The link redirects to an insecure (http) page."); break; }
        if (PRIVATE.test(next.hostname)) { reasons.push("The link redirects to a private address."); break; }
        url = next.toString(); finalUrl = url; continue;
      }
      break;
    }
  } catch {
    warns.push("We couldn't open the link to check it (it may block automated checks).");
  }
  if (reasons.length) return { result: "fail", reasons, warns, finalUrl };
  if (hops >= 6) warns.push("The link redirects too many times.");
  if (status >= 400) warns.push(`The page returned an error (${status}).`);
  if (type && !/text\/html|application\/xhtml/i.test(type)) warns.push(`The link opens a file (${type.split(";")[0]}), not a web page.`);
  const fh = host(finalUrl);
  if (fh && base(fh) !== base(host(u.toString()))) {
    if (await flaggedByCloudflare(fh)) return { result: "fail", reasons: ["The link redirects to a site flagged for malware or phishing."], warns, finalUrl };
    warns.push(`The link ends up on a different site (${fh}).`);
  }
  const site = host(companySite);
  if (site && fh && base(site) !== base(fh) && !ATS.test(fh)) warns.push(`The link's site (${fh}) isn't the company website (${site}).`);
  return { result: warns.length ? "warn" : "pass", reasons, warns, finalUrl, status };
}
