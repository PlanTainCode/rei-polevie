## Learned User Preferences

- Always reply in Russian.
- Use bun only (never npm/yarn) for install, scripts, and package management.
- Study existing project code thoroughly before editing; for non-trivial work, outline a plan and wait for approval before implementing.
- Do not push to GitHub or deploy unless explicitly asked; the user often updates the server themselves.
- Never run destructive database operations (wipe/reset/migrate that drops data) without explicit permission.
- When generating Word/PDF documents, preserve template styling 1:1 (orientation, fonts, layout, end signatures); do not invent boilerplate text or layout; avoid glued words (missing spaces) and stray extra spaces in Word XML.
- Prefer writing server update commands in chat rather than running them; typical prod update is `git pull && docker compose build … && docker compose up -d …`, and avoid rebuilding the API image in ways that re-download LibreOffice when only web changed.

## Learned Workspace Facts

- Monorepo «Полевие» (`polevie`): bun workspaces with NestJS API (`apps/api`), React web (`apps/web`), Telegram bot (`apps/bot`), Android Kotlin app (`apps/mobile`), and `packages/shared`.
- Production is at https://rei-polevie-pro.ru/ via Docker Compose (`polevie-api`, `polevie-web`, `polevie-postgres`); server path is typically `~/rei-polevie`.
- Domain centers on field-work automation for REI: objects/projects, monitorings, GTS defect sheets, IEI/IGMI/IGI program Word generation, indicators, and photo albums.
- Word templates live under `apps/api/templates/`; document generation often uses LibreOffice on the API host for conversion.
- Coordinates across the product should be decimal degrees (e.g. `54.418384, 33.134425`), not degrees-and-minutes.
- Executor / REI side in program documents is АО «РЭИ-ЭКОАУДИТ»; on the IEI program title, «Согласовано» is at the top and «Утверждаю» at the bottom on the REI signatory (column 2), unlike the TZ layout.
- IEI program §1.2 location uses the precise address (often from the object name); Moscow/non-Moscow remains a separate DB flag. Urban-planning activity type must be taken 1:1 from the TZ. Background-concentrations certificate: customer-provided → §2.1 (keep the template certificate number and recolor red→black), ordered by us → §2.3.
- IEI program generation specifics: §3.2 inserts the operator’s directions/nearby text even with no directions and may optionally keep the «режимный объект» phrase; §4.1/§4.2 exclude socio-economic research rows; §4.2 sealed-territory sentence only if sampling points ≤ 2 and services must not invent items absent from the assignment (e.g. ППР); §4.4 bottom-sediment wording only when sediments exist; §4.5 is always «Не требуется»; §6.1 Moscow regulations must not be prefixed with «(Москва)»; §7.2 states copy quantity once only; §7.3 must stay as in the template (AI must not rewrite it).
- IGI program generation adapts a contractor-supplied Word file: rewrite only the title and §1 (same canonical rules as IEI/IGMI, with REI/customer signatories generated like other programs); leave the rest of the contractor content unchanged; skip «демонтаж…» lines in §1.9.x; no situational-scheme upload on the IGI page.
- Mobile APK for fieldwork is distributed from the web fieldwork page; the Android app must target the same production API as the web, not a local backend.
- Related spin-offs discussed: `rei-cam` (cameral IEI generation, Go + React) and a separate monitorings app; field work remains in this repo.
