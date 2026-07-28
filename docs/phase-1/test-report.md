# Phase 1 Build and Test Report

Date: 2026-07-28  
Branch: `refactor/global-core-phase-1`  
Base: `main` at `416076e8ea19aa3f19a86faaaa08abfd9d69da90`

## Result

Phase 1A Global Core and the preserved Qingdao v2.4 Legacy baseline both build and pass their applicable automated tests.

This report does not claim that fixture data is current travel information. Hotel prices, ratings, availability, opening hours and route durations must be verified before real travel.

## Global Core quality gate

GitHub Actions run: `30338392294`  
Verified code head: `83395b74bb527d2041cd952d74618dd86f3cda71`  
Artifact: `global-core-strict-artifacts`  
Artifact digest: `sha256:fff83e8ba87f8dbd5cdf5c7209a97457f25f33d7f1a0e7e3c1c94d768aa745e5`

Passed gates:

- reproducible dependency installation with committed `package-lock.json` and `npm ci`;
- Prettier format check;
- ESLint with zero warnings;
- strict TypeScript typecheck;
- fixture Schema validation and JSON Schema export;
- domain, data-schema and map-adapter tests: 10 passed;
- Planner deterministic, invariant and property tests: 6 passed;
- Provider contract, timeout, cancellation and degradation tests: 5 passed;
- Vite production build;
- compressed bundle budget;
- Global Core secret scan;
- tracked-source cleanliness after build;
- Chromium and WebKit E2E, including Pages base-path smoke: 10 passed.

Bundle result:

| Asset class | Gzip bytes | Budget |
|---|---:|---:|
| JavaScript | 154,944 | 184,320 |
| CSS | 9,264 | 35,840 |
| Total | 164,208 | 256,000 |

Validated fixture coverage:

- 2 countries: CN and SG;
- 2 time zones: Asia/Shanghai and Asia/Singapore;
- 2 currencies: CNY and SGD;
- 2 languages: zh-CN and en;
- 2 places, 2 planning units, 6 POIs, 3 sources and 12 travel-time matrix entries.

## Qingdao v2.4 Legacy verification

Verified against the preserved Legacy build chain.

Passed workflows:

- Build v2 modular release: run `30338392192`;
- Validate v2 modular release: run `30338392151`;
- Validate Pages payload: run `30338392869`;
- Playwright v2 visual regression: run `30338392249`.

Legacy visual report:

- total project/test combinations: 18;
- applicable tests passed: 8;
- device-inapplicable tests skipped by design: 10;
- unexpected failures: 0;
- desktop Chromium: 1920×1080 and 2560×1440;
- Xiaomi flagship Chromium: portrait and landscape;
- iPhone flagship WebKit: portrait and landscape.

Artifact: `playwright-v2.4.0-report`  
Artifact digest: `sha256:b4a978b7c9eeeef96906250dbde36f5a95b892640cc7e1a41c306ee851f492bf`

## Important fixes verified by tests

- eliminated false-green CI caused by shell pipelines swallowing exit codes;
- replaced invalid dependency versions and committed a reproducible lockfile;
- separated Global and Legacy Playwright suites;
- fixed GCJ-02 conversion applying incorrectly to overseas coordinates;
- fixed stationary meal/rest activities receiving fabricated travel time;
- corrected strict Playwright locator usage for destination reordering;
- retained explicit unavailable/degraded Provider states instead of fabricated live data.

## Credential decision

The repository owner has accepted a temporary Legacy exception: existing AMap credentials remain in the preserved Qingdao v2.4 chain until a functioning backend or other replacement is available.

This exception does not extend to Global Core. Global Core does not copy or expand those credentials. The decision is recorded in ADR-0005.

## Status and limitations

Completed:

- history-preserving migration baseline;
- architecture and ADR documentation;
- deterministic Global Core vertical slice;
- production build and complete automated quality gates;
- Legacy regression verification;
- Draft PR evidence.

Not claimed or intentionally deferred:

- production-quality global destination database;
- live hotel prices, ratings or inventory;
- live transit, weather or route guarantees;
- authenticated backend or secret-bearing Provider gateway;
- merging to `main` or changing the public Pages deployment.

PR remains Draft and must not be merged solely on the basis of fixture-data completeness.
