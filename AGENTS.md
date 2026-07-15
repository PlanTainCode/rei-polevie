## Learned User Preferences

- Always reply in Russian.
- Use bun only (never npm/yarn) for install, scripts, and package management.
- Study existing project code thoroughly before editing; for non-trivial work, outline a plan and wait for approval before implementing.
- Do not push to GitHub or deploy unless explicitly asked; the user often updates the server themselves.
- Never run destructive database operations (wipe/reset/migrate that drops data) without explicit permission.
- When generating Word/PDF documents, preserve template styling 1:1 (orientation, fonts, layout); avoid inventing layout changes.
- Prefer writing server update commands in chat rather than running them; typical prod update is `git pull && docker compose build … && docker compose up -d …`, and avoid rebuilding the API image in ways that re-download LibreOffice when only web changed.

## Learned Workspace Facts

- Monorepo «Полевие» (`polevie`): bun workspaces with NestJS API (`apps/api`), React web (`apps/web`), Telegram bot (`apps/bot`), Android Kotlin app (`apps/mobile`), and `packages/shared`.
- Production is at https://rei-polevie-pro.ru/ via Docker Compose (`polevie-api`, `polevie-web`, `polevie-postgres`); server path is typically `~/rei-polevie`.
- Domain centers on field-work automation for REI: objects/projects, monitorings, GTS defect sheets, IEI/IGMI program Word generation, indicators, and photo albums.
- Word templates live under `apps/api/templates/`; document generation often uses LibreOffice on the API host for conversion.
- Coordinates across the product should be decimal degrees (e.g. `54.418384, 33.134425`), not degrees-and-minutes.
- Executor / REI side in program documents is АО «РЭИ-ЭКОАУДИТ»; IEI/IGMI title blocks and shared sections should follow established generation logic, not invent layout from scratch.
- Mobile APK for fieldwork is distributed from the web fieldwork page; the Android app must target the same production API as the web, not a local backend.
- Related spin-offs discussed: `rei-cam` (cameral IEI generation, Go + React) and a separate monitorings app; field work remains in this repo.
