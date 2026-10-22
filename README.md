# GigrAI: remotegigrai.com

A search engine for remote AI jobs. Live roles are pulled from AI work platforms and every apply link carries a GigrAI referral code.

Hosted on **Cloudflare Workers** (project `gigrai-links`). Every push to `main` is published by GitHub Actions
(`.github/workflows/deploy.yml`) in about a minute. It needs the repo secret `CLOUDFLARE_API_TOKEN`
(a Cloudflare "Edit Cloudflare Workers" token).

## Where things live

| File | What it does |
|---|---|
| `gigrai-links/gigrai-links/public/platforms.json` | **The one list of platforms.** Platform rows on the page and job feeds both come from here. |
| `gigrai-links/gigrai-links/public/index.html` | The homepage: search, filters, role details (`?role=<id>`), saved, calculator, platforms, FAQ. |
| `gigrai-links/gigrai-links/public/picks/index.html` | `/picks`: builds ready-to-paste WhatsApp posts (not linked anywhere). |
| `gigrai-links/gigrai-links/seo.js` | Pages for Google: `/jobs` (every live role) and `/jobs/<id>/<slug>` (one role, with JobPosting data for Google's jobs panel). Closed roles return 404. |
| `gigrai-links/gigrai-links/worker.js` | Server code: `/api/jobs` (live search), `/api/job` (one role + description), `/go/<id>` (tracked apply redirect), `/api/click` (tap counter), `/api/subscribe` (email signup, switched off). |
| `gigrai-links/gigrai-links/wrangler.jsonc` | Cloudflare settings. |

## Add a new platform

1. Sign up to the platform and get your referral link (and referral code if it has per-job links).
2. In `platforms.json`, fill in that platform's block (or copy one):

| Field | Meaning |
|---|---|
| `id` | Short lowercase name, e.g. `mercor` |
| `name` | Shown as "via Name" on jobs |
| `rowTitle` / `tagline` | Text on the "Join a platform" row |
| `signupUrl` | **Your referral link.** Rows without one stay hidden |
| `logo` | Image file in `public/` (optional; otherwise shows initials) |
| `logoShape` | `wide` (like micro1) or `square` (like Ethos) |
| `feed` | `null` if the platform has no public job list, otherwise see below |
| `active` | `true` to show it |

3. Commit and push. Live in about a minute.

### Feed types

- `{ "type": "micro1", "referralCode": "..." }`: micro1's public referral job feed. Apply links carry the code.
- `{ "type": "mercor", "referralCode": "..." }`: Mercor's public explore feed. Links go to each job with the code; country limits shown as tags.
- `{ "type": "greenhouse", "board": "alignerr", "applyVia": "signup" }`: any public Greenhouse job board.
  `applyVia: "signup"` sends applicants through your referral `signupUrl` (so you get credit);
  `"listing"` sends them to the job's own Greenhouse page (no referral credit).
- A new kind of feed needs a small adapter added to `ADAPTERS` in `worker.js`.

If one platform's feed fails, the others keep working, and the error shows in Cloudflare → gigrai-links → Observability as `feed failed`.

## Useful links

- Search pre-filled for posts and Stories: `remotegigrai.com/?q=photographer`
- Taps: Cloudflare → Observability, search `link_click`
- What people search for: Cloudflare → Observability, search `job_search`

## Google Search

- Search Console: add `remotegigrai.com` as a Domain property (TXT record in Cloudflare DNS), then submit `sitemap.xml`.
- The sitemap lists the homepage, `/jobs`, popular searches and every live role page. It updates itself as roles open and close.
- Guides live in `gigrai-links/gigrai-links/guides.js` and appear at `/guides/<slug>`. To add one, copy a block and push; it joins the sitemap automatically.
- Roles with a full description (Mercor) carry JobPosting data, so they can appear in Google's jobs panel. micro1 roles have no description in their feed, so they get a page but no JobPosting data.

## Advertising

- `/advertise` is the sales page (prices and the Instagram DM button are in `seo.js`, `advertisePage`).
- To run a paid **Featured role**, add a block to `gigrai-links/gigrai-links/sponsored.json` with an `until` date and push. It shows at the top of the homepage and `/jobs`, labelled Sponsored, then disappears by itself after that date.
- Clicks for the advertiser's report: Cloudflare → Observability, search `apply_click` and `sponsored-<id>`.
