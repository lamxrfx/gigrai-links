/* Email job alerts. Loaded on every page only when EMAIL_SIGNUP is "on" in wrangler.jsonc.
   Turns every "Job alerts" / WhatsApp prompt into an email sign-up, with WhatsApp kept as a small option. */
(function () {
  if (window.__ggAlertsLoaded) return; window.__ggAlertsLoaded = 1; // may be included twice on some pages
  var WA = "https://whatsapp.com/channel/0029VbDkhLPKgsO0zsOZ080u";
  var TRIGGERS = ["header-whatsapp", "menu-whatsapp", "news-whatsapp", "post-whatsapp", "search-empty-whatsapp", "email-alerts"];
  var FIELDS = ["Writing", "Coding", "Research", "Medical", "Finance", "Legal", "Languages", "Maths", "Design", "Data"];
  var COUNTRIES = [["GBR","United Kingdom"],["USA","United States"],["ARG","Argentina"],["AUS","Australia"],["AUT","Austria"],["BGD","Bangladesh"],["BRB","Barbados"],["BEL","Belgium"],["BRA","Brazil"],["BGR","Bulgaria"],["CAN","Canada"],["CHL","Chile"],["CHN","China"],["COL","Colombia"],["HRV","Croatia"],["CYP","Cyprus"],["CZE","Czechia"],["DNK","Denmark"],["EGY","Egypt"],["EST","Estonia"],["ETH","Ethiopia"],["FIN","Finland"],["FRA","France"],["DEU","Germany"],["GHA","Ghana"],["GRC","Greece"],["HKG","Hong Kong SAR China"],["HUN","Hungary"],["ISL","Iceland"],["IND","India"],["IDN","Indonesia"],["IRL","Ireland"],["ISR","Israel"],["ITA","Italy"],["JAM","Jamaica"],["JPN","Japan"],["KEN","Kenya"],["LVA","Latvia"],["LTU","Lithuania"],["LUX","Luxembourg"],["MYS","Malaysia"],["MLT","Malta"],["MEX","Mexico"],["MAR","Morocco"],["NPL","Nepal"],["NLD","Netherlands"],["NZL","New Zealand"],["NGA","Nigeria"],["NOR","Norway"],["PAK","Pakistan"],["PER","Peru"],["PHL","Philippines"],["POL","Poland"],["PRT","Portugal"],["QAT","Qatar"],["ROU","Romania"],["SAU","Saudi Arabia"],["SRB","Serbia"],["SGP","Singapore"],["SVK","Slovakia"],["SVN","Slovenia"],["ZAF","South Africa"],["KOR","South Korea"],["ESP","Spain"],["LKA","Sri Lanka"],["SWE","Sweden"],["CHE","Switzerland"],["TWN","Taiwan"],["THA","Thailand"],["TTO","Trinidad & Tobago"],["TUR","Türkiye"],["UGA","Uganda"],["UKR","Ukraine"],["ARE","United Arab Emirates"],["VNM","Vietnam"],["","Somewhere else"]];
  var CONSENT = "Email me new remote AI roles and GigrAI news. I can unsubscribe at any time.";

  var css = document.createElement("style");
  css.textContent = [
    ".ga{position:fixed;inset:0;margin:auto;width:min(94vw,480px);max-height:92vh;padding:0;border:1px solid rgba(255,255,255,.14);border-radius:26px;background:#0d1024;color:#f2f4ff;font-family:'Plus Jakarta Sans',system-ui,sans-serif;overflow:auto}",
    ".ga::backdrop{background:rgba(3,4,12,.65);backdrop-filter:blur(4px)}",
    ".ga-in{padding:24px 22px 20px;display:grid;gap:14px;background:radial-gradient(120% 50% at 100% 0,rgba(139,61,255,.2),transparent),radial-gradient(90% 40% at 0 0,rgba(47,107,255,.16),transparent)}",
    ".ga-h{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.ga h2{margin:0;font-size:23px;font-weight:800;letter-spacing:-.01em}.ga p{margin:0;color:#b8bfdc;font-size:14.5px;line-height:1.5}",
    ".ga-x{flex:0 0 44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#f2f4ff;cursor:pointer;display:grid;place-items:center}",
    ".ga label.f{display:grid;gap:6px;font-size:13px;font-weight:700;color:#b8bfdc}",
    ".ga input[type=email],.ga select{height:50px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:#141834;color:#f2f4ff;font:inherit;font-size:16px;padding:0 14px;width:100%}",
    ".ga fieldset{border:0;margin:0;padding:0;display:grid;gap:8px}.ga legend{font-size:13px;font-weight:700;color:#b8bfdc;margin-bottom:6px}",
    ".ga .chips{display:flex;flex-wrap:wrap;gap:6px}.ga .chips label{cursor:pointer}.ga .chips input{position:absolute;opacity:0;width:1px;height:1px}",
    ".ga .chips span{display:inline-flex;align-items:center;height:36px;padding:0 13px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);font-size:13.5px;font-weight:600;color:#e2e6f8}",
    ".ga .chips input:checked+span{background:#f2f4ff;color:#070914;border-color:#f2f4ff}.ga .chips input:focus-visible+span{outline:3px solid #22d3ee;outline-offset:2px}",
    ".ga .consent{display:flex;gap:10px;align-items:flex-start;font-size:13.5px;color:#e2e6f8;line-height:1.45;cursor:pointer}.ga .consent input{width:20px;height:20px;margin-top:1px;accent-color:#5b8cff;flex:0 0 auto}",
    ".ga .go{height:54px;border:0;border-radius:999px;background:linear-gradient(110deg,#22d3ee,#2f6bff 55%,#8b3dff);color:#fff;font:inherit;font-weight:800;font-size:16px;cursor:pointer}",
    ".ga .go[disabled]{opacity:.6;cursor:wait}",
    ".ga .small{font-size:12.5px;color:#9aa3c7;line-height:1.5}.ga .small a{color:#9fdcf0}",
    ".ga .wa{background:none!important;border:0;display:flex;align-items:center;justify-content:center;gap:8px;color:#9ff0c5;font-size:14px;font-weight:700;text-decoration:none;padding:6px}",
    ".ga .msg{font-size:14px;min-height:20px}.ga .msg.err{color:#ffb3b3}",
    ".ga .done{text-align:center;display:grid;gap:12px;padding:10px 0}.ga .done b{font-size:21px}",
    ".ga-hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}"
  ].join("\n");
  document.head.appendChild(css);

  var dlg, source = "site";
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function build() {
    dlg = document.createElement("dialog");
    dlg.className = "ga"; dlg.setAttribute("aria-labelledby", "gaT");
    dlg.innerHTML = '<form class="ga-in" novalidate>' +
      '<div class="ga-h"><div><h2 id="gaT">Get new roles by email</h2><p>The best new remote AI roles for you, once a week. Free.</p></div>' +
      '<button type="button" class="ga-x" aria-label="Close" data-x><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>' +
      '<label class="f">Your email<input type="email" name="email" autocomplete="email" required placeholder="you@example.com"></label>' +
      '<label class="f">Where you live<select name="country">' + COUNTRIES.map(function (c) { return '<option value="' + c[0] + '">' + c[1] + "</option>"; }).join("") + "</select></label>" +
      '<fieldset><legend>What kind of work? <span style="font-weight:500">(optional)</span></legend><div class="chips">' + FIELDS.map(function (f) { return '<label><input type="checkbox" name="interests" value="' + f + '"><span>' + f + "</span></label>"; }).join("") + "</div></fieldset>" +
      '<label class="f"><span>Minimum pay <span style="font-weight:500">(optional)</span></span><select name="minpay"><option value="0">Any pay</option><option value="25">$25+/hr</option><option value="50">$50+/hr</option><option value="100">$100+/hr</option></select></label>' +
      '<div class="ga-hp" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div>' +
      '<label class="consent"><input type="checkbox" name="consent" required><span>' + CONSENT + "</span></label>" +
      '<button class="go" type="submit">Get job alerts</button>' +
      '<p class="msg" aria-live="polite"></p>' +
      '<p class="small">We\'ll email you to confirm first. Your details are kept by our email provider, MailerLite, and never sold. See our <a href="/privacy">privacy page</a>.</p>' +
      '<a class="wa" href="' + WA + '" target="_blank" rel="noopener" data-track="alerts-modal-whatsapp">Prefer WhatsApp? Join the channel</a>' +
      "</form>";
    document.body.appendChild(dlg);
    dlg.querySelector("[data-x]").addEventListener("click", function () { dlg.close(); });
    dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
    dlg.querySelector("form").addEventListener("submit", submit);
    // pre-fill the country from where the visitor is
    try {
      var saved = JSON.parse(localStorage.getItem("gg_country") || "null");
      if (saved) dlg.querySelector("select[name=country]").value = saved;
      else fetch("/api/where").then(function (r) { return r.json(); }).then(function (w) {
        var s = dlg.querySelector("select[name=country]");
        if (w.iso3 && [].some.call(s.options, function (o) { return o.value === w.iso3; })) s.value = w.iso3;
      }).catch(function () {});
    } catch (_) {}
  }

  async function submit(e) {
    e.preventDefault();
    var f = e.target, msg = f.querySelector(".msg"), btn = f.querySelector(".go");
    msg.className = "msg"; msg.textContent = "";
    var email = f.email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { msg.className = "msg err"; msg.textContent = "Please enter a valid email."; f.email.focus(); return; }
    if (!f.consent.checked) { msg.className = "msg err"; msg.textContent = "Please tick the box to agree to receive emails."; return; }
    btn.disabled = true; btn.textContent = "Signing you up…";
    try {
      var r = await fetch("/api/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        email: email, country: f.country.value, minpay: +f.minpay.value || 0,
        interests: [].slice.call(f.querySelectorAll("input[name=interests]:checked")).map(function (x) { return x.value; }),
        consent: true, consentText: CONSENT, source: source, page: location.pathname, website: f.website.value
      }) });
      var d = await r.json();
      if (!d.ok) throw new Error(d.error || "Something went wrong. Please try again.");
      f.innerHTML = '<div class="done"><b>Check your inbox ✉️</b><p>We\'ve sent a confirmation email to <strong>' + esc(email) + '</strong>. Tap the link inside to start getting roles. (Check spam if it doesn\'t arrive.)</p><button type="button" class="go" data-x>Done</button></div>';
      f.querySelector("[data-x]").addEventListener("click", function () { dlg.close(); });
      try { localStorage.setItem("gg_alerts", "1"); } catch (_) {}
    } catch (err) {
      msg.className = "msg err"; msg.textContent = err.message; btn.disabled = false; btn.textContent = "Get job alerts";
    }
  }

  // opts (optional): { country: "POL", title: "...", text: "..." }
  function open(src, opts) {
    if (!dlg) build();
    source = src || "site";
    opts = opts || {};
    var h = dlg.querySelector("#gaT"), p = h && h.parentElement.querySelector("p");
    if (h) h.textContent = opts.title || "Get new roles by email";
    if (p) p.textContent = opts.text || "The best new remote AI roles for you, once a week. Free.";
    var sel = dlg.querySelector("select[name=country]");
    if (sel && opts.country && [].some.call(sel.options, function (o) { return o.value === opts.country; })) sel.value = opts.country;
    if (!dlg.open) dlg.showModal();
    setTimeout(function () { var i = dlg.querySelector("input[type=email]"); if (i) i.focus(); }, 50);
  }
  window.ggAlerts = { open: open, signedUp: function () { try { return !!localStorage.getItem("gg_alerts"); } catch (_) { return false; } } };

  // Every job-alert prompt now opens the email form
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("[data-track]");
    if (!a || TRIGGERS.indexOf(a.getAttribute("data-track")) < 0) return;
    e.preventDefault();
    var gm = document.getElementById("gm"); if (gm && gm.open) gm.close();
    open(a.getAttribute("data-track").replace(/-whatsapp$/, "").replace("search-empty", "no-results"));
  }, true);

  // Reword the prompts that mentioned WhatsApp
  function relabel() {
    document.querySelectorAll('[data-track="menu-whatsapp"]:not([data-ga]), [data-track="news-whatsapp"]:not([data-ga]), [data-track="post-whatsapp"]:not([data-ga]), [data-track="search-empty-whatsapp"]:not([data-ga]), [aria-label="Job alerts on WhatsApp"]:not([data-ga])').forEach(function (a) {
      a.setAttribute("data-ga", "1");
      var t = a.getAttribute("data-track");
      if (a.getAttribute("aria-label") === "Job alerts on WhatsApp") a.setAttribute("aria-label", "Job alerts by email");
      if (t === "menu-whatsapp") { if (a.lastChild) a.lastChild.textContent = "Get job alerts by email"; a.style.background = "linear-gradient(110deg,#22d3ee,#2f6bff 55%,#8b3dff)"; a.style.color = "#fff"; }
      if (t === "news-whatsapp" || t === "post-whatsapp" || t === "search-empty-whatsapp") {
        a.textContent = "Get email alerts";
        var p = a.parentElement && a.parentElement.querySelector("p");
        if (p) p.innerHTML = p.innerHTML.replace(/Join the free GigrAI Jobs WhatsApp channel\./, "Get the best new roles by email, free.");
      }
    });
  }
  relabel();
  new MutationObserver(function () { relabel(); }).observe(document.body, { childList: true, subtree: true });
})();
