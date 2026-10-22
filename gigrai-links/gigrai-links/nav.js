// The site menu (hamburger + slide-in drawer). One source for every page:
// the homepage gets it injected by worker.js; /jobs, /guides and /advertise include it via seo.js.
// To add a link: add a row to MENU below.

const WA = "https://whatsapp.com/channel/0029VbDkhLPKgsO0zsOZ080u";
const IG = "https://www.instagram.com/gigr.ai/";

// Lucide-style 24px line icons, 1.8 stroke
const I = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
  book: '<path d="M4 19.5V5a2 2 0 0 1 2-2h13v16H6.5A2.5 2.5 0 0 0 4 21.5v-2z"/><path d="M8 7h7M8 11h5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  calc: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h8"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
  ig: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6"/>',
  mega: '<path d="m3 11 15-6v14L3 13v-2z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  ext: '<path d="M7 17 17 7M9 7h8v8"/>',
};
const svg = (d, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

const MENU = [
  { label: "Find work", items: [
    { href: "/", text: "Search jobs", icon: "search" },
    { href: "/jobs", text: "All live roles", icon: "list" },
    { href: "/#platforms", text: "Platforms", icon: "grid" },
  ] },
  { label: "Learn", items: [
    { href: "/guides", text: "Guides", icon: "book" },
    { href: "/#earnings", text: "Earnings calculator", icon: "calc" },
    { href: "/#faq", text: "FAQ", icon: "help" },
  ] },
  { label: "More", items: [
    { href: IG, text: "@gigr.ai on Instagram", icon: "ig", ext: true },
    { href: "/advertise", text: "Advertise with us", icon: "mega" },
  ] },
];

export function menuButton() {
  return `<button class="gm-btn" type="button" aria-label="Open menu" aria-haspopup="dialog" aria-controls="gm" aria-expanded="false" data-gm-open>${svg('<path d="M4 7h16M4 12h16M4 17h10"/>', 22)}</button>`;
}

export function drawerHtml() {
  const row = (it) => `<a class="gm-a" href="${it.href}"${it.ext ? ' target="_blank" rel="noopener"' : ""}${it.href.startsWith("/") && !it.href.includes("#") ? ` data-path="${it.href}"` : ""}><span class="gm-i">${svg(I[it.icon])}</span><span class="gm-t">${it.text}</span>${it.ext ? `<span class="gm-x">${svg(I.ext, 16)}<span class="gm-sr">(opens in a new tab)</span></span>` : ""}</a>`;
  return `<dialog class="gm" id="gm" aria-label="Menu">
<div class="gm-in">
  <div class="gm-head"><a class="gm-brand" href="/"><img src="/icon.png" alt="" width="32" height="32">GigrAI</a>
  <button class="gm-close" type="button" aria-label="Close menu" data-gm-close>${svg('<path d="M6 6l12 12M18 6 6 18"/>', 22)}</button></div>
  <nav aria-label="Site">${MENU.map((g) => `<p class="gm-l">${g.label}</p>${g.items.map(row).join("")}`).join("")}</nav>
  <div class="gm-foot">
    <a class="gm-cta" href="${WA}" target="_blank" rel="noopener" data-track="menu-whatsapp">${svg('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>')}Get job alerts on WhatsApp</a>
    <a class="gm-small" href="/privacy">Privacy &amp; cookies</a>
  </div>
</div>
</dialog>
<style>
.gm-btn{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;flex:0 0 auto;cursor:pointer;color:#f2f4ff;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);touch-action:manipulation;transition:background .15s,transform .15s}
.gm-btn:hover{background:rgba(255,255,255,.1)}.gm-btn:active{transform:scale(.95)}
.gm-btn:focus-visible,.gm a:focus-visible,.gm button:focus-visible{outline:3px solid #22D3EE;outline-offset:2px}
header.top .wrap .gm-btn{margin-left:-24px}
.gm{position:fixed;inset:0 0 0 auto;margin:0;height:100dvh;max-height:100dvh;width:min(88vw,360px);max-width:none;padding:0;border:0;border-left:1px solid rgba(255,255,255,.12);background:#0b0e20;color:#e2e6f8;font-family:"Plus Jakarta Sans",system-ui,sans-serif;overflow:hidden}
.gm[open]{animation:gm-in .26s cubic-bezier(.2,.8,.2,1)}
.gm.gm-out{animation:gm-out .17s ease-in forwards}
.gm::backdrop{background:rgba(3,4,12,.6);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
@keyframes gm-in{from{transform:translateX(100%)}to{transform:none}}
@keyframes gm-out{to{transform:translateX(100%)}}
.gm-in{height:100%;display:flex;flex-direction:column;overflow-y:auto;overscroll-behavior:contain;padding:12px 16px calc(20px + env(safe-area-inset-bottom));background:radial-gradient(120% 40% at 100% 0,rgba(139,61,255,.18),transparent),radial-gradient(90% 30% at 0 0,rgba(47,107,255,.14),transparent)}
.gm-head{display:flex;align-items:center;justify-content:space-between;min-height:56px;margin-bottom:4px}
.gm-brand{display:inline-flex;align-items:center;gap:10px;color:#f2f4ff;font-weight:800;font-size:18px;text-decoration:none}.gm-brand img{border-radius:9px}
.gm-close{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;cursor:pointer;color:#f2f4ff;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)}
.gm-l{margin:18px 8px 6px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#9aa3c7}
.gm-a{position:relative;display:flex;align-items:center;gap:14px;min-height:52px;padding:0 12px;border-radius:14px;color:#e2e6f8;font-weight:600;font-size:16px;text-decoration:none;transition:background .15s}
.gm-a:hover{background:rgba(255,255,255,.06)}.gm-a:active{background:rgba(255,255,255,.1)}
.gm-i{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;background:rgba(255,255,255,.06);color:#b8bfdc;flex:0 0 auto}
.gm-t{flex:1}.gm-x{color:#9aa3c7;display:flex}
.gm-a[aria-current="page"]{background:rgba(47,107,255,.14);color:#fff}
.gm-a[aria-current="page"]::before{content:"";position:absolute;left:0;top:12px;bottom:12px;width:3px;border-radius:3px;background:linear-gradient(#22D3EE,#2F6BFF,#8B3DFF)}
.gm-a[aria-current="page"] .gm-i{background:linear-gradient(135deg,#22D3EE,#2F6BFF 55%,#8B3DFF);color:#fff}
.gm-foot{margin-top:auto;padding-top:22px;display:flex;flex-direction:column;gap:14px}
.gm-cta{display:flex;align-items:center;justify-content:center;gap:10px;min-height:52px;border-radius:999px;background:#25d366;color:#04210f;font-weight:700;text-decoration:none}
.gm-small{align-self:center;font-size:13px;color:#9aa3c7}
.gm-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
@media (prefers-reduced-motion:reduce){.gm[open],.gm.gm-out{animation:none}}
</style>
<script>
(function(){
  var d=document.getElementById("gm"); if(!d||!d.showModal) return;
  var btns=document.querySelectorAll("[data-gm-open]"), last=null;
  var p=location.pathname.replace(/\\/$/,"")||"/";
  d.querySelectorAll("[data-path]").forEach(function(a){var t=a.getAttribute("data-path"); if(t===p||(t!=="/"&&p.indexOf(t+"/")===0)) a.setAttribute("aria-current","page");});
  function setExp(v){btns.forEach(function(b){b.setAttribute("aria-expanded",v);});}
  function open(e){last=e.currentTarget; d.classList.remove("gm-out"); d.showModal(); setExp("true"); document.documentElement.style.overflow="hidden"; var c=d.querySelector("[aria-current=page]")||d.querySelector(".gm-a"); c&&c.focus();}
  function done(){d.classList.remove("gm-out"); if(d.open) d.close();}
  function close(){ if(!d.open) return; if(matchMedia("(prefers-reduced-motion: reduce)").matches) return done(); d.classList.add("gm-out"); setTimeout(done,170);}
  btns.forEach(function(b){b.addEventListener("click",open);});
  d.addEventListener("close",function(){setExp("false"); document.documentElement.style.overflow=""; last&&last.focus&&last.focus();});
  d.addEventListener("cancel",function(e){e.preventDefault(); close();});
  d.addEventListener("click",function(e){
    if(e.target===d) return close();                         // tap on the dimmed area
    if(e.target.closest("[data-gm-close]")) return close();
    var a=e.target.closest("a"); if(!a) return;
    if(a.hash && a.pathname===location.pathname){ done(); }    // same-page section: close, let it scroll
  });
})();
</script>`;
}
