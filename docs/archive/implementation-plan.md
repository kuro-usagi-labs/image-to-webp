# Implementation Improvement Plan: Electron Batch Image Converter with Optional WordPress Upload

## Summary
- The active app is already a Windows Electron desktop utility, not the older Flask/Tkinter prototypes. Current runtime is `electron-main.js` + `preload.js` + `ui/index.html` + `ui/renderer.js`, with `sharp` for conversion and `electron-store` for settings.
- The right next step is not a stack rewrite. Keep Electron + vanilla HTML/CSS/JS, but split responsibilities cleanly: renderer for UI/state, main process for orchestration, file IO, conversion, upload, and secrets.
- Treat WordPress upload as a second stage in the same batch pipeline, but not as a blocker for local conversion success. Batch result should support `completed_with_warnings`.
- The biggest immediate weaknesses are monolithic files, string-based event contracts, guessed output paths for upload, plaintext secret storage, no cancellation path, and no meaningful automated test coverage.

## 1. Product analysis
- **App classification:** offline-first desktop productivity/media pipeline app with an optional online publishing extension.
- **Primary users:** content editors, site owners, marketers, and developers who batch-convert assets and sometimes push them directly into WordPress media library.
- **Current architecture observed:** Electron main process owns dialogs, storage, conversion, and WordPress calls; preload exposes IPC; renderer is a single imperative DOM script; legacy Python/Flask/Tkinter files remain in repo and create maintenance noise.
- **User flow target:** intake files/folders -> review queue -> set format/quality/output -> convert -> see per-file and batch results -> optionally auto-upload successful outputs -> open output / copy upload results / inspect failures.
- **System flow target:** scan inputs -> normalize + dedupe -> create batch snapshot -> convert per file -> emit authoritative file result -> optionally upload successful output -> aggregate summary -> persist logs.
- **Key product gaps today:** output folder selection is buried in Preferences even though it is core flow; per-file status is shallow; upload state is inferred from strings; clipboard overwrite is automatic; local conversion and upload are not presented as separate pipeline stages.

## 2. Frontend logic
- Use a single renderer store with slices: `queue`, `settings`, `job`, `logs`, and `ui`.
- Keep state explicit. Per-file item shape should include `id`, `sourcePath`, `rootDir`, `sourceSize`, `status`, `outputPath`, `outputSize`, `savedBytes`, `savedPercent`, `uploadStatus`, `uploadUrl`, and `error`.
- Replace direct cross-cutting DOM mutation with action-driven updates: `FILES_ADDED`, `FILE_REMOVED`, `SETTINGS_UPDATED`, `JOB_STARTED`, `FILE_CONVERTED`, `FILE_UPLOAD_RESULT`, `JOB_COMPLETED`, `JOB_FAILED`, `JOB_CANCELLED`.
- Split renderer into small modules: queue view, preview modal, controls panel, settings modal, progress/summary, logs/toasts, and IPC client.
- Stop rerendering the entire queue on every progress event. Update only the changed row/card and recalculate derived totals from store selectors.
- Move the output folder picker back into the main control panel as a first-class action. Keep WordPress credentials in settings because they are lower-frequency and sensitive.
- Make "Copy HTML snippets" an explicit summary action instead of silently replacing clipboard contents at batch completion.
- Define batch phases clearly: `idle`, `ready`, `converting`, `uploading`, `completed`, `completed_with_warnings`, `failed`, `cancelled`.

## 3. Backend logic
- Main process should own the entire batch lifecycle. The renderer should never guess file paths, derive results from human-readable status strings, or handle secrets directly.
- Introduce services in main: `FileIntakeService`, `JobManager`, `ConversionService`, `WordPressUploadService`, `SettingsService`, `SecretService`, and `LogService`.
- `JobManager` should snapshot settings at batch start so a run is deterministic even if the user changes UI controls mid-run.
- `ConversionService` should return authoritative `outputPath`, output size, and per-file conversion result. `WordPressUploadService` should consume that `outputPath` directly.
- Use bounded concurrency rather than "CPU count minus one" everywhere. Recommended defaults: conversion pool `min(4, max(1, cpuCount - 1))`, upload pool `2`.
- Keep WordPress upload optional and downstream. If upload fails after a successful local conversion, mark file as `upload_failed`, not `conversion_failed`.
- Persist non-secret settings in `electron-store`. Store the WordPress app password in the OS credential vault via `keytar` or equivalent Windows Credential Manager bridge.
- Add local structured logging for each batch so support/debugging does not depend on transient toasts.

### Public IPC/API changes
```ts
startBatch({
  items: Array<{ id: string; sourcePath: string; rootDir?: string }>,
  settings: {
    format: "webp" | "avif" | "jpeg" | "png";
    quality: number;
    outputDir?: string;
    preserveFolders: boolean;
  },
  wordpress: {
    autoUpload: boolean;
    siteUrl?: string;
    username?: string;
    hasSecret: boolean;
  }
}) => { jobId: string }

cancelBatch({ jobId }) => { ok: true }

events:
"job:state" {
  jobId, phase, status, startedAt?, endedAt?
}

"job:file" {
  jobId, fileId, sourcePath, state,
  outputPath?, outputSizeBytes?, savedBytes?, savedPercent?,
  uploadUrl?, uploadState?, error?
}

"job:summary" {
  jobId, total, converted, convertFailed,
  uploaded, uploadFailed,
  totalInputBytes, totalOutputBytes, totalSavedBytes
}

settings:get() => {
  outputDir, format, quality, preserveFolders,
  wordpress: { autoUpload, siteUrl, username, hasAppPassword }
}

settings:set(partialSettings) => { ok: true }
secrets:setWordPressPassword({ siteUrl, username, appPassword }) => { ok: true }
secrets:clearWordPressPassword({ siteUrl, username }) => { ok: true }
```

### Probable technical bottlenecks and architectural weaknesses
- Monolithic `ui/renderer.js` and `electron-main.js` increase regression risk and make feature work slow.
- Upload currently reconstructs output paths from status text, which is brittle for preserved folders, duplicate output names, and alternate output locations.
- Queue rendering does full list rerenders during progress, which will degrade badly for large batches.
- Large local thumbnails can create memory pressure and sluggish scrolling.
- Credentials are currently stored in plain app storage, not the OS keychain.
- Repo still contains legacy Python/Flask/Tkinter code and even a committed literal API key in `opencode.json`; this shows weak secret and repo hygiene that must be corrected before adding more integrations.
- There is no contract validation, no cancellation flow, and almost no automated verification.

## 4. Improvement roadmap
- **Short-term, 2-4 weeks:** introduce job/file state model, move upload orchestration into main, make per-file result payload authoritative, secure WordPress secret storage, modularize renderer around a store, restore main-panel output selection, add core unit/integration tests.
- **Mid-term, 1-2 months:** add cancel support, retry policy for WordPress 429/5xx, queue virtualization/lazy thumbnails, exportable batch report, clearer summary UI, structured debug log export, optional TypeScript migration for shared contracts.
- **Long-term, 1-2 quarters:** move conversion work into worker threads or a utility process if large-batch performance requires it, add presets, add pluggable destinations beyond WordPress, add crash recovery for interrupted batches, improve update and diagnostics flow.

## 5. Module-by-module implementation plan
- **Main bootstrap:** keep root entrypoints thin; move runtime logic into `src/main/*`; only window creation and module registration stay in bootstrap.
- **Preload bridge:** expose a narrow, stable command/event API; remove generic raw `store-get/store-set` access from renderer for anything security-sensitive.
- **Queue intake module:** normalize files/folders, dedupe by canonical path, retain folder roots, compute initial stats, and exclude unsupported files with clear reasons.
- **Batch controls module:** validate settings, snapshot them, start/cancel jobs, and keep output location visible in the main flow.
- **Job manager:** own batch IDs, per-file state transitions, concurrency pools, summary aggregation, and final completion state.
- **Conversion module:** resolve output directory, create unique filenames, collect original/output sizes, and normalize sharp error messages into user-facing failure codes.
- **WordPress module:** validate HTTPS URL, test connection, upload from authoritative output paths, map HTTP errors clearly, and apply retry-with-backoff only for transient failures.
- **Secrets/settings module:** store site URL and username in `electron-store`; store app password in OS keychain; renderer sees `hasAppPassword`, not the raw secret.
- **Progress/summary module:** separate conversion counts from upload counts; show local success, upload success, partial success, bytes saved, and failure breakdown.
- **Logs/diagnostics module:** keep batch history in a small local JSON log, redact sensitive fields, and allow "Export debug report".
- **Repo hygiene module:** move `main.py`, `app.py`, `build_exe.bat`, `requirements.txt`, and design-only files like `acuandesign.html` into `legacy/` or `design/`; add missing ignores for `venv/`, `__pycache__/`, temp/error artifacts.

## 6. Ideal architecture
- **Recommended architecture:** renderer modules -> renderer store/actions -> preload contract -> main IPC handlers -> `JobManager` -> conversion/upload/settings/secret/log services.
- **State management suggestion:** use a simple reducer + pub/sub store in vanilla JS. This is enough scale for a single-window desktop app and avoids framework overhead.
- **Per-file state machine:** `queued -> ready -> converting -> converted_local -> upload_pending -> uploaded` or `convert_failed` or `upload_failed`.
- **Batch state machine:** `idle -> ready -> running -> completed | completed_with_warnings | failed | cancelled`.
- **Event flow:** intake scan -> dedupe/normalize -> queue ready -> start batch -> per-file conversion result with `outputPath` -> optional upload enqueue -> upload result -> summary aggregate -> final completion event.
- **Project structure recommendation:**
```text
src/
  main/
    index.js
    ipc/
    services/
    jobs/
  preload/
    index.js
    api.js
  renderer/
    bootstrap.js
    state/
    services/
    modules/
    views/
  shared/
    contracts/
    utils/
ui/
  index.html
  styles/
  assets/
legacy/
tests/
  unit/
  integration/
  fixtures/
```

## 7. Prioritized backlog table
| Priority | Item | Outcome |
| --- | --- | --- |
| P0 | Introduce `JobManager` and explicit file/batch states | Reliable, inspectable pipeline lifecycle |
| P0 | Change IPC to authoritative file-result events with `outputPath` | Eliminates guessed upload path bugs |
| P0 | Move WordPress upload orchestration into main process | Makes upload part of the real pipeline |
| P0 | Store WordPress app password in OS keychain | Removes plaintext secret risk |
| P0 | Split renderer into store + UI modules | Improves maintainability without rewrite |
| P0 | Restore output folder control to main panel | Fixes a core workflow UX regression |
| P1 | Add cancel support and safe shutdown handling | Better long-running batch control |
| P1 | Add retry/backoff for transient WordPress failures | Better reliability under network issues |
| P1 | Add lazy thumbnails / large-queue rendering optimization | Better performance for 100+ files |
| P1 | Add unit + integration tests with image fixtures | Confidence for refactor and release |
| P2 | Archive legacy Python/Flask artifacts and clean repo | Reduces confusion and packaging risk |
| P2 | Add exportable batch report / debug bundle | Better supportability |

## 8. Technical checklist
- Add tests for output path resolution, duplicate name handling, folder preservation, reducer transitions, and WordPress error mapping.
- Add integration tests for PNG/JPEG/SVG/AVIF/WebP inputs, corrupt files, permission errors, missing output directories, and mixed success/failure batches.
- Add WordPress integration tests with mocked responses for `401`, `403`, `404`, `413`, `429`, `5xx`, timeout, and invalid SSL/host scenarios.
- Add smoke tests for "local conversion only", "conversion + partial upload success", "all uploads fail", and "cancel mid-batch".
- Verify that app password is never written to `electron-store`, logs, crash dumps, or renderer-visible persisted state.
- Rotate and remove the exposed literal key currently present in `opencode.json`; add a secret-scanning check to CI or release checklist.
- Acceptance criteria: correct per-file statuses, correct byte-saved totals, no duplicate uploads from filename collisions, no UI lockups on 100-500 file batches, and packaged Windows build passes a full happy-path run.

## 9. Risks and mitigation
- **Sharp format quirks:** keep a fixture suite for animated GIFs, SVGs, alpha PNGs, and corrupted files; fail clearly when unsupported.
- **Large-batch UI slowdown:** use bounded concurrency, lazy thumbnails, and incremental row updates instead of whole-list rerenders.
- **Network instability and duplicate uploads:** make upload stage separate, retry only transient errors, and persist per-file upload state for the active job.
- **Secret leakage:** move secrets to keychain, redact logs, remove committed secrets, and avoid exposing raw password values back to renderer after save.
- **Refactor regression:** change contracts first, then move logic behind those contracts; add tests around current behavior before deeper cleanup.
- **Windows path and permission issues:** normalize paths, test UNC/long paths where possible, and surface actionable errors instead of generic failure text.

## 10. Recommended next sprint plan
- **Sprint assumption:** 2-week sprint, one primary engineer, no framework rewrite.
- **Days 1-2:** define shared file/batch models, IPC contracts, and reducer shape; add fixture files and first unit tests.
- **Days 3-5:** implement `JobManager`, authoritative conversion result events, and move WordPress upload into main-side orchestration.
- **Days 6-7:** add keychain-backed WordPress secret storage, settings contract cleanup, and remove plaintext secret usage paths.
- **Days 8-9:** split renderer into store/actions/views, bring output folder selector into the main panel, and update progress/summary UI for partial-success states.
- **Day 10:** integration test pass, packaged build smoke test, bug fixes, and repo hygiene work for legacy files and secret cleanup.
- **Sprint exit criteria:** local conversion is stable, WordPress upload is an optional second stage with partial-success reporting, secrets are no longer plaintext, and the core path is covered by automated tests.

## Assumptions and defaults
- Keep Electron + vanilla HTML/CSS/JS for now; no React/Vue/Svelte rewrite.
- WordPress upload failure does not fail the local conversion batch; it produces `completed_with_warnings`.
- Single active batch at a time is sufficient for the next phase.
- Windows remains the primary supported platform.
- Legacy Python/Flask/Tkinter code is archived, not further developed, unless explicitly revived later.
