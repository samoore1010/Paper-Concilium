import { useRef, useState, useEffect, useCallback, type ReactNode } from "react";

interface ScrollFadeContainerProps {
  children: ReactNode;
  /** Additional classes for the scrollable inner div */
  className?: string;
  /** Gradient width in pixels (default 48) */
  fadeWidth?: number;
  /** Gradient color — should match container background. Default: black */
  fadeColor?: string;
}

/**
 * Wraps horizontally-scrollable content with leading/trailing fade gradients
 * that indicate more content is available off-screen.
 *
 * - Trailing (right) gradient shows when content overflows to the right
 * - Leading (left) gradient shows when scrolled past the start
 * - Both disappear when not needed (no overflow, or scrolled to that edge)
 */
export default function ScrollFadeContainer({
  children,
  className = "",
  fadeWidth = 48,
  fadeColor = "rgb(0,0,0)",
}: ScrollFadeContainerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const updateFades = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    // Small threshold to avoid sub-pixel false positives
    setShowLeft(scrollLeft > 2);
    setShowRight(scrollLeft + clientWidth < scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Initial check + observe resize
    updateFades();
    const ro = new ResizeObserver(updateFades);
    ro.observe(el);

    el.addEventListener("scroll", updateFades, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", updateFades);
    };
  }, [updateFades]);

  return (
    <div className="relative">
      {/* Leading (left) fade */}
      {showLeft && (
        <div
          className="absolute left-0 top-0 bottom-0 z-10 pointer-events-none"
          style={{
            width: fadeWidth,
            background: `linear-gradient(to right, ${fadeColor}, transparent)`,
          }}
        />
      )}

      {/* Scrollable content */}
      <div ref={scrollRef} className={className}>
        {children}
      </div>

      {/* Trailing (right) fade */}
      {showRight && (
        <div
          className="absolute right-0 top-0 bottom-0 z-10 pointer-events-none"
          style={{
            width: fadeWidth,
            background: `linear-gradient(to left, ${fadeColor}, transparent)`,
          }}
        />
      )}
    </div>
  );
}
