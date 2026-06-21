# GA4 Analytics Dashboard — Setup Guide

This dashboard reads **Google Analytics 4** data for i-robox.com via the [Google Analytics Data API](https://developers.google.com/analytics/devguides/reporting/data/v1). All API calls run **server-side** only; credentials never reach the browser.

**Dashboard URL:** `/analytics`

---

## 1. Create a Google Cloud project

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Click **Select a project** → **New Project**.
3. Name it (e.g. `irobox-ga4`) and create it.

---

## 2. Enable the Google Analytics Data API

1. In Cloud Console, open **APIs & Services** → **Library**.
2. Search for **Google Analytics Data API**.
3. Click it and press **Enable**.

---

## 3. Create a service account

1. Go to **APIs & Services** → **Credentials**.
2. Click **Create credentials** → **Service account**.
3. Name it (e.g. `ga4-reporting`) and finish creation.
4. Open the service account → **Keys** → **Add key** → **Create new key** → **JSON**.
5. Download the JSON file and store it securely (do not commit to git).

---

## 4. Grant access on the GA4 property

1. Open [Google Analytics](https://analytics.google.com/).
2. **Admin** (gear) → under **Property**, click **Property access management**.
3. Click **+** → **Add users**.
4. Enter the service account email from the JSON (`client_email`, looks like `ga4-reporting@project-id.iam.gserviceaccount.com`).
5. Role: **Viewer** (read-only is enough).
6. Save.

---

## 5. Find your GA4 Property ID

1. In GA4 **Admin** → **Property settings**.
2. Copy the numeric **Property ID** (e.g. `123456789`) — not the Measurement ID (`G-XXXX`).

---

## 6. Configure `.env.local`

In the project root, create or edit `.env.local`:

```env
GA4_PROPERTY_ID=123456789
GA4_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GA4_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
```

### Extracting values from the JSON key file

| Env variable | JSON field |
|--------------|------------|
| `GA4_CLIENT_EMAIL` | `client_email` |
| `GA4_PRIVATE_KEY` | `private_key` |

**Private key tips**

- Keep the key on **one line** in `.env.local` with literal `\n` for line breaks (as shown above), **or**
- Paste the full multi-line key inside double quotes in `.env.local`.
- On **Vercel**, paste the entire `private_key` value from JSON into `GA4_PRIVATE_KEY` (Vercel handles newlines).

---

## 7. Run locally

```bash
npm install
npm run dev
```

Open: [http://localhost:3000/analytics](http://localhost:3000/analytics)

---

## 8. Deploy (Vercel)

Add the same three variables in **Project → Settings → Environment Variables**:

- `GA4_PROPERTY_ID`
- `GA4_CLIENT_EMAIL`
- `GA4_PRIVATE_KEY`

Redeploy after saving.

---

## 9. Verify it works

1. Open `/analytics` and choose **Last 30 days**.
2. Executive summary KPIs should populate (may take a few seconds on first load).
3. If you see errors:
   - **403 / permission denied** → service account not added as Viewer on the GA4 property.
   - **Credentials missing** → env vars not set or not loaded (restart dev server).
   - **Invalid property** → check `GA4_PROPERTY_ID` is numeric property ID, not `G-` measurement ID.
4. In Google Cloud → **APIs & Services → Dashboard**, confirm Data API requests appear after loading the dashboard.

---

## API endpoints (internal)

| Route | Purpose |
|-------|---------|
| `GET /api/analytics/summary` | Executive summary |
| `GET /api/analytics/traffic` | Channel breakdown |
| `GET /api/analytics/ecommerce` | Orders, revenue, products |
| `GET /api/analytics/pages` | Landing pages |
| `GET /api/analytics/geo` | Geography |
| `GET /api/analytics/devices` | Device categories |
| `GET /api/analytics/behaviour` | Page paths |

Query params: `startDate` and `endDate` (`YYYY-MM-DD`).

Responses are cached in memory for **5 minutes** per query and date range.

---

## Security notes

- Never commit `.env.local` or the service account JSON to git.
- The service account should have **Viewer** only on GA4.
- Consider protecting `/analytics` with auth (e.g. admin login) before exposing on production — the dashboard is currently a standalone route with no built-in access control.
