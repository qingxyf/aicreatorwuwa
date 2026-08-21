# 运营后台密码登录 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the `/ops` Toy-open-id whitelist gate with a server-verified password login while leaving the public activity page unchanged.

**Architecture:** Add a small Node-only `ops-auth` module that verifies an scrypt password hash and issues short-lived HMAC-signed bearer sessions. The API exposes a password login endpoint and protects only `/api/v1/ops/*`; the React operations page keeps the session token in memory and sends it only to operations calls. Public submission/voting requests continue using Toy identity headers.

**Tech Stack:** TypeScript, Node `crypto` (`scrypt`, HMAC), Hono, React/Ant Design, Vitest, PostgreSQL-backed API.

---

### Task 1: Add the authentication primitives with tests first

**Files:**
- Create: `server/ops-auth.ts`
- Test: `tests/server/ops-auth.test.ts`

- [ ] **Step 1: Write failing tests**

Cover these behaviors in `tests/server/ops-auth.test.ts`: a generated scrypt record accepts the original password and rejects another; a signed session verifies before expiry; a tampered token and an expired token are rejected.

- [ ] **Step 2: Run the focused test and verify RED**

Run `npm test -- tests/server/ops-auth.test.ts`. It must fail because `server/ops-auth.ts` does not exist.

- [ ] **Step 3: Implement the minimal module**

Export `hashOpsPassword`, `verifyOpsPassword`, `issueOpsSession`, and `verifyOpsSession`. Encode password records as `scrypt$N$r$p$salt$derivedKey` using Node `crypto.scrypt` and compare derived bytes with `timingSafeEqual`. Encode sessions as URL-safe payload plus HMAC-SHA256 signature; payload must contain `purpose: "ops"` and `exp`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run `npm test -- tests/server/ops-auth.test.ts`; expect all authentication primitive tests to pass.

- [ ] **Step 5: Commit**

Run `git add server/ops-auth.ts tests/server/ops-auth.test.ts && git commit -m "feat: add signed operations sessions"`.

### Task 2: Protect the Node operations API with password sessions

**Files:**
- Modify: `server/app.ts`
- Modify: `server/index.ts`
- Test: `tests/server/api-contract.test.ts`

- [ ] **Step 1: Extend API contract tests first**

Add tests using a deterministic scrypt record and session secret: `POST /api/v1/ops/login` returns a token for the correct password, returns 401 `operator_login_failed` for a wrong password, and `/api/v1/ops/submissions` returns 401 without a bearer token but reaches the repository with a valid token.

- [ ] **Step 2: Run the API tests and verify RED**

Run `npm test -- tests/server/api-contract.test.ts`; expect failures because the login route and password session guard are not implemented.

- [ ] **Step 3: Implement server wiring**

Add `opsAuth` configuration to `ServerDependencies`, add `POST /api/v1/ops/login`, and replace `operatorContext` with bearer-session verification. Return stable errors `ops_auth_unconfigured`, `operator_login_failed`, and `operator_session_required`; map them to 503, 401, and 401. Add login rate limiting keyed by the first `X-Forwarded-For` value (five failed attempts per five minutes per key) without logging the password. Build `opsAuth` from `OPS_ADMIN_PASSWORD_HASH`, `OPS_SESSION_SECRET`, and optional `OPS_SESSION_TTL_SECONDS` in `server/index.ts`.

- [ ] **Step 4: Run the API tests and verify GREEN**

Run `npm test -- tests/server/api-contract.test.ts`; expect all existing session/health tests plus the new password tests to pass.

- [ ] **Step 5: Commit**

Run `git add server/app.ts server/index.ts tests/server/api-contract.test.ts && git commit -m "feat: protect operations API with password sessions"`.

### Task 3: Change only the operations client and page to use the password session

**Files:**
- Modify: `src/adapters/http/public-activity-client.ts`
- Modify: `src/app/OpsApp.tsx`
- Modify: `src/app/styles.css`
- Test: `tests/app/ops-experience.test.tsx`

- [ ] **Step 1: Update UI tests first**

Replace the Toy-profile gesture test with a password-login test: the page initially shows a password input and does not call any API; entering a password calls `loginOperations`, then loads submissions/settings and shows “密码验证通过”. Add a wrong-password test that keeps the login card visible and shows the server error. Keep the existing finalist/media/settings tests using a fake `OperationsApi` with `loginOperations` and `clearOperationsSession` methods.

- [ ] **Step 2: Run the focused UI tests and verify RED**

Run `npm test -- tests/app/ops-experience.test.tsx`; expect failures because the current page still calls `currentViewer` and has no password field.

- [ ] **Step 3: Implement the client and UI changes**

Add `loginOperations(password)` and `clearOperationsSession()` to `OperationsHttpClient`. Store the returned token only in a private `opsSessionToken` field and add it as a bearer header for operations reads/writes. Keep the existing `currentViewer` and identity-header path untouched for public activity calls. Replace the operations card copy/button with a password input and login button; add a logout button and reset state when the token expires or logout is clicked. Do not add a password input or auth code to `App.tsx`.

- [ ] **Step 4: Run the focused UI tests and verify GREEN**

Run `npm test -- tests/app/ops-experience.test.tsx`; expect all operations UI tests to pass.

- [ ] **Step 5: Commit**

Run `git add src/adapters/http/public-activity-client.ts src/app/OpsApp.tsx src/app/styles.css tests/app/ops-experience.test.tsx && git commit -m "feat: add operations password login"`.

### Task 4: Add deployment configuration and operator documentation

**Files:**
- Modify: `.env.example`
- Modify: `docs/deployment/bilibili-toy.md`
- Modify: `README.md`
- Create: `scripts/generate-ops-password-hash.mjs`

- [ ] **Step 1: Add the hash generator and documentation tests/checks**

Implement a CLI that reads a password from an interactive prompt or `OPS_PASSWORD` environment variable and prints only the scrypt record; never print the raw password. Document `node scripts/generate-ops-password-hash.mjs` and the required ECS-only variables without committing their values.

- [ ] **Step 2: Verify the generator**

Run `$env:OPS_PASSWORD='LFisSc8MX4xEKzPX'; node scripts/generate-ops-password-hash.mjs` and confirm the output starts with `scrypt$` and contains no copy of the raw password.

- [ ] **Step 3: Document the deployment and rollback**

Explain that public Toy access remains unchanged, `/ops.html` uses the new password, the password hash and session secret belong only in ECS `.env`, and removing those variables disables operations login without affecting public submissions/votes. Update the Toy deployment order so `npm run build:toy` remains the final static build step.

- [ ] **Step 4: Commit**

Run `git add .env.example README.md docs/deployment/bilibili-toy.md scripts/generate-ops-password-hash.mjs && git commit -m "docs: configure operations password deployment"`.

### Task 5: Run full verification and build the correct Toy artifact

**Files:**
- No source changes expected.

- [ ] **Step 1: Run the full checks**

Run `npm run check:precompletion`; expect build, lint, 57+ tests, architecture, and bundle-size checks to pass.

- [ ] **Step 2: Rebuild Toy last and inspect it**

Run `npm run build:toy`, then `python "C:\Users\qxyf\.agents\skills\toy\scripts\toy_doctor.py" dist --slug aicreatorwuwa --json`. Confirm `toy_doctor` reports `ok: true` and the final `dist/assets/main-*.js` contains the unchanged public Toy identity header path.

- [ ] **Step 3: Commit the verified state**

Run `git status --short` and confirm no generated secrets or untracked password files exist. Push the implementation commits to `origin/main`.

