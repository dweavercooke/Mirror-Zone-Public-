# Mirror Zones website

A project of the Center for American Interests and Policy.

## Files

- `index.html`: the website
- `thanks.html`: the page shown after someone signs up
- `caip-logo.webp`: the CAIP logo, used in the header and as the browser-tab icon
- `src/worker.js`: saves "Stay informed" signups to the Cloudflare D1 database
- `wrangler.jsonc`, `.assetsignore`: Cloudflare settings

Cloudflare redeploys automatically every time a change is committed to `main`.

## Viewing signups

- **Live feed:** Cloudflare → Workers & Pages → this site → Logs. Each signup shows as `NEW SIGNUP: …`.
- **Full list:** Cloudflare → Storage & databases → D1 → the site's database → Explore data → `signups`.
- **Private page (optional):** add a secret named `ADMIN_PASSWORD` under the site's Settings → Variables and Secrets. Then open `/admin` on the site for a table and a CSV download.
