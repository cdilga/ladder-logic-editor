/**
 * ElementHighlight Component
 *
 * A subtle, non-blocking highlight that appears around target elements
 * during onboarding. Uses pointer-events: none to allow clicks through.
 */

import { useState, useEffect } from 'react';
import './ElementHighlight.css';

interface ElementHighlightProps {
  selector: string;
}

export function ElementHighlight({ selector }: ElementHighlightProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const element = document.querySelector(selector);
    if (!element) {
      setRect(null);
      return;
    }

    const updateRect = () => {
      setRect(element.getBoundingClientRect());
    };

    // Initial update
    updateRect();

    // Update on resize/scroll
    const resizeObserver = new ResizeObserver(updateRect);
    resizeObserver.observe(element);

    // Also listen for scroll events (in case element is in a scrollable container)
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
    };
  }, [selector]);

  if (!rect) return null;

  const padding = 4;

  return (
    <div
      className="element-highlight"
      style={{
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      }}
      aria-hidden="true"
    />
  );
}
