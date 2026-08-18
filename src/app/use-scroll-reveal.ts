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
