# Environment setup

[← Project overview](../README.md)

Vercel is the source of truth for the website's Firebase web configuration.
GitHub stores the code and `.env.example`; each development computer stores its
downloaded values in an ignored `.env.local` file.

## Which settings belong where?

| Location | Contents |
| --- | --- |
| Vercel → invest-partner → Settings → Environment Variables | The existing Firebase web settings for **Production** and **Development** |
| `.env.local` on each development computer | A downloaded copy of the Development values |
| `.env.example` in GitHub | Variable names and comments, with no actual values |
| Preview deployments / `npm run dev:demo` | Fictional in-memory data; no Firebase settings required |

The current Production and Development settings intentionally identify the same
existing Firebase project. Local live development therefore uses real data;
use `npm run dev:demo` for interface experiments that must not affect records.
Changing computers does not require a new Firebase project or API key.

## Set up another computer

Install the Node.js version listed in the README, clone this repository, and
open its folder. Then run:

```bash
npm ci
npx vercel login
npx vercel link
npx vercel env pull .env.local
npm run dev
```

When linking, choose the existing **invest-partner** project under **Mike Teng's
projects**. Do not create a new Vercel project. Your Vercel account must have
access to that project. `env pull` downloads **Development** settings by default;
the command does not deploy the website or change Firebase data.

Open the local address shown in the terminal. Live Google sign-in also requires
the local hostname to be allowed by the existing Firebase Auth settings. This
migration does not change authorized domains or sign-in permissions.

To try only the interface, skip Vercel setup and run `npm run dev:demo` instead.

## Refresh settings on an existing computer

After an environment value changes in Vercel, run:

```bash
npx vercel env pull .env.local
```

Restart the local development server after pulling. Do not send `.env.local` in
chat or commit it to GitHub. `.gitignore` excludes `.env`, `.env.*`, and `.vercel/`,
while allowing the blank `.env.example` template.

## Manage settings in Vercel

The variables are listed in `.env.example`. Four are required:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`

Storage bucket, messaging sender ID, and measurement ID are optional SDK fields;
the existing app's values are retained. Missing required settings stop the Vite
build before deployment. Error messages list variable names, not their values.

Keep Production and Development scopes explicit. Preview builds are isolated
by `VERCEL_ENV=preview` and continue using the demo SDK even when local Firebase
values exist. Do not add real settings just to run a UI preview.

Vite includes the selected settings at build time, so changes in Vercel apply to
new deployments. Continue using **git push → GitHub → Vercel** after code changes;
an environment-only change requires a new deployment as well.

## Manual setup for a separate installation

Copy `.env.example` to `.env.local` and fill in the Firebase **web app** values
from your own Firebase project's settings. The administrator and partner mapping
remain in `src/App.jsx`; configuring an unrelated Firebase project also requires
its own authentication, access rules, and account setup.

## Public configuration and private credentials

Firebase web configuration is visible in the browser, including when supplied
through Vercel. Environment variables organize configuration; they do not hide
`VITE_*` values from visitors. Protect data with Firebase Authentication and
Firestore Security Rules. Never put service-account private keys or other server
secrets in a `VITE_*` variable.

The Apps Script price updater and daily snapshots keep their existing separate
configuration. This migration does not change their credentials, triggers,
Firestore rules, records, or Firebase project. See [maintenance](maintenance.md)
for that workflow. Existing Git history still contains the former public web
configuration; no history rewrite or key rotation is performed by this change.

References: [Vercel environment variables](https://vercel.com/docs/environment-variables),
[Vercel env CLI](https://vercel.com/docs/cli/env),
[Vite environment variables](https://vite.dev/guide/env-and-mode), and
[Firebase API keys](https://firebase.google.com/docs/projects/api-keys).
