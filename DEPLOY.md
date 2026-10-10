# Deploying the project website

The public website — Home, Domain, Milestones, Documents, Presentations,
About us, Contact us — is a Next.js app under `frontend/`. These seven tabs
are fully static and need no backend, so they deploy on their own.

The link you submit is the URL this produces.

---

## Before you start

- A GitHub account with push access to `Shavinka2001/construction-ai-research`.
- A Vercel account — sign in with GitHub at <https://vercel.com>. The Hobby
  plan is free and is enough for this.

## 1. Push the branch

The work currently sits on a local branch. Push it:

```bash
cd "E:/Reseach site"
git push -u origin feat/research-landing
```

Either deploy that branch directly, or open a pull request and merge it into
`Vinusha` (or whichever branch you treat as current) first. Vercel can deploy
any branch, so pushing is enough to get started.

## 2. Import the project into Vercel

1. <https://vercel.com/new> → **Import Git Repository** → choose
   `construction-ai-research`.
2. **Root Directory** → click *Edit* → select **`frontend`**.
   This is the one setting that matters. The repository is a monorepo; without
   it Vercel looks for `package.json` at the top level and the build fails.
3. Framework Preset should auto-detect as **Next.js**. Leave Build Command and
   Output Directory on their defaults.
4. **Deploy.**

The first build takes two to four minutes. You then get a URL like
`construction-ai-research.vercel.app`.

## 3. Set the production branch

If you deployed from `feat/research-landing` but intend another branch to be
the live one: **Settings → Git → Production Branch**. Every push to that branch
redeploys automatically, and every other branch gets its own preview URL.

## 4. Check it

Open each tab and confirm it loads:

```
/            /domain       /milestones    /documents
/slides      /about        /contact
```

Then open the site on a phone. The layout is mobile-first, but look at it on a
real device before you submit the link.

---

## Outstanding: the Platform button

`/login`, `/register` and `/dashboard` talk to the Python backend in
`backend/`. That backend is **not deployed**, so on the live site those pages
will load but signing in will fail.

The cause is in `frontend/src/lib/api.ts`:

```ts
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";
```

With no `NEXT_PUBLIC_API_URL` set at build time, `http://localhost:8001` is
compiled into the bundle. On a visitor's computer that address is their own
machine, so every request fails.

You said you would handle this later. When you do, there are two routes:

**A. Hide the entry points.** Remove the "Platform" link from
`src/components/landing/SiteNav.tsx` and the Platform column from
`src/components/landing/LandingFooter.tsx`, and demonstrate the platform live
from your laptop at the viva. An examiner clicking a button that errors is
worse than no button.

**B. Deploy the backend.** It needs `torch`, `ultralytics` and `opencv`, so it
will not fit on a 512 MB free tier. Hugging Face Spaces (free, Docker, 16 GB)
is the realistic free option; Railway or Fly.io otherwise. You will also need:

- a PostgreSQL database — Neon has a free tier — set as `DATABASE_URL`;
- `CORS_ORIGINS` on the backend set to your Vercel URL;
- `NEXT_PUBLIC_API_URL` on Vercel set to the backend URL, **then a redeploy**,
  because `NEXT_PUBLIC_*` is inlined at build time;
- `backend/app/models/yolov8_architect.pt`, which is not in the repository.
  Without it the pipeline falls back to `yolov8n.pt` plus an OpenCV heuristic
  (see `backend/app/models/YOLO_WEIGHTS.md`).

---

## On the course web requirement

The project web guidelines state **"Technology allowed: WordPress, HTML, CSS"**
with a **20 MB** limit on the course web server. This site is a Next.js
application hosted on Vercel, with the course web carrying a link to it.

**Confirm that arrangement with your supervisor before you submit.** If it has
to be uploaded to the course web as files instead:

1. Add to `frontend/next.config.js`:

   ```js
   const nextConfig = {
     reactStrictMode: true,
     output: "export",
     images: { unoptimized: true },
   };
   ```

2. Remove the `/api/predict-compliance` route handler — static export cannot
   serve it.
3. Drop the WebGL hero (`HeroScene`) to stay inside 20 MB.
4. `npm run build` then upload the contents of `frontend/out/`.

The seven public tabs survive a static export. `/login` and `/dashboard` do
not, since they depend on the backend either way.
