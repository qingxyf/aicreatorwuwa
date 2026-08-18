# 单页活动首页恢复与奖励预告 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the complete one-page public activity flow and add non-official organizer and replaceable rewards-preview content without weakening production phase controls.

**Architecture:** Keep `App` as the public page composition root. Add a small config-layer demo fixture for local Vite fallback; only use it when the public config request fails in development. Production API responses continue to decide which stage sections render, while the local fixture enables all three flows and local-only interactions for visual review.

**Tech Stack:** React 19, TypeScript, Ant Design 5, Vite, Vitest, existing activity types and CSS design system.

---

### Task 1: Add local-only preview fixtures

**Files:**
- Create: `src/config/demo-preview.ts`
- Test: `tests/config/activity.test.ts`

- [x] Add typed sample config, two pairing works, and three gallery works using existing local hero/character assets and deterministic author names/avatars.
- [x] Export `demoPreviewConfig` with all three schedules, `phase: 'submission'`, `previewMode: true`, and `pairingByTrack`/`galleryByTrack` data keyed by the two track IDs.
- [x] Add a test asserting the demo config is preview mode, exposes all three labeled schedules, and has sample works for both tracks.

### Task 2: Restore fallback rendering and local interactions

**Files:**
- Modify: `src/app/App.tsx`
- Test: `tests/app/public-experience.test.tsx`

- [x] Track `localPreview` separately from `configLoadFailed`; when `import.meta.env.DEV` and `loadConfig()` rejects, load `demoPreviewConfig`, mark config ready, and render all public stage sections.
- [x] In local preview, seed gallery data from the demo fixture and return pairing works locally; do not call upload, submit, pairing-vote, or final-vote APIs.
- [x] Keep the existing production path unchanged when config loads successfully or when `import.meta.env.DEV` is false.
- [x] Add assertions for organizer copy, non-official disclaimer, complete timeline, restored submission callout, pairing panel, gallery, rewards copy, and local demo vote state.

### Task 3: Restore and extend the single-page visual hierarchy

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/styles.css`

- [x] Add the joint-host line and non-official activity note above the hero title while keeping the existing artwork, CTA, and three-node timeline.
- [x] Restore the two voting-rule explainer blocks below the track rule card and keep the character duo in that section.
- [x] Keep the submission preview card, pairing preview, and finalist gallery in one continuous page; use the existing phase conditions for production visibility.
- [x] Add an `ActivityRewards` section with three replaceable award slots, “奖励信息即将公布”, and the post-announcement disclaimer; do not name concrete prizes or amounts.
- [x] Add responsive styles for the organizer line, rewards layout, and 390px viewport with no horizontal overflow.

### Task 4: Verify and commit

**Files:**
- Modify: `README.md` only if the local preview behavior needs documentation.

- [x] Run `npm test -- --run` and confirm all public experience and config tests pass.
- [x] Run `npm run build`, `npm run lint`, `npm run check:architecture`, and `npm run check:bundle-size`.
- [x] Run `npm run dev -- --host 127.0.0.1 --port 4185`, inspect the single-page preview in Browser/IAB at desktop and 390px widths, and confirm no console errors.
- [ ] Commit the implementation with `feat: restore single-page activity home preview`.
