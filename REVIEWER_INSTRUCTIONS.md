# Reviewer instructions (working draft)

Paste the relevant sections into App Store Connect's "App Review Information > Notes" and Google Play's "App content > App access" instructions. Fill in the bracketed placeholders before submitting - reviewers cannot proceed past login without a working account, and this draft cannot supply real credentials.

## Accounts reviewers will need

Diaspora Direct has three roles: client, agent, and admin. Sign-up requires email confirmation, and a new agent account cannot accept work until an admin approves it, so **reviewers cannot simply sign up during review** - they need pre-made, working accounts:

- **Client test account**: email `[reviewer-client@example.com]`, password `[            ]`. Already confirmed, no further setup needed.
- **Agent test account**: email `[reviewer-agent@example.com]`, password `[            ]`. Already confirmed *and* already approved from the Admin panel, so the reviewer lands straight on the task queue instead of a "pending approval" screen.
- Admin login is not required for review and does not need to be shared - reviewers can exercise the client and agent roles fully without it. Only share it if a reviewer specifically asks how account deletion requests are processed on your side.

Before submitting, sign in as each test account yourself once to confirm both still work.

## How to review the client experience

1. Log in with the client test account above.
2. From Home, tap any service tile (Property checks, Family welfare, Errands, Urgent support, Documents, or Funeral care) or **Book & pay now**.
3. Fill in the request details and submit. A vetted local agent normally confirms within about 2 hours; for review purposes an agent account can accept it immediately (see agent steps below).
4. Open **Requests** to see the booking's status, and **Profile** to see account details, the WhatsApp support link, and the legal/privacy links.

## How to review the agent experience

1. Log out (Profile > Sign out) and log back in with the agent test account.
2. Home shows the open task queue. Accept the request created above and advance its status.
3. Once a client and agent are matched on a request, each side can message the other directly by WhatsApp from the request/task screen - this opens WhatsApp (or web.whatsapp.com) using the phone number collected at sign-up, which is expected behaviour, not a bug or a broken link.

## Payments

Requests are paid for through Stripe Checkout, not Apple/Google in-app purchase, because they pay for **real-world services** performed on the ground in Zimbabwe (property checks, errands, welfare visits, and similar), which falls under Apple's "physical goods and services" exception to IAP (guideline 3.1.3(a)) and Google's equivalent policy for real-world services. No digital content or subscription is sold in the app.

**Open question for you before submitting**: do you want the reviewer build pointed at Stripe **test mode** (so review actions never move real money) or your live Stripe account? If test mode, swap the Stripe keys for the build reviewers receive and say so in these notes, e.g. "Payments in this review build use Stripe test mode; card `4242 4242 4242 4242`, any future expiry, any CVC will succeed."

## Account deletion

There is no in-app self-service "delete account" button by design. From **Profile**, both client and agent accounts show **Account deletion help**, a link to `https://app.diaspora-direct.com/delete-account.html`, which explains how to email a deletion request. Deletion requests are then actioned by an admin from the Admin panel's Clients list, which permanently removes the account's profile, messages, requests, and (for agents) agent record, plus the underlying authentication account.

If a reviewer wants to see a deletion actually happen rather than just the request path, you'll need to demonstrate it yourself (e.g. a short screen recording) or action a live request they send during review - the in-app link only starts the request, it doesn't complete it live in front of the reviewer.

## Anything else reviewers might flag

- The WhatsApp deep links require WhatsApp to be installed (or fall back to web.whatsapp.com in a browser) - expected, not a defect.
- Terms and Privacy Policy links are on both the sign-up screen and the Profile screen.
- The app currently has no photo upload feature, despite "photo report" style language sometimes used in marketing copy - agents share photos with clients over WhatsApp, outside the app itself, so no camera/photo-library permission prompt should appear.
