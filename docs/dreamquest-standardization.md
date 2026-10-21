# DreamQuest standardization — Healthz

Date: 2026-10-21. Conservative Phase 2D maintenance. Repository initially clean.

All requested references were available and read: Linksmith `docs/dreamquest-conventions.md`, Activus `docs/dreamquest-standardization-audit.md` including implementation follow-up, and Penga `docs/dreamquest-standardization.md` in sibling repositories. No architecture was copied.

## Initial findings and classification

| Finding                                                                        | Classification                      | Outcome                                                                                                            |
| ------------------------------------------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Missing aggregate check; test/typecheck silently skip absent workspace scripts | Standardization                     | Required workspace scripts; sequential typecheck, lint, tests with `&&`                                            |
| Root/API/web engines `>=22`, no runtime hint                                   | Standardization / requires decision | Added Node 24 hint; defer narrowing engine metadata until actual compatibility checks pass                         |
| Node and browser lint globals merged everywhere                                | Standardization                     | Scope API/scripts/config to Node, frontend source to browser, Node-hosted web tests to both                        |
| Only `.env` and root data contents ignored                                     | Standardization                     | Ignore environment variants, private directories, common device/database exports, build metadata and caches        |
| Import safety and deployment packaging underdocumented                         | Healthz-specific                    | README now explains sensitive inputs, dry-run limitations, backups and archive risk                                |
| Private ESM npm workspaces, Express/PostgreSQL/Drizzle API and Lit/Vite web    | Acceptable difference               | Preserve architecture and dependency ownership                                                                     |
| Shared strict ES2023 TypeScript base, NodeNext API, Bundler/DOM web            | Acceptable difference               | Retain strict/noUncheckedIndexedAccess, class field setting and no-emit checking; API build emits source with maps |
| API and web Vitest suites plus separate Chrome Playwright suite                | Acceptable difference               | Keep both real suites; no placeholders or framework changes                                                        |
| Database suites use opt-in flag with configured DATABASE_URL                   | Requires decision                   | Document disposable database requirement; no DB tests run or guard behavior changed                                |
| External archive includes ignored private directories                          | Requires decision                   | Document packaging review; deployment files unchanged                                                              |

## Inventory and changes implemented

Root `apps/*` workspaces own their runtime and TypeScript/test dependencies. API has Express, pg, Drizzle ORM, dotenv, Pino and Zod; web has Lit and Chart.js. Root owns concurrent development orchestration and ESLint/Prettier. Versions/ranges and the single committed npm v3 lockfile remain unchanged. No extra workspace lockfile is tracked. TypeScript remains 5.9 ranges; no compiler or dependency upgrade was attempted.

`apps/api/src` contains configuration, database access, application modules and import tools; `apps/api/test` contains tests; `apps/api/drizzle` contains migrations and metadata. Web source/public assets, unit tests and e2e tests remain under `apps/web`. `scripts/verify-start.mjs` verifies compiled startup with a dummy URL. Historical docs were preserved. Current README now covers setup, environment, commands, tests, migration tooling, imports and existing deployment.

Changed `package.json`, `.nvmrc`, `eslint.config.mjs`, `.gitignore`, `.prettierignore`, `.env.example`, README and this report. Environment example now uses placeholder credentials and a dedicated development database. No actual `.env` or private data contents were read. No tracked CSV/TSV/database export files were found by filename inventory; intentional synthetic tests remain intact. New generic CSV/TSV ignore rules allow fixtures under workspace `test/fixtures` directories. Arbitrary JSON/PDF/SQL files outside private directories still require staging review. Ignore rules are preventive, not a comprehensive historical secret scan.

## Deliberately retained differences

Build remains web Vite bundle followed by API TypeScript compilation; separate typecheck validates both workspaces, including web tests/configs. Build and formatting remain outside check. Production starts compiled Express and serves sibling web output. Existing `/health` reports process health without querying the database. No readiness, API, reporting, measurement, schema, import/export behavior or UI changes were made.

Drizzle Kit generation/migration, optional healthcare-tag seed and history/blood-pressure import scripts remain explicit operations requiring development tooling. Startup does not migrate. No imports, exports, seed, migration, server, installation, deployment, commit or push was performed.

## Dependency security

Initial Node was `v26.12.0`; after `.nvmrc`, `node --version` reported `v24.22.0`. npm version, `npm audit --omit=dev`, `npm audit` and `npm outdated` were attempted initially and again with Node 24. All were rejected before npm execution by NVM4306: delegated `npm-cli.js` is untrusted. No trust settings were altered or bypassed.

| Scope                            | Result                            |
| -------------------------------- | --------------------------------- |
| Production dependency audit      | Unknown; blocked before execution |
| Full tree / development findings | Unknown; blocked before execution |
| Outdated inventory               | Unknown; blocked before execution |

No affected package list, severity, dependency paths or available fixes could be obtained. This is not a clean audit result; sibling advisory findings cannot establish Healthz security. Rerun audits after repairing the trusted npm installation, record actual package paths/advisories/fixes, and choose dependency maintenance separately. No audit fix, override or update was run.

## Verification

The following were each attempted with Node 24; database opt-in was disabled in the verification process:

| Command                  | Result                                                                                                                           |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `node --version`         | v24.22.0 after runtime hint                                                                                                      |
| `npm --version`          | NVM4306                                                                                                                          |
| `npm run typecheck`      | NVM4306 before execution                                                                                                         |
| `npm run lint`           | NVM4306 before execution                                                                                                         |
| `npm test`               | NVM4306 before execution                                                                                                         |
| `npm run check`          | NVM4306 before execution                                                                                                         |
| `npm run format:check`   | NVM4306 before execution                                                                                                         |
| `npm run build`          | NVM4306 before execution                                                                                                         |
| Both audits and outdated | NVM4306 on retry                                                                                                                 |
| `git diff --check`       | Passed                                                                                                                           |
| `git check-ignore`       | Private environment/data/import/export/backup/report and device/database example paths ignored; `.env.example` remains trackable |

No passing npm validation or tested Node compatibility is claimed. Existing `>=22` engine declarations and matching lockfile metadata were left unchanged rather than claiming unverified 24 support; narrow all three manifests and corresponding lockfile package entries to `24.x` after successful verification. `.nvmrc` selects the target only.

## Remaining decisions before deployment

1. Repair the trusted local runtime/npm installation outside these repository changes, rerun all validation and audits, review any existing formatting/lint failures, and establish Node 24 compatibility before updating engines.
2. Enable database integration suites only against an explicitly disposable database. Existing `SLEEP_DATABASE_TESTS=1` uses DATABASE_URL and does not enforce test-only naming. Stronger guard design needs a separate focused change.
3. External `../../deploy.ps1` and `../../deploy.apps.json` (relative to repository root) specify staging install/build/prune, release activation and service/health rollback. Healthz uses `/srv/storage/apps/healthz`, service `healthz`, environment file `/etc/healthz/healthz.env`, probe `http://127.0.0.1:5005/health`. Confirm actual unit command/working directory, runtime, environment, dev-inclusive build installation, retained artifacts/workspace links, backup and migration procedure in staging. No live server was inspected.
4. Archive exclusions omit environment files, dependencies, Git and logs but do not exclude data/import/export/backup/report directories. Git ignores do not protect deployment archives. Review packaging from a clean checkout before deployment; external scripts were intentionally not modified.

## Reusable lessons

Require scripts for workspaces that actually own tests and typechecks. Separate browser source globals from tooling. A runtime selection is not a compatibility result; a blocked audit is not a clean audit. Preserve existing architecture and database behavior while documenting unsafe opt-ins. Private-data Git ignores, formatter exclusions and deployment packaging need independent review. Keep build and formatting outside aggregate checks unless existing prerequisites require them.
