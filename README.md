# Skill Browser

Internal Claude skill browser built on Azure Static Web Apps + Cosmos DB + Entra ID SSO.

---

## Table of contents

1. [Prerequisites](#1-prerequisites)
2. [Clone and install](#2-clone-and-install)
3. [Cosmos DB setup](#3-cosmos-db-setup)
4. [Entra ID app registration](#4-entra-id-app-registration)
5. [Configure the app](#5-configure-the-app)
6. [Local development](#6-local-development)
7. [Deploy to Azure](#7-deploy-to-azure)
8. [Post-deploy checklist](#8-post-deploy-checklist)
9. [Project structure](#9-project-structure)
10. [Cosmos document schema](#10-cosmos-document-schema)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Prerequisites

Install these before starting:

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18+ | https://nodejs.org |
| Azure Functions Core Tools | v4 | `npm install -g azure-functions-core-tools@4` |
| SWA CLI | any | `npm install -g @azure/static-web-apps-cli` |

---

## 2. Clone and install

```bash
# From inside the skill-browser folder:

# Install frontend dependencies
npm install

# Install API dependencies
cd api
npm install
cd ..
```

---

## 3. Cosmos DB setup

### Create the account

1. Go to the [Azure Portal](https://portal.azure.com) and search for **Azure Cosmos DB** in the top bar
2. Click **Create**, then choose **Azure Cosmos DB for NoSQL**
3. Fill in the basics:
   - **Subscription** — your subscription
   - **Resource group** — use an existing one or create new
   - **Account name** — something like `skills-browser-db` (globally unique, lowercase)
   - **Location** — pick the region closest to your users
   - **Capacity mode** — choose **Serverless** for a low-traffic internal tool (no ongoing cost when idle), or **Provisioned throughput** if you prefer predictable billing
4. Leave everything else as default and click **Review + create → Create**
5. Wait for the deployment to finish (~2 minutes), then click **Go to resource**

### Create the database

1. In your new Cosmos DB account, click **Data Explorer** in the left sidebar
2. Click **New Container** (the button at the top of the Data Explorer panel)
3. Select **Create new** under Database id and enter: `skills-db`
4. Under **Container id** enter: `skills`
5. Under **Partition key** enter: `/id`
6. If you chose Provisioned throughput, set it to **400 RU/s** (the minimum) — tick **Share throughput across containers** to keep costs low
7. Click **OK**

### Get your endpoint and key

You'll need these for the environment variables in step 5.

1. In your Cosmos DB account, click **Keys** in the left sidebar (under Settings)
2. Copy the **URI** — this is your `COSMOS_ENDPOINT`
3. Copy the **PRIMARY KEY** — this is your `COSMOS_KEY`

> Keep these values handy — you'll paste them into the SWA application settings in step 7.

---

## 4. Entra ID app registration

Azure Static Web Apps can create this automatically during deployment, but if you prefer to set it up manually:

1. Go to **Azure Portal → Microsoft Entra ID → App registrations → New registration**
2. Name: `skill-browser` (or any name)
3. Supported account types: **Accounts in this organizational directory only** (single tenant)
4. Redirect URI: leave blank for now — you'll add it after deploying
5. Click **Register**
6. Copy the **Application (client) ID** — this is `AZURE_CLIENT_ID`
7. Go to **Certificates & secrets → New client secret**, set an expiry, copy the value — this is `AZURE_CLIENT_SECRET`
8. Copy the **Directory (tenant) ID** from the Overview page — this is your `__TENANT_ID__`

After deploying (step 7), come back here and add the redirect URI:

- **Authentication → Add a platform → Web**
- Redirect URI: `https://<your-swa-hostname>/.auth/login/aad/callback`

---

## 5. Configure the app

### Update staticwebapp.config.json

Open `staticwebapp.config.json` and replace `__TENANT_ID__` with your Entra tenant ID:

```json
"openIdIssuer": "https://login.microsoftonline.com/YOUR-TENANT-ID-HERE/v2.0"
```

### Local environment file (for running the API locally)

Create `api/local.settings.json` — this is gitignored by Azure tooling and never deployed:

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "COSMOS_ENDPOINT": "https://<your-account>.documents.azure.com:443/",
    "COSMOS_KEY": "<your-primary-key>",
    "COSMOS_DATABASE": "skills-db",
    "COSMOS_CONTAINER": "skills"
  }
}
```

> **Never commit this file.** Add `api/local.settings.json` to `.gitignore`.

---

## 6. Local development

You need two terminals running simultaneously.

**Terminal 1 — API (Azure Functions):**

```bash
cd api
func start
```

You should see output like:
```
GetSkills: [GET] http://localhost:7071/api/skills
PostSkill: [POST] http://localhost:7071/api/skills
IncrementUseCount: [POST] http://localhost:7071/api/skills/{id}/use
```

**Terminal 2 — Frontend (Vite):**

```bash
npm run dev
```

Open http://localhost:5173. The Vite dev server automatically proxies `/api/*` requests to `http://localhost:7071`.

**Note on auth locally:** The `x-ms-client-principal` header is only injected by SWA in production. Locally, submitted skills will show `submitted_by: "unknown"`. All routes are also unrestricted locally — no login prompt.

---

## 7. Deploy to Azure

### Option A — SWA CLI (quickest)

```bash
# Build the frontend
npm run build

# Deploy (prompts you to select/create an SWA resource)
swa deploy ./dist \
  --api-location ./api \
  --env production
```

After deploying, the CLI prints your app URL. Set the environment variables under **SWA → Configuration → Application settings** in the Azure Portal:

| Name | Value |
|------|-------|
| `COSMOS_ENDPOINT` | `https://<account>.documents.azure.com:443/` |
| `COSMOS_KEY` | your primary key |
| `COSMOS_DATABASE` | `skills-db` |
| `COSMOS_CONTAINER` | `skills` |
| `AZURE_CLIENT_ID` | from step 4 |
| `AZURE_CLIENT_SECRET` | from step 4 |

Then go back to step 4 and add the redirect URI to your app registration.

### Option B — GitHub Actions (recommended for ongoing deploys)

1. Push this folder to a GitHub repo
2. In the Azure Portal, create a new **Static Web App** resource
3. During creation, connect it to your GitHub repo — Azure will commit a `.github/workflows/` file automatically
4. Add the environment variables in **SWA → Configuration → Application settings** (same table as above)
5. Every push to `main` will trigger a deploy

---

## 8. Post-deploy checklist

- [ ] App loads and redirects to Microsoft login
- [ ] After login, skill grid loads (if empty, that's fine — Cosmos container is empty)
- [ ] "Add skill" form submits successfully (check Cosmos Data Explorer to confirm the document was created)
- [ ] `submitted_by` field on the new document shows your email address, not `"unknown"`
- [ ] Copy button writes prompt text to clipboard
- [ ] Download button saves a `.txt` file and shows usage instructions inline

---

## 9. Project structure

```
skill-browser/
├── index.html
├── package.json
├── vite.config.js
├── staticwebapp.config.json    # SWA auth + routing (edit __TENANT_ID__ here)
├── src/
│   ├── main.jsx                # React entry point
│   ├── index.css               # Global reset
│   ├── App.jsx                 # Root component — state, fetching, filtering
│   ├── App.module.css
│   └── components/
│       ├── SkillCard.jsx       # Grid card with Copy + Preview
│       ├── SkillCard.module.css
│       ├── SkillModal.jsx      # Detail overlay — Download + Use in chat
│       ├── SkillModal.module.css
│       ├── SubmitSkillForm.jsx # Add skill modal
│       └── SubmitSkillForm.module.css
└── api/
    ├── package.json
    ├── local.settings.json     # ← create this (gitignored), never commit
    ├── shared/
    │   └── cosmos.js           # Shared Cosmos DB client (singleton)
    ├── GetSkills/              # GET  /api/skills
    │   ├── function.json
    │   └── index.js
    ├── PostSkill/              # POST /api/skills
    │   ├── function.json
    │   └── index.js
    └── IncrementUseCount/      # POST /api/skills/{id}/use
        ├── function.json
        └── index.js
```

---

## 10. Cosmos document schema

```json
{
  "id": "uuid-v4",
  "title": "Meeting action extractor",
  "category": "Meetings",
  "description": "Reads a Teams transcript and pulls out all action items, owners, and due dates.",
  "prompt": "Read the following meeting transcript...",
  "tags": ["Teams", "M365"],
  "submitted_by": "sarah.k@nzrugby.co.nz",
  "submitted_at": "2026-06-05T09:14:00.000Z",
  "use_count": 57
}
```

`category` must be one of: `Drafting`, `Analysis`, `Summarising`, `Meetings`, `Email`, `Data`.

---

## 11. Troubleshooting

**`func start` fails with "No functions found"**
Make sure you ran `npm install` inside the `api/` folder. The `@azure/cosmos` package must be present.

**API returns 500 with "COSMOS_ENDPOINT and COSMOS_KEY must be set"**
Your `api/local.settings.json` is missing or the keys are wrong. Double-check the values from step 3.

**Login loop after deploying**
The redirect URI on your Entra app registration doesn't match. Go to **App registrations → Authentication** and confirm the URI is exactly `https://<your-swa-hostname>/.auth/login/aad/callback`.

**`submitted_by` is "unknown" in production**
The `x-ms-client-principal` header is missing. This usually means the route isn't requiring authentication — confirm `staticwebapp.config.json` is deployed and `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` are set in application settings.

**Skill grid is empty but documents exist in Cosmos**
Check the Cosmos container name and database name match what's in application settings. The defaults are `skills-db` and `skills`.

