# Hybrid Performance

A private, mobile-first training and nutrition PWA. React + TypeScript, Vite, Tailwind, Radix accessible dialogs, Recharts, Dexie / IndexedDB, and a Workbox offline cache. No login, backend, API key, paid database, or subscription is required.

## Open it on this Windows computer

Double-click **START-HYBRID.cmd** in this folder. Keep the window open and visit **http://localhost:5173** in your browser. The launcher uses Node.js if installed, or the bundled runtime already available on this computer. Dependencies have been installed in this workspace.

For another computer, install the current Node.js LTS from https://nodejs.org, open a terminal in this folder, then run:

```sh
npm install
npm run dev
```

Open the address printed by Vite. Do not open `index.html` by double-clicking it; a web server is required.

Production / offline preview:

```sh
npm run test
npm run build
npm run preview
```

Open the preview URL printed in the terminal. The service worker runs in the production build, not in the development server. Wait for “Ready for offline use on this device.”

## Publish for free with GitHub Pages

1. Create a free GitHub account if needed, then create a **public** repository named `hybrid-performance`. Public repositories support free Pages hosting. Your **source code** will be public; workout entries and photos remain in your browser and are never uploaded by this app. The initial profile in `src/seed.ts` is part of the public source, so review it before publishing.
2. Use GitHub Desktop: **File → Add local repository**, choose this folder, and use its **create a repository here** option if needed. Commit the files and choose **Publish repository** with **Keep this code private** unchecked. Alternatively, upload the source files using GitHub's website. Include `.github/workflows/deploy.yml`, `src`, `public`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `index.html`, `tsconfig.json`, and `vite.config.ts`. Do not upload `node_modules`, browser backup files, or personal photos.
3. On the repository website, choose **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Open **Actions → Test and deploy Hybrid Performance → Run workflow** on the `main` branch. Future pushes to `main` deploy automatically.
5. Wait for the green completion check. Open the URL shown by the deployment or in **Settings → Pages**. It will usually be `https://YOUR-USERNAME.github.io/hybrid-performance/`.

The workflow installs locked dependencies, runs the tests, builds, and deploys `dist`. Relative asset paths support a repository subdirectory. No domain purchase is necessary. If you used a branch name other than `main`, change it in the workflow.

Official reference: [Using custom workflows with GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

**Simpler hosting option:** The already-built `dist` directory is a standalone static site. Upload its contents to any HTTPS static host you already use. It does not need a server or environment secrets.

## Install on your phone

1. Open the **deployed HTTPS URL** on your phone, while online. `localhost` on your phone refers to the phone, not your computer.
2. **iPhone:** Safari → Share → Add to Home Screen → Add.
3. **Android:** Chrome menu → Install app / Add to Home screen.
4. Open the home-screen app online once. Wait for the offline-ready message, then try it in airplane mode.

Keep using the same URL/browser installation for your data. Installation on a new device starts with a fresh database. Move your records using Settings → Full JSON backup, then Import backup on the other device. Hosting on plain HTTP across your home network will not provide full PWA installation/offline support; use the HTTPS deployment.

## Webcam scanning tips (1.2.1)

If the live scanner struggles, choose **Scan a photo** and select a clear barcode image (up to 20 MB). Photos are decoded locally, never uploaded. Hold bars horizontally, keep white space on both ends, use even lighting and move back if the webcam is blurry. After permission is granted, a Camera selector appears when multiple cameras are available. Higher resolution and continuous autofocus are requested where supported. Fixed-focus webcams may still require manual barcode entry.

## Interface update (1.2)

The interface uses neutral charcoal surfaces, compact workout rows and a grouped food diary. Nutrition shows Goal − Food = Remaining (or Over goal), followed by all four macro bars. Each meal has an Add food shortcut. Phone dialogs open as bottom sheets. Workout history and saved foods keep their existing data format.

## Your first day

- **Dashboard → Start workout.** Or use Workouts to select any of the four weeks and training days. Log weight, reps/meters and RPE directly beneath each exercise. Mark the checkbox explicitly. A filled input alone never marks a set done.
- Working-set edits save immediately in IndexedDB. Wait for **Saved on device** before closing. Resume unfinished workouts from the dashboard or history. Timers retain elapsed time and pause state across reloads.
- Tap **Add set**, **Warm-up**, the set number (toggle type), reorder arrows, or **Copy previous weights**. New sets copy the last set's weight. Dumbbell loads are per hand, carries use total load, and pull-ups use added load only.
- **Finish workout** saves a completed session, including partially completed sessions after confirmation. The summary reports completed sets and highest-load records. Previous performance remains visible on the next exposure. Completed sessions remain editable.
- Accept or reject optional progression suggestions under each completed exercise. Acceptance can prefill the next exposure; it never changes past logs. Pain, missing data, recovery flags, deload weeks and dumbbell limits constrain the rules.
- **Nutrition → Log food.** Search generic/custom foods, choose grams/ounces/servings/items, and add to a meal. Four horizontal bars show calories, protein, carbs and fat. Tap a logged food to edit it. Nutrition values in existing entries are snapshots, so changing a food label cannot rewrite past intake.
- Build recipes from saved foods and specify servings and/or final cooked weight. Log fractions of a serving or weighed leftovers. Save an existing meal as a reusable template, or copy any meal from another date.
- Custom food, recipe and food-entry editor drafts are retained locally as you type. Press Save to commit them to history. Closing these dialogs discards their draft; drafts are excluded from backups.
- Use **Log run / ruck** for scheduled or unscheduled endurance. Time is entered in decimal minutes: `20.5` = 20:30. For rowing, distance is optional. Endurance results are separate from strength sessions; recording them also satisfies the corresponding day in the weekly calendar.
- **Log weight / Check in** supports weight, waist, body fat estimates, pull-ups, recovery and local photos. You can leave unused fields blank.
- **Workouts → Edit program** edits days, exercises, week-specific sets/reps/rest/RPE, substitutions, and endurance instructions. Save creates a new active version and archives older versions. Completed sessions keep their independent snapshots. “Create next four weeks” copies the plan for review; use actual logged results and accepted suggestions when setting up the next month.
- **Settings → Copy Progress for AI Coach** produces a date-bounded text report to paste into your ChatGPT Fitness project. It does not automatically sync with ChatGPT.

## Scan food barcodes

1. Open **Nutrition → Scan barcode → Start camera** and allow camera access when your browser asks.
2. Hold a UPC-A, EAN-8 or EAN-13 barcode in view. You can also type the printed digits and tap **Find food**; manual entry accepts valid 8, 12, 13 or 14-digit product codes.
3. Review the product, nutrition basis and all four nutrition values against the package. Correct anything missing or inaccurate, then check the review box and tap **Save food & choose portion**.
4. Choose the meal and quantity, then add the food. Future scans of that barcode use your saved food first.

Camera scanning on a phone requires the **deployed HTTPS address** and camera permission. An ordinary HTTP address on your home network will not work for camera access. If permission is denied or a camera is unavailable, use manual barcode entry. The camera stops when the scanner closes, a barcode is found, or you leave the app tab.

New product lookups use the free [Open Food Facts](https://world.openfoodfacts.org) database and require internet access. Only the barcode is sent; camera images and workout/meal history stay on your device. Product data is supplied by Open Food Facts contributors under [ODbL](https://opendatacommons.org/licenses/odbl/1-0/). Community records can be missing or incorrect. Unknown products can be entered manually and saved with their barcode. Missing nutrition values are never assumed to be zero, and milliliters are not assumed to equal grams.

Previously saved barcode foods work offline after the app is installed and cached. Saved foods and barcode associations are included in JSON backups. The barcode review form is temporary until you save it; closing it discards unsaved changes.

## Data reliability and backups

- IndexedDB has versioned schema migrations. Programs, sessions (including set snapshots), foods, recipes, food logs, endurance and measurements use separate stores; metadata and form drafts use the metadata store.
- Writes are queued and atomic. Unchanged records are not rewritten. Storage failures are visible, and a failed database load never resets existing data.
- JSON backups include the profile, all committed histories, archived plans and photos. Keep copies outside the browser. Browser storage is not a substitute for a backup; clearing site data, device loss or browser eviction may remove it.
- Import validates the entire nested file, dates, numeric ranges, unique IDs, photos and schema version **before** writing. A review dialog shows new records and conflicts. Imports add new IDs and **keep existing matching IDs**, even if the imported version is newer. Repeated imports do not duplicate records. Imported programs start archived. Profile replacement is an explicit option.
- Import is a safe merge, not a destructive restore. To recover an older version of a conflicting record, use a separate browser/profile and import the backup there. There is no automatic cross-device conflict resolution.
- Dates are stored as local calendar strings. Changing your selected IANA timezone changes “today” but does not move historical dates. Session creation timestamps break ties between multiple workouts on the same date.
- CSV exports cover individual workout sets, nutrition entries and endurance. CSV spreadsheet-formula prefixes are escaped.

## Analytics and rule boundaries

Charts use recorded results only. Baseline PRs are clearly labeled separately. Strength charts show the highest completed working-set load; they do not estimate a one-rep max. A weight record requires repetitions and an explicitly completed working set. Warm-ups are excluded. Seven-day nutrition averages include unlogged dates as zero and show how many dates have logs; a missing log is not proof that no food was eaten. Seven-day weight averages use recorded measurements only. Monthly views compare session counts and show month-filtered trends and histories.

The ruck target is 6 miles at 12:00/mile with 45 lb dry (72 minutes); it is marked achieved only if a recorded session meets all three conditions. Load-carriage volume uses distance × total carried weight. Ruck recommendations never automatically increase speed or suggest running under load. The supplied clearance note is retained.

Food library values are labeled **generic estimates** and can be replaced. No exact branded label is invented. Recipes do not infer cooking weight changes; enter measured finished weight when using gram portions. Body fat values are user-entered estimates.

## Verification and scope

Run `npm test` and `npm run build`. All 58 tests passed in the delivered version. Tests cover macro scaling, ounce conversion, items, per-serving labels, recipe portions, pace, local dates/DST, progression safety, weekly statistics, JSON validation/merge, CSV escaping, coach reports, database restore, concurrent initialization and preservation on malformed data. Browser QA checked desktop and 390px mobile layouts, explicit set completion, workout restoration after reload, and 199 g food logging. Offline reopening, saved workout access and progress charts were verified with the preview server stopped. See `VERIFICATION.md` for the exact verification scope.

Two ready-to-use packages are in `release`: **Hybrid-Performance-Source.zip** contains the editable project and GitHub workflow; **Hybrid-Performance-Static.zip** contains the built site for an HTTPS static host. Neither includes your browser's personal logs or photos.

This release includes every main section and working core logging/backup workflows. Deliberate simplifications:

- No GPS, commercial food database, wearable integration or automatic device sync. Barcode scanning uses the optional free Open Food Facts lookup.
- Program edits use a form editor, not drag-and-drop; up arrows reorder sets/exercises. Monthly programming is a reviewed copy with optional rule suggestions, not an autonomous coach.
- Progress photos are stored at their supplied resolution (8 MB upload limit). Large photo libraries increase backup and memory use; JSON imports are limited to 100 MB.
- Background timer notifications are not guaranteed when the OS suspends the app. The countdown catches up when reopened; optional audio/vibration depends on the browser.
- Nutrition goal history is not versioned. Target charts evaluate historical intake against the current selected targets.
- No cloud deployment was performed from this workspace. The production build and GitHub workflow are ready; creating/publishing your repository is the remaining hosting step. Physical iPhone/Android installation has not been tested on your device.

## Source map

`model.ts` — schemas/types; `seed.ts` — original program and generic food library; `logic.ts` — calculations/rules/exports; `storage.ts` and `store.tsx` — persistence and state; `drafts.ts` — local form drafts; page components — UI; `styles.css` — responsive visual system; `.github/workflows/deploy.yml` — free static deployment.

No runtime analytics, tracking pixels, remote font requests or external AI requests are included.

