// GigrAI assistant widget: a chat bubble on every page. Talks to /api/chat (see chat.js on the server).
// The conversation is kept only in this browser tab (sessionStorage) and is never saved by us.
(function () {
  if (window.__ggChat) return; window.__ggChat = 1;
  var KEY = "gg-chat-v1", msgs = [], roles = {}, busy = false, country = "";
  try { var s = JSON.parse(sessionStorage.getItem(KEY) || "null"); if (s && Array.isArray(s.m)) { msgs = s.m.slice(-12); roles = s.r || {}; } } catch (e) {}
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify({ m: msgs.slice(-12), r: roles })); } catch (e) {} }

  var css = ''
    + '.ggc-b{position:fixed;right:max(16px,env(safe-area-inset-right));bottom:var(--ggc-y,20px);z-index:45;display:flex;align-items:center;gap:8px;height:52px;padding:0 18px 0 14px;border:0;border-radius:999px;cursor:pointer;color:#fff;font:700 14px/1 "Plus Jakarta Sans",system-ui,sans-serif;background:linear-gradient(110deg,#22d3ee,#2f6bff 55%,#8b3dff);box-shadow:0 14px 30px -10px rgba(47,107,255,.9)}'
    + '.ggc-b svg{width:22px;height:22px}.ggc-b:focus-visible,.ggc-x:focus-visible,.ggc-send:focus-visible{outline:2px solid #7fdcf0;outline-offset:3px}'
    + '@media(max-width:700px){.ggc-b{height:46px;padding:0 15px 0 12px;font-size:13.5px}}'
    + '.ggc-p{position:fixed;right:max(16px,env(safe-area-inset-right));bottom:var(--ggc-y,20px);z-index:90;width:min(390px,calc(100vw - 32px));height:min(600px,calc(100dvh - var(--ggc-y,20px) - 24px));display:none;flex-direction:column;border-radius:22px;overflow:hidden;background:#0d1024;border:1px solid rgba(255,255,255,.18);box-shadow:0 30px 60px -20px rgba(0,0,0,.9);color:#eef1ff;font:400 15px/1.5 "Plus Jakarta Sans",system-ui,sans-serif}'
    + '.ggc-p.on{display:flex}'
    + '@media(max-width:520px){.ggc-p{right:0;left:0;bottom:0;width:auto;height:min(88dvh,640px);border-radius:22px 22px 0 0;padding-bottom:env(safe-area-inset-bottom)}}'
    + '.ggc-h{display:flex;align-items:center;gap:10px;padding:14px 14px 12px 16px;border-bottom:1px solid rgba(255,255,255,.1)}'
    + '.ggc-h b{display:block;font-size:15px}.ggc-h small{display:block;color:#a9b0cc;font-size:12px}'
    + '.ggc-dot{width:30px;height:30px;flex:none;border-radius:50%;background:linear-gradient(110deg,#22d3ee,#2f6bff 55%,#8b3dff);display:grid;place-items:center}.ggc-dot svg{width:16px;height:16px}'
    + '.ggc-x{margin-left:auto;width:36px;height:36px;border:0;border-radius:50%;background:rgba(255,255,255,.08);color:#fff;font-size:20px;cursor:pointer}'
    + '.ggc-l{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:14px 14px 6px;display:flex;flex-direction:column;gap:10px}'
    + '.ggc-m{max-width:88%;padding:10px 13px;border-radius:16px;white-space:pre-wrap;word-wrap:break-word}'
    + '.ggc-m.u{align-self:flex-end;background:#2f6bff;color:#fff;border-bottom-right-radius:5px}'
    + '.ggc-m.a{align-self:flex-start;background:rgba(255,255,255,.07);border-bottom-left-radius:5px}'
    + '.ggc-m a{color:#7fdcf0}.ggc-m ul{margin:4px 0;padding-left:18px;white-space:normal}'
    + '.ggc-r{display:flex;flex-direction:column;gap:8px;align-self:stretch}'
    + '.ggc-c{display:block;padding:11px 13px;border-radius:14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);color:inherit;text-decoration:none}'
    + '.ggc-c:hover{border-color:#7fdcf0}.ggc-c b{display:block;font-size:14px;line-height:1.35}.ggc-c span{display:block;margin-top:3px;color:#a9b0cc;font-size:12.5px}'
    + '.ggc-c i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#34d399;margin-right:5px;vertical-align:1px}.ggc-c em{font-style:normal;color:#7fdcf0;font-weight:700}'
    + '.ggc-s{display:flex;flex-wrap:wrap;gap:6px;padding:2px 14px 8px}'
    + '.ggc-s button{border:1px solid rgba(255,255,255,.18);background:transparent;color:#dfe4ff;border-radius:999px;padding:7px 11px;font:600 12.5px/1 inherit;font-family:inherit;cursor:pointer}'
    + '.ggc-f{display:flex;gap:8px;padding:10px 12px 12px;border-top:1px solid rgba(255,255,255,.1)}'
    + '.ggc-f textarea{flex:1;resize:none;height:44px;max-height:110px;padding:11px 13px;border-radius:14px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.05);color:#fff;font:16px/1.35 inherit;font-family:inherit}'
    + '.ggc-f textarea:focus{outline:none;border-color:#7fdcf0}'
    + '.ggc-send{width:44px;height:44px;flex:none;border:0;border-radius:14px;cursor:pointer;color:#fff;background:linear-gradient(110deg,#22d3ee,#2f6bff 55%,#8b3dff)}.ggc-send:disabled{opacity:.5}'
    + '.ggc-n{padding:0 14px 10px;color:#8f97b6;font-size:11.5px;text-align:center}'
    + '.ggc-ig{margin-left:auto;display:flex;align-items:center;gap:6px;height:34px;padding:0 12px;border-radius:999px;border:1px solid rgba(255,255,255,.2);color:#fff;font-size:12.5px;font-weight:700;text-decoration:none;white-space:nowrap}.ggc-ig:hover{border-color:#7fdcf0}.ggc-ig svg{width:15px;height:15px}.ggc-ig+.ggc-x{margin-left:0}'
    + '.ggc-t{display:inline-flex;gap:4px}.ggc-t i{width:6px;height:6px;border-radius:50%;background:#a9b0cc;animation:ggc 1s infinite}.ggc-t i:nth-child(2){animation-delay:.15s}.ggc-t i:nth-child(3){animation-delay:.3s}'
    + '@keyframes ggc{0%,80%,100%{opacity:.3}40%{opacity:1}}@media(prefers-reduced-motion:reduce){.ggc-t i{animation:none}}';
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  var ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/></svg>';
  var btn = document.createElement("button");
  btn.className = "ggc-b"; btn.type = "button"; btn.setAttribute("aria-label", "Ask the GigrAI assistant");
  btn.innerHTML = ICON + '<span>Ask GigrAI</span>';
  var p = document.createElement("div");
  p.className = "ggc-p"; p.setAttribute("role", "dialog"); p.setAttribute("aria-label", "GigrAI assistant");
  p.innerHTML = '<div class="ggc-h"><div class="ggc-dot">' + ICON + '</div><div><b>GigrAI assistant</b><small>AI helper · can make mistakes</small></div><a class="ggc-ig" href="https://ig.me/m/gigr.ai" target="_blank" rel="noopener" data-track="chat-instagram" aria-label="Talk to a person: DM us on Instagram"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="currentColor"/></svg>DM us</a><button class="ggc-x" type="button" aria-label="Close">×</button></div>'
    + '<div class="ggc-l" aria-live="polite"></div><div class="ggc-s"></div>'
    + '<form class="ggc-f"><textarea rows="1" maxlength="500" placeholder="Ask about roles, pay, platforms…" aria-label="Your question"></textarea><button class="ggc-send" type="submit" aria-label="Send"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></form>'
    + '<div class="ggc-n">Don\'t share personal details. Chats aren\'t saved. Real platforms never charge to apply.</div>';
  document.body.appendChild(btn); document.body.appendChild(p);
  var list = p.querySelector(".ggc-l"), sug = p.querySelector(".ggc-s"), form = p.querySelector("form"), ta = p.querySelector("textarea"), send = p.querySelector(".ggc-send");

  // Sit above any phone bottom bar (same bubble on every page)
  function place() {
    var y = 20, bars = document.querySelectorAll(".mnav,.mbar");
    for (var i = 0; i < bars.length; i++) {
      var r = bars[i].getBoundingClientRect();
      if (r.height && getComputedStyle(bars[i]).display !== "none") y = Math.max(y, window.innerHeight - r.top + 12);
    }
    document.documentElement.style.setProperty("--ggc-y", y + "px");
  }
  place(); addEventListener("resize", place); setTimeout(place, 600);

  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  // Plain text in, safe HTML out: our own /paths become links, "- " lines become a list
  function fmt(t) {
    var h = esc(String(t).replace(/\*\*(.+?)\*\*/g, "$1").replace(/^#+\s*/gm, ""));
    h = h.replace(/(^|[\s(])((?:https?:\/\/)?(?:www\.)?remotegigrai\.com)?(\/(?:jobs|guides|platforms|news|advertise|media-kit|privacy)(?:\/[a-z0-9-]+)*)(?=[\s).,!?:;]|$)/g, function (m, a, host, path) { return a + '<a href="' + path + '">' + (host || "") + path + "</a>"; });
    var lines = h.split("\n"), out = [], inList = false;
    lines.forEach(function (l) {
      var m = l.match(/^\s*(?:[-•*]|\d+\.)\s+(.*)/);
      if (m) { if (!inList) { out.push("<ul>"); inList = true; } out.push("<li>" + m[1] + "</li>"); }
      else { if (inList) { out.push("</ul>"); inList = false; } out.push(l + "\n"); }
    });
    if (inList) out.push("</ul>");
    return out.join("").replace(/\n+$/, "").replace(/\n{3,}/g, "\n\n");
  }
  function card(r) {
    var a = document.createElement("a");
    a.className = "ggc-c"; a.href = r.path + "?src=chat";
    a.innerHTML = "<b>" + esc(r.title) + "</b><span>" + (r.pay ? "<em>" + esc(r.pay) + "</em> · " : "") + "via " + esc(r.via)
      + (r.elig === "yes" ? " · <i></i>Open to you" : r.elig === "unknown" ? " · Check eligibility" : "") + "</span>";
    return a;
  }
  function bubble(role, text, idx) {
    var d = document.createElement("div"); d.className = "ggc-m " + (role === "user" ? "u" : "a");
    if (role === "user") d.textContent = text; else d.innerHTML = fmt(text);
    list.appendChild(d);
    var rs = roles[idx];
    if (rs && rs.length) { var w = document.createElement("div"); w.className = "ggc-r"; rs.forEach(function (r) { w.appendChild(card(r)); }); list.appendChild(w); }
  }
  var HELLO = "Hi! I can help you find remote AI training roles that fit your skills, and answer questions about platforms, pay and applying. What kind of work are you after?";
  var CHIPS = ["Coding roles that pay $50+/hr", "Roles open in my country", "Is micro1 legit?", "How do I get paid?", "Advertise a role"];
  function render() {
    list.innerHTML = ""; bubble("assistant", HELLO, -1);
    msgs.forEach(function (m, i) { bubble(m.role, m.content, i); });
    sug.innerHTML = "";
    if (!msgs.length) CHIPS.forEach(function (c) { var b = document.createElement("button"); b.type = "button"; b.textContent = c; b.onclick = function () { ask(c); }; sug.appendChild(b); });
    list.scrollTop = list.scrollHeight;
  }

  function ask(text) {
    text = String(text || "").trim().slice(0, 500);
    if (!text || busy) return;
    busy = true; send.disabled = true; ta.value = ""; ta.style.height = "";
    msgs.push({ role: "user", content: text }); render();
    var typing = document.createElement("div"); typing.className = "ggc-m a"; typing.innerHTML = '<span class="ggc-t" aria-label="Typing"><i></i><i></i><i></i></span>';
    list.appendChild(typing); list.scrollTop = list.scrollHeight;
    var body = JSON.stringify({ messages: msgs.slice(-8), country: country });
    fetch("/api/chat?src=" + encodeURIComponent((location.pathname.split("/")[1] || "home").slice(0, 20)), { method: "POST", headers: { "content-type": "application/json" }, body: body })
      .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
      .then(function (d) {
        var reply = d && d.ok ? d.reply : (d && d.error) || "Sorry, something went wrong. Please try again.";
        msgs.push({ role: "assistant", content: reply });
        if (d && d.roles && d.roles.length) roles[msgs.length - 1] = d.roles;
      })
      .catch(function () { msgs.push({ role: "assistant", content: "I couldn't connect. Check your internet and try again." }); })
      .then(function () {
        // keep stored role cards in step with the trimmed history
        if (msgs.length > 12) { var cut = msgs.length - 12, nr = {}; msgs = msgs.slice(cut); for (var k in roles) if (k - cut >= 0) nr[k - cut] = roles[k]; roles = nr; }
        busy = false; send.disabled = false; save(); render();
      });
  }

  function open() {
    p.classList.add("on"); btn.style.display = "none";
    if (!country) fetch("/api/where").then(function (r) { return r.json(); }).then(function (d) { country = (d && d.iso3) || ""; }).catch(function () {});
    render(); setTimeout(function () { if (matchMedia("(min-width:521px)").matches) ta.focus(); }, 50);
    try { sessionStorage.setItem(KEY + "-open", "1"); } catch (e) {}
  }
  function close() { p.classList.remove("on"); btn.style.display = ""; btn.focus(); try { sessionStorage.removeItem(KEY + "-open"); } catch (e) {} }
  btn.addEventListener("click", open);
  p.querySelector(".ggc-x").addEventListener("click", close);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && p.classList.contains("on")) close(); });
  form.addEventListener("submit", function (e) { e.preventDefault(); ask(ta.value); });
  ta.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(ta.value); } });
  ta.addEventListener("input", function () { ta.style.height = ""; ta.style.height = Math.min(110, ta.scrollHeight) + "px"; });
  window.ggChat = { open: open, ask: function (t) { open(); ask(t); } };
  try { if (sessionStorage.getItem(KEY + "-open") && matchMedia("(min-width:521px)").matches) open(); } catch (e) {}
})();
