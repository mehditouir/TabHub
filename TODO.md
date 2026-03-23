# TabHub — Sprint 10 Remaining Tasks

These items are deferred from Sprint 10. Pick up from this file in the next session.

---

## Task 3 — Performance / Load Test

**Goal:** Verify SignalR scales under concurrent load.

- Simulate 50 devices simultaneously connected to a single tenant hub
- Place orders from multiple clients at once and measure fan-out latency
- Tool suggestion: k6 with WebSocket support, or NBomber (.NET)
- Acceptance: no dropped events, < 200 ms fan-out for 50 concurrent clients

---

## Task 5 — Demo Data & Onboarding Wizard

**Goal:** Make the app ready for a live graduation demo.

### Demo data seed
- Seed `restauranttunisia` with realistic data:
  - 3 spaces (Salle, Terrasse, Bar) with tables
  - 20+ menu items across 5 categories (Entrées, Plats, Boissons, Desserts, Petits-déjeuners)
  - 4 staff members (1 waiter, 1 kitchen, 1 cashier, 1 admin)
  - 10+ historical orders in various statuses

### Onboarding wizard
- Step-by-step first-time setup flow for new restaurants:
  1. Set restaurant name + TVA rate + language
  2. Create first space + add tables
  3. Add first staff member
  4. Create first menu category + item
- Show wizard when a new tenant has zero spaces/items
- Route: `/manager/:tenant/setup`

---

## Task 6 — Graduation Report

**Goal:** Written report for graduation committee.

Sections to cover:
1. Problem statement (restaurant ordering pain points)
2. Architecture overview (diagram + tech choices)
3. Sprint-by-sprint development timeline
4. Key technical decisions (schema-per-tenant, SignalR, mobile-first)
5. Live demo walkthrough (screenshots of each app surface)
6. Future work / commercialisation roadmap

---

## E2E Test Suite — Playwright

**Goal:** Automated end-to-end test suite that executes all 83 regression tests from `REGRESSION.md` against the production environment.

**Requirements:**
- Uses Playwright (TypeScript) — launches real Chrome, fills fields, clicks buttons
- Runs locally with `npx playwright test`
- Tests map 1-to-1 to the modules in REGRESSION.md (T-01 through T-83)
- Each test has a descriptive name matching the test ID and title
- Runs against `https://ashy-grass-0c75bb903.6.azurestaticapps.net` by default (configurable via env)
- Visual trace on failure (Playwright traces)
- Do NOT push until Mehdi validates all tests pass locally

**Location:** `e2e/` directory at the repo root

**Run command:**
```bash
cd e2e
npx playwright test
```

**Status:** Not started. Scaffold the project and implement modules one at a time.

**Note:** This suite lives locally only until validated. Once all 83 tests pass, push and wire into CI.
