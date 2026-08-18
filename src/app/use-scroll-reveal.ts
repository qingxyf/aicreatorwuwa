import { useEffect, useRef, useState } from 'react';

export function useScrollReveal(refreshKey?: unknown) {
  const rootRef = useRef<HTMLElement>(null);
  const [motionReady, setMotionReady] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const elements = new Set<HTMLElement>();
    const reveal = (element: HTMLElement) => element.setAttribute('data-motion-visible', 'true');
    let observer: IntersectionObserver | undefined;
    const registerElements = () => {
      root.querySelectorAll<HTMLElement>('[data-motion-reveal]').forEach((element) => {
        if (elements.has(element)) return;
        elements.add(element);
        observer?.observe(element);
      });
    };
    const revealInViewport = () => {
      registerElements();
      elements.forEach((element) => {
        const bounds = element.getBoundingClientRect();
        if (bounds.bottom > 0 && bounds.top < window.innerHeight * .92) reveal(element);
      });
    };
    const revealAll = () => {
      registerElements();
      elements.forEach(reveal);
    };

    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        reveal(entry.target as HTMLElement);
        observer?.unobserve(entry.target);
      });
      }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    }

    registerElements();
    if (observer) revealInViewport();
    else revealAll();
    const mutationObserver = typeof MutationObserver === 'undefined' ? undefined : new MutationObserver(() => {
      if (observer) revealInViewport();
      else revealAll();
    });
    mutationObserver?.observe(root, { childList: true, subtree: true });
    window.addEventListener('scroll', revealInViewport, { passive: true });
    window.addEventListener('resize', revealInViewport);
    setMotionReady(true);
    return () => {
      observer?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener('scroll', revealInViewport);
      window.removeEventListener('resize', revealInViewport);
    };
  }, [refreshKey]);

  return { rootRef, motionReady };
}
