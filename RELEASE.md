# Building a signed Android release

This repo builds signed release `.aab` files via the **Android Release Build**
GitHub Actions workflow (`.github/workflows/android-release.yml`). It runs
automatically on pushes to `main` that touch Android-related files, and can
also be triggered manually from the Actions tab ("Run workflow").

## One-time setup: generate a release keystore

You only need to do this once. A release keystore is what proves to Google
Play that updates to the app really come from you — **do not lose it**, and
**do not commit it to git** (it's already covered by `.gitignore`).

From a terminal with a JDK installed (or via Android Studio's
Build > Generate Signed Bundle / APK > Create new... flow), run:

```bash
keytool -genkeypair -v \
  -keystore diaspora-direct-release.keystore \
  -alias diaspora-direct \
  -keyalg RSA -keysize 2048 -validity 10000
```

You'll be asked to set a keystore password, a key password, and some
identity details (name, org, country) — these don't need to be exact, but
keep the passwords safe (e.g. in a password manager). This produces a file
`diaspora-direct-release.keystore`.

## Add the GitHub repo secrets

In the repo: **Settings > Secrets and variables > Actions > New repository
secret**. Add these four:

| Secret name | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | base64 of the keystore file — see below |
| `ANDROID_KEYSTORE_PASSWORD` | the keystore password you set above |
| `ANDROID_KEY_ALIAS` | `diaspora-direct` (or whatever alias you used) |
| `ANDROID_KEY_PASSWORD` | the key password you set above |

To get the base64 value of the keystore file:

```bash
base64 -i diaspora-direct-release.keystore | tr -d '\n' | pbcopy   # macOS, copies to clipboard
# or
base64 -w0 diaspora-direct-release.keystore                        # Linux, prints it
```

Paste that whole string in as `ANDROID_KEYSTORE_BASE64`.

## Running the build

- Automatically: push a change under `android/`, `src/`, `public/`,
  `package.json`, or the workflow file itself to `main`.
- Manually: go to the **Actions** tab, choose **Android Release Build**,
  click **Run workflow**, optionally set a version name (e.g. `1.0.0`).

Each run produces an `app-release-aab` artifact on the workflow run's
Summary page — download it, and that's the `.aab` to upload to the Play
Console's release track (Testing > Internal testing, or Production).

The workflow sets `versionCode` to the GitHub Actions run number
automatically, so every build has a strictly increasing version code as
Google Play requires. `versionName` defaults to `1.0.0` unless you set it
when running the workflow manually.

## Keeping the keystore safe

Store a backup of `diaspora-direct-release.keystore` and its two passwords
somewhere durable (password manager, encrypted backup). If you ever lose it,
you cannot publish updates to the existing Play Store listing under the same
app — Google has no way to recover or reset it.
