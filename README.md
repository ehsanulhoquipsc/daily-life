# Daily Life

Mo's personal phone app for planning, tracking and reviewing each day. It's a PWA (installable web app) that works offline.

**Screens:** Home dashboard · Today (schedule, prayers, habits, reflection, plan tomorrow) · Tasks · Money (personal spending by sector, household split box) · Health (weight, food, water, exercise, sleep, screen time) · Habits (reading, typing, public speaking, idea parking) · English speaking practice (30-minute session, interview questions, ratings, tricky words) · World tour (spinning globe, planned and visited places, trips with a travel fund, coverage by country and continent, milestones) · Reports (10-day progress) · Inbox (reminders and ideas) · Settings (theme, goals, backup).

## How it works
- It's plain HTML, CSS and JS with no build step and no frameworks. It's fast on any phone.
- Data is saved on the phone (`localStorage`). It also syncs to Firebase Firestore after you sign in with Google (Settings → Cloud sync). Edits made offline upload when you're back online.
- Sync code is in `sync.js`. The Firebase SDK 13.2.0 is self-hosted in `vendor/`. Data is stored at `users/{uid}/parts/{core|tx|m-YYYY-MM}`.
- The World tour globe uses d3-geo and topojson-client (ISC), self-hosted in `vendor/`. `world-data.js` holds country borders from Natural Earth via world-atlas, cities from GeoNames (CC BY 4.0) and a country table derived from world-countries (ODbL). These load the first time the World tour page opens.
- `sw.js` caches the app, so it opens with no internet.
- The schedule starts on cycle 1, day 1 = Mon 9 Nov 2026 (`START` in `app.js`). Reports cover 10-day periods.

## Hosting
It's hosted on GitHub Pages from the `main` branch root. The custom domain is set in `CNAME` and in Settings → Pages.

## Edit
- The weekly schedule is in `SCHED` in `app.js`.
- Prayer times are in `PRAYERS`.
- Colours are in `app.css` (light and dark variables at the top).
- After a change, bump `CACHE` in `sw.js` so phones pick up the new version.
