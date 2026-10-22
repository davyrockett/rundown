# Rundown

<!-- shared-preferences:start -->
## David's preferences (shared across all of David's apps)

This section is the same in every one of David's app repos. If David states a new general preference
(not specific to this app), add it here, in this file, and commit it. David's Mac copies it to the other repos.

**Who David is.** A guitar teacher and gigging guitarist (he/him) who builds personal and teaching apps with Claude.
Comfortable with tech but not a programmer: explain in plain words, skip jargon, keep replies short and
concrete. Likes to see things working: verify before saying "done".

**How the apps are built and hosted**
- Public web apps on GitHub Pages under the **davyrockett** GitHub account (never an Artifact or a hosted
  service). Live at `https://www.davyrockett.com/<repo>/` (since 2026-10-18; old
  `davyrockett.github.io` links redirect there). The website itself is the `davyrockett.github.io` repo.
- Each app: `index.html` (+ `app.js` / `styles.css` when bigger), `sw.js` service worker for offline use
  with an update banner, `manifest.webmanifest`, `icons/` drawn by `tools/make-icons.py`, a
  `Start <App>.command` for local testing on the Mac, and a README written for David.
- **`move.js`** (since 2026-10-17): every app loads `move.js` as its first script and lists it in `sw.js`
  `ASSETS`. It carries the app's settings over when the apps move from davyrockett.github.io to
  davyrockett.com (plan: `Claude Apps/move-to-davyrockett-com.md`; master copy `Claude Apps/tools/move.js`).
  Keep it; a new app gets a copy with `data-keep` set to its own localStorage key prefix.
- **`suite.js`** (since 2026-10-18): every app also loads `<script src="suite.js" defer></script>` (in `ASSETS` too).
  It shows an "All apps" button when the app was opened from David's app suite (www.davyrockett.com/apps, one Home
  Screen icon for everything; master copy `Claude Apps/tools/suite.js`). New apps get it too. If a new app syncs,
  add it to `SYNCED` in the website's `apps/launcher.js` so the suite's one access key reaches it.
- **`share.js`** (since 2026-10-19): Settings in every app has a **Share** section (the app's link, "Copy link",
  and "Share…" where the device can). Load `<script src="share.js" defer></script>` (in `ASSETS` too) and add a
  `data-share` block using the app's own classes (see `Claude Apps/tools/share.js`). First Frets has its own
  share section with a QR code instead.
- **Every change must bump the version** (`tools/bump.sh` where it exists, otherwise `VERSION` in `sw.js`
  and the matching app version). Without it, installed copies on phones never update.
- Settings (gear icon) always has **Appearance: Light / Dark / Auto** and **Check for updates**.
  Apps open in **Light** unless changed in Settings.
- Design follows David's First Frets app: warm off-white / dark-brown palette, bright orange accent (#F57C14; dark mode #FF9433; David tried his logo orange #E27039, too red) and
  davyrockett grey secondary text (#676767; dark mode #A3A3A3),
  Big Shoulders Display headings, Atkinson Hyperlegible body text, works well on a phone.
- Data lives on the device (localStorage / IndexedDB). Apps whose data must sync between phone and Mac
  use a separate `davyrockett/<app>-data` repo (`data.json`) and an access key pasted into Settings.
  Never commit keys, tokens or anything in `private/`.
- **Publish when done:** commit, push to `main`, and confirm the live site shows the new version.
  End with a brief summary of what changed. David's Mac pulls GitHub changes into its Dropbox copy
  automatically, so pushing is all that's needed.

**Taste**
- Labels and descriptions plain and descriptive. Jokes belong in names (e.g. "Page Fright"), not taglines.
- Keep screens uncluttered: show extra controls only when they're relevant.
- Nothing should jump around: when a control doesn't apply, grey it out in place rather than hiding it, and
  reserve space for things that appear, so other controls never shift.
- **No AI voices, ever:** no text-to-speech or synthesised singing in any app. Use written instructions on
  screen, and instrument or synth sounds for audio.
- Commit messages: a short, plain description of the change.
- When renaming or moving an app, keep the old address working with a redirect repo.

**New apps:** create the repo under davyrockett and turn on GitHub Pages; David's Mac downloads new
davyrockett repos into `~/Dropbox/Local/Claude Apps/` automatically. Give each new app its own CLAUDE.md
with this section (copy it from any other app) plus an "## This app" section.
Also add every new app to David's unlinked app list, **www.davyrockett.com/apps** (`apps/index.html` in the
website repo, `Claude Apps/website`): icon, name and one-line description, in the right group.
<!-- shared-preferences:end -->

## This app

**Rundown** (named by David, 2026-10-21): David's dashboard at `https://www.davyrockett.com/rundown/`. He wanted
"a bunch of stuff I'd like to see at a glance", looking like the Apps screen, on all his devices.
It started as a **copy of the app suite's screen** (website repo `apps/index.html` + `apps/launcher.js`) so it could
hold more personal things than the Apps screen; the copied parts (icons, share buttons, offline, updates,
one access key) work the same. If the Apps screen's shared parts change, consider copying the change here.

- **All app icons stay at the top** (David). The header shows the time, date and the weather right now in place of a title.
  Cards below flow in columns (`rundown.css`): weather, calendar, The Crossing, RJ sessions, next gigs, practice,
  Z4 to-dos, autocross. Practice / Z4 ticks use the Apps screen's storage keys (`apps.practice`, `apps.z4-ticked`), so
  in a browser both screens show the same ticks; they never change anything in the apps.
- **Weather:** a small 5-day forecast (day, icon, a word or two, high and low) for **San Diego** (David changed this
  2026-10-21: "use san diego… Not too big"; no device location, no current temperature in the header).
  Open-Meteo, no key; kept in `rundown.forecast` for offline.
- **Calendar card is off for now** (David, 2026-10-21); it's commented out in index.html, the code and data stay.
- Autocross rows: date, title, weekday · track · town only (David); club and distance are on MotorsportReg.
- **Data:** the repo `davyrockett/rundown-data`, **public** since 2026-10-21 (David: "we don't need to make any of this
  stuff secret… I just won't share the link"). Rundown reads it with no key (raw.githubusercontent.com). Its workflow `.github/workflows/update.yml`
  runs hourly, checks out this repo and runs `tools/build_data.py` → `data.json` (commits only on change):
  - Calendars (David, 2026-10-21): Personal (`CAL_PERSONAL`), Resounding Joy = the imported "Calendar"
    (`CAL_RJ`), All Davy Rockett Gigs (public feed), David and RaeLynn (`CAL_US`). Secrets are private iCal links.
    Calendar times are Pacific wall-clock, shown as written. Event descriptions are never copied.
    **Resounding Joy entries are cleaned** (David chose this when the repo went public): no locations (some are
    clients' homes) and no client codes or initials (`clean_rj_title`). Never put real client codes or names in
    this repo's code or notes either. The iCal links and Planning Center token stay GitHub **secrets**: they open
    the full calendars (with notes) and The Crossing's Planning Center.
  - The Crossing: Planning Center Services via David's personal access token (`PCO_APP_ID`, `PCO_SECRET`): the next
    plan he's scheduled for (else the next plan he can see), times, his position/status, songs + keys, team members,
    and other requests waiting for his answer.
  - Autocross: MotorsportReg's calendar API (`/api/calendar/events/`, needs `radius=300` + `lat`/`lng`, no CORS, so
    it's fetched by the job, once a day) centred on San Diego; the app shows the next 5 within 150 miles.
  Saving RJ ticks needs the one access key (Rundown's own `rundown.sync-token`, else any syncing app's key) with
  write access to rundown-data; without it ticks stay on the device (`rundown.ticks-pending`).
- **RJ sessions** (David, 2026-10-21: "have I billed for each, have I done the documentation for each"): every
  Resounding Joy calendar event in this pay period and last (1st–15th, 16th–end) with **Documented** / **Billed**
  ticks and "Not a session" (for check-ins, cancelled ones). Ticks are saved to `ticks.json` in rundown-data
  (merged with other devices; pending ones kept in `rundown.ticks-pending` while offline). Session ids are
  `<date>-<hash of UID+start>`; ticks older than 4 months are dropped.
- "All apps" button in each app comes back here: Rundown sets `sessionStorage['davyrockett-suite-home'] = '/rundown/'`
  (read by `suite.js`; the Apps screen sets `/apps/`).
- Bump `VERSION` in `sw.js` on every change. Icon: `tools/make-icons.py` (checklist on the Apps off-white).
- Local preview: `Start Rundown.command` (port 8777) builds a stand-in for www.davyrockett.com from the folders in
  Claude Apps (website styles, other apps' icons). It reads the live data.json from GitHub.
