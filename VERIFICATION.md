# Verification — November 16, 2026

## Scanner reliability update (version 1.2.1)

- 58 tests pass, including production decoder hints with off-center barcode fixtures, optional continuous autofocus, fixed-focus fallback, rejected focus constraints and photo input size/type validation.
- Higher requested resolution, full-frame preview, camera selector, delayed scanning guidance and a local photo decoder were added.
- Browser inspection confirmed the new Scan a photo control and guidance. End-to-end photo selection was blocked by the automation extension file-access permission; that permission was not changed. Real webcam recognition, camera selection and photo decoding still need hardware/browser validation.

## Interface update (version 1.2.0)

- Desktop food diary and 390px mobile diary, workout plan, set-entry controls and barcode bottom sheet visually reviewed.
- On a separate test origin, entered squat weight, reps and RPE, marked the set complete, and paused the session using the redesigned controls.
- Nutrition retains all four macro bars and the prior saved test food entry. New calorie summary explicitly distinguishes remaining calories from over-goal calories.
- No storage schema or saved history changes in this update.

## Barcode update (version 1.1.0)

- **Production build passed**, including the manifest and twelve-entry offline precache with the barcode decoder.
- **52 automated tests passed** in five files, including barcode checksum normalization, a real decoder test using a synthetic EAN-13 image, product matching, missing nutrition values, liquid serving handling, lookup failures/timeouts/cancellation, and backup compatibility.
- **TypeScript compilation passed.** The additive IndexedDB version 3 migration preserves existing foods and programs while adding a barcode index; migration is covered by a test.
- Browser verification on a separate local test origin confirmed a live Open Food Facts lookup for barcode 3017620422003 returned a product with editable nutrition values and a disabled save button until review was confirmed.
- A clearly named synthetic QA food was entered through the manual label fallback, saved, and logged as half a serving to Snacks. The resulting totals were 100 kcal, 10 g protein, 12.5 g carbohydrates and 1 g fat.
- Reloading preserved the entry and saved barcode. Re-entering the UPC opened the saved food portion dialog directly. Unknown serving weight correctly disabled gram/ounce portions for this per-serving test food.
- Physical phone camera capture and permission flows have not been tested. The scanner decoder is tested independently; camera lifecycle handling was reviewed in code. No user camera permission was granted during browser QA.

## Original core-app verification

- **33 automated tests passed** across calculation rules, session snapshots and IndexedDB persistence.
- **TypeScript compilation passed.**
- **Production build passed**, including a generated manifest, icons and a ten-entry offline precache.
- Desktop and 390px mobile layouts were visually reviewed during development.
- Browser checks confirmed explicit set completion, saved weight/reps/RPE restoration after reload, paused timer restoration, and gram-based food logging with immediate macro bars.
- The final production update was applied through the app's Save & update control without clearing existing data.
- The production preview server was then stopped. A browser reload still opened the app; saved workouts and the lazily loaded progress charts remained available. This verifies cached operation without the app server, rather than just a successful online page load.
- The seven-day coaching report and monthly comparison table were checked in the browser.
- Concurrent first launches are tested to create only one starter program and food library. Missing or malformed profile data does not trigger destructive reseeding.

## Limits of verification

Physical iPhone/Android installation and a public HTTPS deployment have not been performed. The GitHub Pages workflow is prepared but has not run in a user-owned repository. Timer cues depend on device/browser support. The build emits a non-fatal advisory for the approximately 538 kB initial JavaScript chunk (about 165 kB gzipped); charts and the barcode decoder are separately loaded and precached. New product lookups require internet access and availability of Open Food Facts; saved barcode foods are resolved locally.

The release ZIPs contain application code and starter defaults only. They do not contain browser workout logs, food logs, progress photos or backup files.
