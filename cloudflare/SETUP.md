# SIDEK ERP — One-click data refresh

The interactive dashboard is served from GitHub Pages or Cloudflare static hosting. The browser only receives aggregate counts: **never raw student or MSME records**.

## Architecture

- `index.html`: public charts and the **Update Data** button.
- `config.js`: public base URL of the update API (no passwords).
- `cloudflare/update-worker.js`: private Google Sheets reader and aggregator hosted by Cloudflare Worker.
- Cloudflare KV binding `DATA_CACHE`: stores the latest **aggregate JSON only**.
- Google service account: read-only access to the eight private Sheets.
- Cloudflare secret `ADMIN_UPDATE_TOKEN`: required for POST `/refresh`. The admin enters it when clicking the button; it is not stored in browser storage or in GitHub.

### Initial setup (once)

**1. Create Google service account**

In Google Cloud Console, choose a project and enable Google Sheets API. Create a service account; create a JSON key and retain its `client_email` and `private_key` privately. Google Workspace policies may disallow external service accounts; obtain authorization from the UGM administrator where necessary. **Never commit the JSON key.**

**2. Give sheet access**

Share **all eight** sheets with the service account's `client_email` as Viewer, or have their owner grant access. If any single sheet remains inaccessible, the update fails without overwriting the previous aggregate snapshot.

**3. Deploy Cloudflare Worker**

In Cloudflare Workers & Pages, create a new Worker, paste the entire contents of `cloudflare/update-worker.js` as the Worker code and deploy. The backend's routes are:

- `GET /health` — health check and KV configuration status
- `GET /data` — cached **aggregate** (public)
- `POST /refresh` — fetch eight sheets, aggregate server-side, write cache and return summary; **requires admin token**

Prefer keeping the update API on its own `*.workers.dev` URL rather than changing existing routes on `gunggu.my.id`.

**4. Create KV namespace**

Cloudflare: Workers & Pages → KV → Create namespace (e.g., `sidek-erp-aggregates`). Bind it to the update Worker under **Settings → Bindings** with variable name `DATA_CACHE`. The code requires this exact binding name.

**5. Configure three Cloudflare Secrets**

Under Worker → Settings → Variables and Secrets, create **encrypted secrets**:

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: JSON key's `client_email`
- `GOOGLE_PRIVATE_KEY`: JSON key's `private_key` as PEM text including BEGIN/END PRIVATE KEY and all newlines
- `ADMIN_UPDATE_TOKEN`: a long, unique, random admin token (at least 32 characters). Do not place it in a URL or file.

**6. Configure the public dashboard**

Edit only `config.js` and replace its empty value with the update Worker's public URL (without `/data`, `/refresh`, or trailing slash):

```js
window.SIDEK_API_BASE = 'https://your-update-worker.your-subdomain.workers.dev';
```

This URL is public and not a secret. **Never** put `ADMIN_UPDATE_TOKEN` in `config.js`.

**7. Verify**

- Open `https://<worker>/health`: response has `ok:true` and `kv_configured:true`.
- Open dashboard → click **Update Data** → enter admin token. The Worker fetches the latest eight Sheets, updates KV, returns counts, and the dashboard re-renders immediately.
- Reload dashboard: it reads `GET /data` so non-admin visitors see the latest published aggregate without having the token.
- If a sheet is not shared, authorization fails: previous snapshot is retained, and the dashboard shows an error.

## Important limitations

- The button needs backend setup before it can operate; GitHub Pages alone cannot securely access private Google Sheets.
- The refresh updates aggregate counts, charts, school-group and regional organization counts—not cross-wave verified matches, statistical test results, or manually written analytical conclusions.
- Business uniqueness uses simple normalization of business name **within a wave** and is not a reliable unique business identity across waves.
- Four recognized SMKs are reported by name; unrecognized institution strings are omitted from the institution chart while their survey rows remain counted in totals.
- This is an on-demand manual refresh; there is no hourly or automatic polling of the private spreadsheets.
- Public code and KV do not contain raw participant responses, emails, NIS or business identities.
- CORS currently allows the origins `https://gunggu.github.io`, `https://gunggu.my.id` and `https://sidekerp.gunggu.my.id`. If you serve the public dashboard from another hostname, add its exact origin to `cloudflare/update-worker.js`.

## Updating the backend

Commit and deploy updates to `cloudflare/update-worker.js` to your Cloudflare Worker; GitHub Pages changes **do not automatically deploy Cloudflare Worker code**. Refresh may be retried, and the cache retains its previous value if any of the eight fetches fail.

The snapshot packaged with the dashboard was originally read 6 November 2026; it remains visible until a successful refresh.
