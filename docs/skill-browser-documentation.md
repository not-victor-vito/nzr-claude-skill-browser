# NZR Skill Browser — Documentation

**URL:** https://skills.ai.nz.rugby  
**Access:** New Zealand Rugby staff with an NZR Microsoft account  
**Last updated:** June 2026

---

## What is the Skill Browser?

The Skill Browser is an internal tool for New Zealand Rugby staff to discover, share, and download Claude AI skills. A "skill" is a pre-built prompt or instruction set that configures Claude to perform a specific task — such as generating a contract approval document, creating an on-brand PowerPoint presentation, or summarising meeting notes.

Staff can browse skills submitted by colleagues, copy a skill's prompt directly into Claude, or download a `.skill` file to install in the Claude desktop app (Cowork mode).

---

## For Staff — Using the Skill Browser

### Accessing the tool

Go to **https://skills.ai.nz.rugby** in your browser. You will be redirected to the Microsoft login page. Sign in with your NZR Microsoft account. You will only need to do this once per browser session.

If the page shows a spinner for more than a few seconds on first load, this is normal — the backend service powers down when not in use and takes a moment to start up again.

### Browsing skills

Skills are displayed as cards showing the skill name, a short description, tags, and a use count. Use the search bar at the top right to filter by name, description, or tag.

Click **More info** on any card to open a detailed view, including the full prompt text and who submitted it.

### Copying a skill prompt

In the skill card or in the detail view, click **Copy**. The full prompt is copied to your clipboard. You can then paste it directly into Claude in a new conversation.

The use count on the card increments each time you copy, helping the team see which skills are most useful.

### Downloading a skill file

In the detail view, click **↓ Download as .skill**. This downloads a `.skill` file containing the prompt and any associated assets (fonts, images, templates).

To install a `.skill` file in the Claude desktop app:

1. Open Claude desktop
2. Go to **Settings → Capabilities → Skills**
3. Drag the `.skill` file into the skills panel, or click the install button and select the file

---

## For Staff — Adding a Skill

Click **+ Add skill** in the top right corner.

### Option 1 — Import from a .skill file

If you have a `.skill` file (or a `.zip` containing a `.skill` file alongside supporting assets such as fonts or images), click **↑ Import from .skill file** and select your file. The title, description, and prompt will be pre-filled from the file. Review the details, then click **Add skill**.

If the skill file contains binary assets (fonts, images, templates), these will be uploaded to secure cloud storage automatically when you submit. A progress indicator will appear during upload.

### Option 2 — Fill in manually

Complete the form fields:

| Field | Required | Notes |
|---|---|---|
| Title | Yes | Max 100 characters |
| Icon | No | Select an emoji to represent the skill |
| Description | No | Brief summary, max 500 characters |
| Prompt | Yes | The full Claude prompt, max 20,000 characters |
| Tags | No | Comma-separated, e.g. `Finance, Word, M365` |

Click **Add skill** to submit. The skill will appear in the browser immediately.

### Editing or deleting your skills

Skills you have submitted show **✎ Edit** and **Delete** buttons at the bottom of the detail view. Only the person who submitted a skill can edit or delete it.

Clicking **Edit** opens the form pre-populated with your skill's current content. Make your changes and click **Save changes**.

Clicking **Delete** shows a confirmation prompt before permanently removing the skill.

---

## Architecture Overview

The Skill Browser is built on free-tier cloud infrastructure and has no ongoing hosting costs beyond Azure consumption.

| Component | Technology | Purpose |
|---|---|---|
| Frontend | React + Vite, hosted on GitHub Pages | The browser UI served to staff |
| API | Azure Functions (Node.js, Consumption plan) | Four REST endpoints for skills data |
| Database | Azure Cosmos DB (Serverless) | Stores skill records |
| Asset storage | Azure Blob Storage | Stores binary assets from .skill files |
| Authentication | Microsoft Entra ID (SSO) | Restricts access to NZR staff |
| Deployment | GitHub Actions | Automatic deploy on every push to `main` |
| Custom domain | `skills.ai.nz.rugby` | DNS CNAME → GitHub Pages |

### How it works

1. Staff visit `skills.ai.nz.rugby`, which is served as a static site from GitHub Pages.
2. The browser redirects to Microsoft Entra ID for login. A JWT token is issued on successful sign-in.
3. All API calls to Azure Functions include the JWT as a Bearer token. Easy Auth validates the token before any request reaches the application code.
4. Skills metadata (title, description, prompt, tags) is stored in Cosmos DB. Binary assets are stored in Azure Blob Storage with long-lived read SAS tokens.
5. When someone submits a skill with file assets, the assets are uploaded directly from the browser to Blob Storage using a short-lived write SAS token — the data does not pass through the API.

### API endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/skills` | List all skills (card fields only, no prompt) |
| `GET` | `/api/skills/:id` | Get a single skill including full prompt |
| `POST` | `/api/skills` | Submit a new skill |
| `PUT` | `/api/skills/:id` | Update an existing skill (owner only) |
| `DELETE` | `/api/skills/:id` | Delete a skill (owner only) |
| `POST` | `/api/upload-url` | Generate a SAS token for asset upload |

---

## For Administrators — Setup and Deployment

### Prerequisites

- A GitHub repository (can be public — authentication is handled by Entra ID, not by repo visibility)
- An Azure subscription with access to create resources
- An existing Microsoft Entra ID app registration

### Infrastructure required in Azure

| Resource | Tier | Notes |
|---|---|---|
| Azure Functions app | Consumption (Windows) | Free up to 1M requests/month |
| Azure Cosmos DB account | Serverless | Free up to 1,000 RU/s and 25 GB |
| Azure Blob Storage account | LRS | Minimal cost for asset storage |

### Environment variables on the Functions app

Set these in the Functions app under **Settings → Environment variables**:

| Variable | Value |
|---|---|
| `COSMOS_ENDPOINT` | Your Cosmos DB account endpoint URL |
| `COSMOS_KEY` | Cosmos DB primary key |
| `COSMOS_DATABASE` | Database name (e.g. `skills-db`) |
| `COSMOS_CONTAINER` | Container name (e.g. `skills`) |
| `STORAGE_ACCOUNT_NAME` | Azure Storage account name |
| `STORAGE_ACCOUNT_KEY` | Storage account access key |
| `STORAGE_CONTAINER` | Blob container name (e.g. `skill-assets`) |

### GitHub Actions secrets required

Set these in the repository under **Settings → Secrets and variables → Actions**:

| Secret | Value |
|---|---|
| `AZURE_FUNCTIONAPP_NAME` | The Functions app name |
| `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` | XML publish profile from the Functions app Overview page |
| `VITE_API_BASE_URL` | Functions app URL, e.g. `https://your-app.azurewebsites.net/api` |

### Entra ID configuration

The app registration requires:

- **Single-page application redirect URIs:** `https://skills.ai.nz.rugby` and `http://localhost:5173`
- **Expose an API scope:** `user_impersonation` with Application ID URI `api://[client-id]`
- **Easy Auth on the Functions app:** configured with the app registration client ID, issuer URL, and allowed audience `api://[client-id]`, set to return HTTP 401 for unauthenticated requests

### Blob Storage CORS configuration

Add a CORS rule on the Blob service for direct browser uploads:

| Field | Value |
|---|---|
| Allowed origins | `https://skills.ai.nz.rugby` |
| Allowed methods | `PUT, GET` |
| Allowed headers | `*` |
| Exposed headers | `*` |
| Max age | `3600` |

### Deploying changes

Push to the `main` branch. GitHub Actions runs two jobs in parallel:

- **deploy-frontend** — builds the React app and publishes to GitHub Pages
- **deploy-api** — zip-deploys the Node.js Functions code to Azure

The API deployment typically takes 8–12 minutes due to the size of the `node_modules` directory being packaged.

### Cold starts

The Functions app is on a Consumption plan and will spin down after approximately 5 minutes of inactivity. The first request after a cold start may take 5–15 seconds. The frontend displays a "Starting up" message after 4 seconds to inform users. This is normal and expected behaviour for the free tier.

---

## Troubleshooting

**Skills not loading / spinner persists**  
The API is cold-starting. Wait 15 seconds and refresh the page.

**"You can only edit your own skills" error**  
Edit and delete are restricted to the person who submitted the skill. If a skill needs to be modified by an administrator, it can be updated directly in the Cosmos DB Data Explorer in the Azure Portal.

**Upload fails with "Asset storage is not configured"**  
The `STORAGE_ACCOUNT_NAME` or `STORAGE_ACCOUNT_KEY` environment variables are missing or incorrect on the Functions app. Check **Settings → Environment variables** in the Azure Portal.

**Login loop / redirect error**  
The redirect URI for the current domain is not registered in the Entra ID app registration. Add it under **Authentication → Single-page application** in the Azure Portal.

**Deploy fails in GitHub Actions**  
If the API deploy fails with a publish credentials error, ensure SCM Basic Auth is enabled on the Functions app: **Settings → Configuration → General settings → SCM Basic Auth Publishing Credentials → On**.

---

## Source Code

The source code is maintained in the NZR GitHub repository. The `DEPLOY_CHECKLIST.md` file in the repository root contains a step-by-step guide for setting up the infrastructure from scratch.

---

*This document covers the Skill Browser as of June 2026. For questions or issues, contact the team responsible for NZR's AI tooling.*
