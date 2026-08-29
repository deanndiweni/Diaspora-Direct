# Privacy and store disclosures (working draft)

This document is an engineering inventory, not legal advice. Confirm it against production before submitting either store questionnaire.

## Data the app appears to collect

- Account identifiers: name, email address, phone number, Supabase user ID, and role
- User content: service requests, descriptions, city/country, and messages
- Purchase information: request fee, payment method/status, Stripe Checkout session metadata, and request ID
- Operational data: assigned agent, request status, timestamps, completion and payout information

## Purposes

- Account creation and authentication
- Delivering and administering requested real-world services
- Client-agent communication, including sharing each party's phone number directly with the other once matched on a request, so they can message on WhatsApp
- Payment processing and fraud prevention
- Customer support, record keeping, and legal compliance

## Processors visible in this repository

- Supabase: authentication, database, and potentially storage
- Stripe: payment processing
- Vercel: web hosting and serverless API hosting
- WhatsApp (Meta): client and agent phone numbers are handed to wa.me deep links so the two parties can message each other directly; Diaspora Direct does not see the content of those messages

## Tracking and analytics

- No analytics, crash-reporting, or advertising SDK is present in this codebase (checked package.json dependencies and index.html for Sentry/Firebase/Mixpanel/Segment/AdMob/GA-style integrations, none found)
- No client-side console.log or tracking calls send data anywhere; the only server-side logging is console.error inside the api/*-account.js functions, which stays in Vercel's own function logs
- Answer the App Privacy / Data Safety tracking questions as "no tracking" unless a new analytics integration is added later; if one is, update this section first

## Account deletion

- There is no in-app self-service delete button. From Profile, a client or agent can open Account deletion help, a link to the public /delete-account.html page, which asks the user to email a deletion request.
- Deletion requests are actioned by an admin from the Admin panel's Clients list, which calls api/admin-delete-account.js (service-role key, admin-only) to remove the client's messages, requests, agent record (if any), profile, and auth account.
- api/delete-account.js (a self-service DELETE endpoint scoped to the caller's own bearer token) still exists in the codebase but is no longer called from the app. It is currently dead code left over from before the self-service button was removed - safe to leave, but consider removing it or wiring a future self-service flow back to it so the code matches what actually ships.
- Both stores expect an accessible account-deletion path when an app supports account creation; the in-app link plus admin-actioned deletion satisfies this as long as reviewers are told how it works (see STORE_SUBMISSION.md).

## Submission cautions

- Do not claim that data is encrypted, not retained, or not linked to identity unless production configuration and contracts support that claim.
- Determine whether Supabase logs, Stripe fraud tooling, or any other production service adds diagnostics, device identifiers, or coarse location beyond what is listed above.
- public/privacy.html already states retention periods, deletion procedures, international-transfer language, controller identity, and a contact address; it still needs a solicitor's review before relying on it, per STORE_SUBMISSION.md's release blockers.
