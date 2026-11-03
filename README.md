# Mirror Zones website

Static site plus a small Cloudflare Worker that saves "Stay informed" signups.

## How it works

- The HTML files are served as static assets on Cloudflare Workers.
- The form posts to `/api/signup`, which `src/worker.js` handles. Signups are saved to a Cloudflare D1 database (`mirror-zones-signups`).
- On success, visitors see `thanks.html`. On failure, they return to the form, which shows an error message.

## Deploying (one-time setup)

1. Sign in to the Cloudflare dashboard, then go to **Workers & Pages → Create → Import a repository**.
2. Pick this GitHub repo and keep the default deploy command (`npx wrangler deploy`). Then click **Deploy**.
3. Cloudflare creates the database automatically. After that, every push to `main` redeploys the site.

## Viewing signups

In the dashboard, go to **Storage & Databases → D1 → mirror-zones-signups → Console** and run:

```sql
SELECT * FROM signups ORDER BY created_at DESC;
```

To export as CSV: `npx wrangler d1 export mirror-zones-signups --remote --table signups --output signups.sql`, or copy the results from the console.
