# Diaspora Direct App

A client and agent booking app for Diaspora Direct, live at app.diaspora-direct.com.

## Run locally

```bash
npm install
npm run dev
```

Open the URL it prints (usually http://localhost:5173).

## Deploy to Vercel (recommended, free)

1. Push this folder to a new GitHub repo
2. Go to vercel.com, sign in with GitHub, click "Add New Project"
3. Select the repo, leave all settings as default (Vercel auto-detects Vite)
4. Click Deploy. You'll get a live URL in about a minute
5. Under Project Settings > Domains, add `app.diaspora-direct.com` and follow the DNS instructions to point it there

## Deploy to Netlify (alternative, also free)

1. Push this folder to a new GitHub repo
2. Go to netlify.com, "Add new site" > "Import an existing project"
3. Build command: `npm run build`, publish directory: `dist`
4. Deploy, then add your custom subdomain under Domain settings

## Current state

Auth and data run on Supabase. Payments run on Stripe Checkout, with the
serverless functions in /api creating and verifying the session. Still to do:

- Photo upload from agents, via Supabase storage
- Realtime updates for requests and messages
- Email or push notifications on status changes
- Solicitor review of the terms and privacy pages in /public

The terms and privacy pages are drafts and are linked from the sign-up form and the client profile screen.
