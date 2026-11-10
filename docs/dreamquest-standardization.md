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

## Phase 3B.3 security remediation ? 2026-10-22

Initial production audit: 0 vulnerabilities. Initial full audit: 4 moderate affected entries. All findings were freshly confirmed; historical reports were not treated as current audit evidence. Working tree was clean initially.

### Changes and application-specific compatibility

No manifest or lockfile changes. Drizzle Kit remains ^0.31.10 ? 0.31.11; ORM remains ^0.45.2 ? 0.45.2. API/web Vitest remain 5.0.5; retain Express and Vite 7.3.7.

No test-tooling update was needed: Vitest 5.0.5 is already present, and only the shared legacy loader advisory remains.

API config resolves PostgreSQL schema and drizzle output to absolute paths and requires the existing database URL setting. Eleven snapshot files were inspected by filename. Existing generation/application use drizzle-kit generate/migrate. Neither was run. The absolute-path check failure was observed before any dependency change (none were made), so it is pre-existing; investigate it separately on target Linux.

Compiler/build/test ownership was preserved: Activus uses ES2023 strict checking, compiled contracts, root TypeScript/Vitest and web jsdom; Penga uses ES2022 NodeNext project references, compiled shared packages and node:test/happy-dom; Healthz uses ES2023 NodeNext API checking, Express, separate web/API Vitest and separate browser tests. No shared configuration was imposed.

### Shared Drizzle Kit investigation

All three repositories retain Drizzle ORM 0.45.2 and the chain Drizzle Kit ? @esbuild-kit/esm-loader 2.6.5 ? @esbuild-kit/core-utils 3.3.2 ? nested esbuild 0.18.20. The separate Drizzle Kit esbuild 0.25.12 does not replace that nested copy. Each full audit reports four moderate affected package entries (esbuild and three propagated loader/tooling parents) for **one unique advisory**, [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99). Do not count this as four distinct advisories or multiply it across repositories in a shared summary.

Registry metadata checked on 2026-10-22 identifies 0.31.11 as latest stable. Both 0.31.10 and 0.31.11 still declare @esbuild-kit/esm-loader ^2.5.5, so a stable patch does not eliminate this chain. The [0.31.11 release notes](https://github.com/drizzle-team/drizzle-orm/releases/tag/drizzle-kit%400.31.11) describe migration-skip warnings, not this security fix. Penga was not upgraded merely for version equality.

The beta tag 1.0.0-beta.22 uses jiti instead of the legacy loader, but that alone establishes neither ORM nor migration compatibility. The rc tag 1.0.0-rc.5 declares drizzle-orm >=1.0.0-rc.5, incompatible with the retained 0.45.2. Its [release notes](https://github.com/drizzle-team/drizzle-orm/releases/tag/v1.0.0-rc.5) include breaking ORM changes and incremental/diff snapshot changes. Adopting that lane needs a separate coordinated ORM/migration evaluation, not an audit-only update. No prerelease was installed.

npm proposes drizzle-kit 0.18.1 through a forced downgrade; this predates the current configuration/migration workflow and has no established compatibility basis here. It was rejected. A modern esbuild override into the legacy loader, loader replacement by alias and broad overrides were also rejected because safe compatibility was not demonstrated. No existing root overrides were found, and none were introduced. **No safe Drizzle Kit remediation was established; its dependencies remain unchanged.**

### Residual exposure and mitigation

The advisory concerns esbuild's development-server serve feature accepting cross-origin requests and exposing served files to malicious websites. The inspected legacy core-utils implementation calls esbuild transform/transformSync; no serve call was found there. Ordinary offline migration-history checks are not evidence of a vulnerable HTTP server, but dependency presence remains flagged and absence of every possible execution path was not proven. Production audits are clean and Kit/loader belong to development tooling.

Until a compatible upstream fix is validated, avoid running the vulnerable esbuild serve feature; use short-lived offline CLI checks in an isolated build environment and retain dev-dependency pruning for production. Loopback binding alone does not prevent a malicious page in the same browser from reaching a local server. Do not expose Drizzle Studio or development tooling to untrusted users. These are documented operating mitigations, not a package fix or a claim of zero residual risk. No server, migration, seed or database integration suite was executed for this work.

### Verification and final audit

check passed: all workspace typechecks, lint, API 240 tests and web 37 tests (277 passed); 15 database tests in 3 files skipped with SLEEP_DATABASE_TESTS explicitly disabled. Build passed. format:check failed on pre-existing apps/web/src/sleep-settings.ts and root package.json formatting; neither file was modified. The default offline drizzle-kit check failed because the Windows absolute out path was concatenated twice when locating 0000_snapshot.json. Without changing config, npm exec --workspace @healthz/api -- drizzle-kit check --dialect postgresql --out ./drizzle passed. This bypasses config loading and validates history, not the schema/config loader end to end.

Final production audit: **0 vulnerabilities**. Final full audit: **4 moderate affected package entries**, all propagated from the single legacy esbuild advisory. No high/critical findings remain reported. Audit counts are unchanged; the residual was not claimed as resolved. Tests/builds executed under Node 24; no clean Linux installation or database compatibility test was performed.

Six exact Linux x64 optional requirements matched: esbuild 0.18.20/0.25.12/0.28.2, Rollup 4.63.0 GNU/musl and @napi-rs/lzma-linux-x64-gnu 1.5.1. No Rolldown parent is present or required in this Vite 7.3.7 lockfile. All checked records retain optional=true and matching linux/x64 metadata. These are lockfile checks, not proof of a successful Linux installation. Migration history/configuration and existing runtime package records remain unchanged. No application source or deployment script was modified.

### Remaining manual verification

Run a clean dev-inclusive install/build on target Linux Node 24 with optional dependencies enabled, then verify compiled startup after production pruning, workspace links/artifacts, static assets and service environment/cwd. Retain the application-specific database driver and migration procedure. Verify backup/restore and migration compatibility only in a separately authorized disposable environment; no migrations were run here. Confirm whether the absolute-path offline check issue also occurs on Linux. Resolve the noted pre-existing formatting failures separately. Track a stable upstream loader fix; evaluate any 1.0 ORM/Kit migration independently rather than forcing an override or downgrade. No commits, pushes or deployments were performed.
