# Hosting Scramjet on GitHub Codespaces – Beginner's Guide

This guide walks you through running Scramjet on a free GitHub Codespace and keeping your browsing sessions saved — even after the Codespace restarts. No coding experience is needed.

---

## What you need

- A GitHub account (free)
- An optional free [Supabase](https://supabase.com) account to save your browsing sessions to the cloud

---

## Step 1 – Open the Codespace

1. Go to the Scramjet repository on GitHub.
2. Click the green **Code** button.
3. Click the **Codespaces** tab.
4. Click **Create codespace on main** (or the branch you want).

GitHub will spend about 1–2 minutes setting up your environment. When it finishes you will see a code editor (VS Code in the browser).

---

## Step 2 – Start the server

In the **Terminal** panel at the bottom of the editor (open it with `` Ctrl+` `` if it is hidden), type:

```sh
pnpm dev
```

Press **Enter**. After a few seconds you will see:

```
Listening on http://localhost:1337/
```

GitHub automatically makes port `1337` available. Click the **Open in Browser** popup that appears, or:

1. Click the **Ports** tab next to the Terminal.
2. Click the globe icon 🌐 next to port `1337`.

Scramjet should now open in a new browser tab.

---

## Step 3 – (Optional but recommended) Save sessions with Supabase

Without Supabase, your cookies (saved logins) are stored in a file inside the Codespace. That file is lost when the Codespace is deleted or rebuilt.

With Supabase your sessions are saved to the cloud, so you can log back in to all your websites on any Codespace — or even on your own computer.

### 3a – Create a free Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up for free.
2. Click **New project**, give it any name, choose a region close to you, and set a database password.
3. Wait ~2 minutes for the project to be ready.

### 3b – Create the sessions table

1. In your Supabase project, click **SQL Editor** in the left menu.
2. Paste the following and click **Run**:

```sql
CREATE TABLE IF NOT EXISTS cookie_store (
  user_id    TEXT PRIMARY KEY,
  cookies    JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3c – Copy your API keys

1. In your Supabase project, click **Settings** (gear icon) → **API**.
2. Copy:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon / public** key
   - **service_role / secret** key (keep this private!)

### 3d – Add the keys to Scramjet

Back in the Codespace terminal:

```sh
cp .env.example .env
```

Then open `.env` in the editor and fill in the three values you copied:

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Save the file and restart the server:

```sh
# Press Ctrl+C to stop the running server, then:
pnpm dev
```

---

## Step 4 – Create your account inside Scramjet

1. In the Scramjet browser tab, click the **👤 Account** button in the toolbar.
2. Click **Don't have an account? Register**.
3. Enter your email and a password, then click **Create account**.
4. You are now logged in. All cookies from websites you visit are saved to your Supabase account.

Next time you open Scramjet on any Codespace (or your own machine), click **👤 Account**, log in, and all your saved sessions will be restored automatically.

---

## Keeping the Codespace alive ("always on")

### Memory limits

The server is pre-configured to use no more than **512 MB** of RAM
(`NODE_OPTIONS=--max-old-space-size=512` in `devcontainer.json`). With Supabase enabled, session data lives in the database rather than in Node.js memory, so memory usage stays flat even after weeks of uptime.

### Idle timeout

GitHub Codespaces pauses after 30 minutes of browser inactivity by default. A keep-alive script is already included:

```sh
node scripts/heartbeat.js &
```

This pings the server every 4 minutes so the Codespace is not suspended while you are using it. It runs automatically on Codespace start (configured in `.devcontainer/devcontainer.json`).

> **Tip:** You can raise the idle timeout to up to **4 hours** in your GitHub settings:
> _Settings → Codespaces → Default idle timeout_

### Usage limits and running for 2 months

| Plan | Free core-hours / month | 2-core runtime / month |
|------|------------------------|------------------------|
| Free | 120 core-hours | ≈ 60 hours |
| Pro | 180 core-hours | ≈ 90 hours |

Running a 2-core Codespace 24 × 7 for two months requires roughly **2,880 core-hours**, which exceeds the free tier. To run cost-effectively for a long period:

1. **Use the heartbeat to avoid accidental idle waste** – the script keeps the Codespace active only while you need it.
2. **Stop the Codespace when you are done** – in the GitHub Codespaces dashboard, click **Stop** rather than just closing the tab. A stopped Codespace uses no compute.
3. **Enable paid usage if needed** – GitHub allows you to set a monthly spending limit. Even a small budget (a few dollars) can cover many hours of runtime.
4. **Rely on Supabase for persistence** – because all your session data is in Supabase, you can stop and delete a Codespace and your logins are still safe. Simply open a new Codespace, add your `.env` keys again, and log in.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Supabase is not configured" when logging in | Add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to your `.env` file and restart the server. |
| Cookies are lost after Codespace restart | You are in file-based mode. Follow Step 3 to enable Supabase. |
| Server not responding | Run `pnpm dev` again in the terminal. Check the Ports tab for the correct URL. |
| "Check your email to confirm your account" | Check your inbox for a confirmation email from Supabase and click the link, then log in. |
