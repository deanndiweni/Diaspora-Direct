# Store submission checklist

The native bundle identifier is `com.diasporadirect.app` and the public app name is **Diaspora Direct**. Change the identifier before the first store upload if this identifier is not available; it cannot be changed after release without creating a new app listing.

## Build prerequisites

- Node.js 24 LTS and npm
- Android Studio with the current stable Android SDK and Java required by Capacitor
- Xcode on macOS, with an active Apple Developer membership
- A local `.env` copied from `.env.example`

Run:

```bash
npm install
npm run mobile:sync
npm run mobile:doctor
```

Open the native projects with `npm run mobile:android` or `npm run mobile:ios`.

## Google Play Console

- Create the app with package name `com.diasporadirect.app`.
- Complete App access and provide a working reviewer account because login is required.
- Complete Data safety using `PRIVACY_DISCLOSURES.md` as a starting point and verify every answer against Supabase, Stripe, Vercel, and production analytics.
- Declare that payments are for real-world services, not digital content.
- Complete the content rating, target audience, ads, financial features, and account-deletion declarations.
- Add the public privacy-policy URL: `https://app.diaspora-direct.com/privacy.html`.
- Add the public account-deletion URL: `https://app.diaspora-direct.com/delete-account.html`.
- Upload a signed Android App Bundle (`.aab`) to Internal testing first.
- Add final icon, feature graphic, phone screenshots, short description, and full description.

## Apple App Store Connect

- Create the app with bundle ID `com.diasporadirect.app`.
- Complete App Privacy using `PRIVACY_DISCLOSURES.md` as a starting point and verify every answer.
- Add the privacy-policy URL and support URL.
- Explain in Review Notes that payments purchase real-world concierge/errand services and therefore use Stripe rather than in-app purchase.
- Provide a working reviewer account and clear steps to reach client and agent functionality. Note in Review Notes that the app also opens straight to a public browse screen (services, pricing, how it works) with no login required; login/sign-up is only needed to actually book, track or pay for a service.
- Account deletion is a real in-app self-service action: Profile > Delete my account calls `api/delete-account.js` with the signed-in user's own token and deletes their auth account, profile, messages, requests and (for agents) agent record immediately, with a confirmation prompt first. The Profile screen's "account deletion page" link (public `/delete-account.html`, email-based) is kept only as an alternative for someone who can't get into the app. Attach a screen recording of the in-app deletion flow (sign in with the demo account, Profile > Delete my account, confirm, land back on the browse screen) in the Notes field per Apple's request.
- Upload with Xcode Organizer to TestFlight first, complete export-compliance questions, then test on a physical iPhone.
- Add screenshots for every required device class, app description, keywords, category, age rating, copyright, and support contact.

## Release blockers that need owner input

- Final Apple team, certificates, provisioning profiles, and signing
- Google Play upload key and Play App Signing enrollment
- A permanent support URL and support email
- Store listing copy, screenshots, final 1024x1024 icon, and Google feature graphic
- Reviewer credentials for both client and agent roles
- A solicitor-reviewed privacy policy and terms
- Add `SUPABASE_SERVICE_ROLE_KEY` and `APP_PUBLIC_URL` to Vercel, then test account deletion using a disposable account
- Production-test the native Stripe return/deep-link flow on physical Android and iPhone devices

Never commit signing keys, service-account JSON, `.env` files, or store credentials.
