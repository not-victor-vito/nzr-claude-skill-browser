# Deployment Checklist — GitHub Pages + Azure Functions

Complete these steps once before pushing. After that, every push to `main` deploys automatically.

---

## 1 — Create the Azure Functions App

1. Azure Portal → **Create a resource** → search **Function App**
2. Fill in:
   - **Runtime stack**: Node.js 20
   - **Operating System**: Linux
   - **Hosting plan**: Consumption (Serverless) — free
   - **Region**: Australia East (or wherever your Cosmos DB is)
3. Note the **Function App name** — you'll need it below (e.g. `nzrugby-skills-api`)

---

## 2 — Set Environment Variables on the Functions App

Functions App → **Settings** → **Environment variables** → add each:

| Name | Value |
|---|---|
| `COSMOS_ENDPOINT` | `https://claude-skills-browser-db.documents.azure.com:443/` |
| `COSMOS_KEY` | *(your Cosmos primary key)* |
| `COSMOS_DATABASE` | `skills-db` |
| `COSMOS_CONTAINER` | `skills` |

---

## 3 — Enable Easy Auth on the Functions App

Functions App → **Settings** → **Authentication** → **Add identity provider**

- Provider: **Microsoft**
- App registration type: **Provide the details of an existing app registration**
- Client ID: `6d100c50-4a82-4fe6-a2db-612eb30f6c03`
- Client secret: *(same secret you used on SWA)*
- Issuer URL: `https://login.microsoftonline.com/0bbd34cb-91a8-4b8e-a483-034a155ff47b/v2.0`
- Allowed token audiences: `api://6d100c50-4a82-4fe6-a2db-612eb30f6c03`
- Unauthenticated requests: **HTTP 401 Unauthorized**

Click **Add**.

---

## 4 — Configure CORS on the Functions App

Functions App → **API** → **CORS**

Add these allowed origins (one per line):
```
https://skills.ai.nz.rugby
http://localhost:5173
```

Once GitHub Pages is live, also add `https://<your-org>.github.io` if you test before the custom domain is active.

Enable **Enable Access-Control-Allow-Credentials**.

---

## 5 — Expose an API Scope in Entra ID

This lets MSAL request a token that Easy Auth will accept.

1. Azure Portal → **Entra ID** → **App registrations** → your app (`6d100c50...`)
2. **Expose an API** → **Add a scope**
   - If prompted to set Application ID URI, accept the default: `api://6d100c50-4a82-4fe6-a2db-612eb30f6c03`
   - Scope name: `user_impersonation`
   - Who can consent: **Admins and users**
   - Display name: `Access Skill Browser API`
3. Click **Add scope**

---

## 6 — Update Entra Redirect URIs for MSAL

1. Same app registration → **Authentication**
2. Under **Single-page application** → **Add URI**:
   - `https://skills.ai.nz.rugby`
   - `http://localhost:5173`
3. Click **Save**

*(The existing web redirect URIs from the old SWA can be removed.)*

---

## 7 — Enable GitHub Pages

1. GitHub → your repo → **Settings** → **Pages**
2. Source: **GitHub Actions**
3. Click **Save**

---

## 8 — Add GitHub Secrets

Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Secret name | Value |
|---|---|
| `AZURE_FUNCTIONAPP_NAME` | Your function app name (e.g. `nzrugby-skills-api`) |
| `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` | Download from: Functions App → **Overview** → **Get publish profile** → paste the full XML content |
| `VITE_API_BASE_URL` | `https://<your-function-app>.azurewebsites.net/api` |

---

## 9 — Delete Old SWA Secrets (optional cleanup)

You can delete `AZURE_STATIC_WEB_APPS_API_TOKEN` and `AZURE_STATIC_WEB_APPS_API_TOKEN_YELLOW_FLOWER_088B51900` from GitHub secrets — they're no longer used.

---

## 10 — Push and Deploy

```bash
git add -A
git commit -m "feat: migrate from SWA to GitHub Pages + Azure Functions"
git push
```

Watch the Actions tab — two jobs will run in parallel: `deploy-frontend` and `deploy-api`.

---

## 11 — Configure Custom Domain

After the first successful deploy:

1. GitHub Pages → **Custom domain** → enter `skills.ai.nz.rugby` → **Save**
2. In your DNS (wherever `nz.rugby` is managed), add:
   - Type: `CNAME`
   - Name: `skills.ai`
   - Value: `<your-github-org>.github.io`
3. GitHub will automatically provision the Let's Encrypt certificate (~5 min)

---

## Done ✓

Your app will be live at `https://skills.ai.nz.rugby` with Entra ID login, and every push to `main` redeploys both the frontend and the API automatically.
