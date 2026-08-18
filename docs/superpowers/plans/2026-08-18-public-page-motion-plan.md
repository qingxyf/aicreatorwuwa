# Public Page Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add lightweight scroll and interaction motion to the public activity page without changing voting, submission, media, or operations behavior.

**Architecture:** Keep motion orchestration in the `app` layer with a small `useScrollReveal` hook. Existing components receive `data-motion-reveal` markers; scoped CSS handles transitions, hover feedback, stagger timing, progress-line drawing, and reduced-motion behavior. No new provider, API, database field, or animation dependency is introduced.

**Tech Stack:** React 19, TypeScript, CSS transitions/keyframes, Vitest + Testing Library, Codex in-app Browser.

---

### Task 1: Add scroll-reveal orchestration and fallback coverage

**Files:**
- Create: `src/app/use-scroll-reveal.ts`
- Modify: `src/app/App.tsx`
- Test: `tests/app/public-experience.test.tsx`

- [ ] **Step 1: Write the fallback-visible test**

Add a test that renders the public page in the existing JSDOM setup (which does not provide `IntersectionObserver`) and verifies the main content is immediately marked visible:

```tsx
test('reveals public sections immediately when scroll observation is unavailable', async () => {
  render(<App api={createApi()} />);

  const section = await screen.findByRole('heading', { name: '选择赛道，再开始创作' });
  expect(section.closest('[data-motion-reveal]')).toHaveAttribute('data-motion-visible', 'true');
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run `npm test -- tests/app/public-experience.test.tsx -t "reveals public sections immediately"`.
Expected: FAIL because the page has no motion marker or visibility attribute yet.

- [ ] **Step 3: Implement `useScrollReveal`**

Create a hook with a root ref and `motionReady` state. It should query `[data-motion-reveal]`, set `data-motion-visible="true"` for every marker when `IntersectionObserver` is unavailable, and otherwise observe each marker once, disconnecting on cleanup. Accept a refresh key for configuration readiness and use a `MutationObserver` plus a lightweight scroll check so asynchronously loaded gallery cards are registered after the first render. The hook must not hide content until the root has `motion-ready` applied.

```ts
import { useEffect, useRef, useState } from 'react';

export function useScrollReveal() {
  const rootRef = useRef<HTMLElement>(null);
  const [motionReady, setMotionReady] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const elements = Array.from(root.querySelectorAll<HTMLElement>('[data-motion-reveal]'));
    const reveal = (element: HTMLElement) => element.setAttribute('data-motion-visible', 'true');

    if (typeof IntersectionObserver === 'undefined') {
      elements.forEach(reveal);
      setMotionReady(true);
      return undefined;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        reveal(entry.target as HTMLElement);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    elements.forEach((element) => observer.observe(element));
    setMotionReady(true);
    return () => observer.disconnect();
  }, []);

  return { rootRef, motionReady };
}
```

- [ ] **Step 4: Mark existing public sections and cards**

In `App.tsx`, call the hook, attach `ref={rootRef}` to `<main>`, add `motion-ready` only when `motionReady` is true, and add `data-motion-reveal` to the rules section, submission section, vote section/panel, gallery cards, rewards section/cards, and the hero stage. Keep the existing semantic structure and handlers unchanged.

- [ ] **Step 5: Run the focused test and confirm it passes**

Run `npm test -- tests/app/public-experience.test.tsx -t "reveals public sections immediately"`.
Expected: PASS.

- [ ] **Step 6: Commit the orchestration change**

```bash
git add src/app/use-scroll-reveal.ts src/app/App.tsx tests/app/public-experience.test.tsx
git commit -m "feat: add public page scroll reveal orchestration"
```

### Task 2: Implement scoped motion styles and verify interactions

**Files:**
- Modify: `src/app/styles.css`

- [ ] **Step 1: Add reveal and stagger styles**

Add scoped rules under `.site-shell.motion-ready` that transition `[data-motion-reveal]` from `opacity: 0; transform: translate3d(0, 22px, 0)` to visible state, with explicit 80ms/160ms/240ms delay selectors for card groups. Never apply the hidden state without `motion-ready`.

- [ ] **Step 2: Add interaction feedback styles**

Add low-amplitude hover transitions for `.pairing-work`, `.gallery-card`, and `.reward-slot`; scale only `.media-art` within its card; animate `.voted-button` once with a confirmation pulse; animate the pairing progress bar from the left and draw `.hero-stage::before` when the stage is visible.

- [ ] **Step 3: Add reduced-motion overrides**

Inside `@media (prefers-reduced-motion: reduce)`, remove transforms, transition delays, progress/line/keyframe animations, and hover lifts while keeping content opacity at 1 and preserving focus/selected styles.

- [ ] **Step 4: Run the full precompletion checks**

Run `npm run check:precompletion`.
Expected: build, lint, 42+ tests, architecture check, and bundle-size check all pass.

- [ ] **Step 5: Verify the target flow in Browser**

Use the existing local tab at `http://127.0.0.1:4185/`:

1. Confirm URL/title, meaningful DOM, no framework overlay, and no error/warn console logs.
2. Capture the desktop first viewport, scroll through rules → submission → blind selection → final voting → rewards, and confirm each marked section reveals once.
3. Click “开始盲选”, hover/click a pairing card, then click a final-vote button and confirm the visible “今日已投” state.
4. Set a 390×844 viewport, verify no horizontal overflow and that cards/rewards remain readable, then reset the viewport.

- [ ] **Step 6: Review and commit styles**

```bash
git diff --check
git add src/app/styles.css
git commit -m "feat: add public page motion feedback"
```
