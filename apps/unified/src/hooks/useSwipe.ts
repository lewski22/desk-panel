/**
 * useSwipe — hook swipe gestures bez zewnętrznych bibliotek
 * Sprint H2
 * Obsługuje: swipe-left, swipe-right, tap
 */
import { useRef, useCallback } from 'react';

export interface SwipeHandlers {
  onSwipeLeft?:  () => void;
  onSwipeRight?: () => void;
  threshold?:    number;   // px — min dystans (default 60)
  maxDrift?:     number;   // px — max pionowy drift (default 50)
}

export function useSwipe({ onSwipeLeft, onSwipeRight, threshold = 60, maxDrift = 50 }: SwipeHandlers) {
  const start = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY };
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!start.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.current.x;
    const dy = Math.abs(t.clientY - start.current.y);
    start.current = null;

    if (dy > maxDrift) return; // zbyt pionowy — to scroll
    if (Math.abs(dx) < threshold) return; // za krótki swipe

    if (dx < 0 && onSwipeLeft)  onSwipeLeft();
    if (dx > 0 && onSwipeRight) onSwipeRight();
  }, [onSwipeLeft, onSwipeRight, threshold, maxDrift]);

  return { onTouchStart, onTouchEnd };
}
