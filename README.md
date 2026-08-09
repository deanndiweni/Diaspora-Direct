# Diaspora Direct App

A client and agent booking app prototype for Diaspora Direct.

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

## What this is, and isn't

This is a front end only. Everything (requests, messages, payments) lives in
memory and resets on refresh. Before real customers use it, you'll need:

- A database (Supabase or Firebase are the fastest to set up)
- Real authentication (sign up / log in)
- A real payment processor (Stripe)
- A backend or serverless functions to connect the two

Treat this as the clickable spec for that build, not the finished product.
