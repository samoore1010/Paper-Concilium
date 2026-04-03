import { useState, useEffect, useRef, useCallback } from "react";

interface TeleprompterProps {
  script: string;
  isActive: boolean;
  isLive: boolean;        // true when user clicks "Go Live"
  onToggle: () => void;
}

export function Teleprompter({ script, isActive, isLive, onToggle }: TeleprompterProps) {
  const [isScrolling, setIsScrolling] = useState(false);
  const [speed, setSpeed] = useState(1);         // 0.5x, 1x, 1.5x, 2x
  const [fontSize, setFontSize] = useState(14);
  const [expanded, setExpanded] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef(0);

  // Auto-start scrolling when user goes live (if teleprompter is visible)
  useEffect(() => {
    if (isLive && isActive && !isScrolling) {
      setIsScrolling(true);
    }
  }, [isLive, isActive]);

  // Auto-scroll tick
  useEffect(() => {
    if (!isScrolling || !isActive) return;
    const pixelsPerTick = 0.4 * speed;
    const interval = setInterval(() => {
      scrollRef.current += pixelsPerTick;
      setScrollPosition(scrollRef.current);
    }, 50);
    return () => clearInterval(interval);
  }, [isScrolling, isActive, speed]);

  // Apply scroll position
  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = scrollPosition;
  }, [scrollPosition]);

  const handleRewind = useCallback(() => {
    scrollRef.current = Math.max(0, scrollRef.current - 200);
    setScrollPosition(scrollRef.current);
  }, []);

  const handleReset = useCallback(() => {
    scrollRef.current = 0;
    setScrollPosition(0);
    setIsScrolling(false);
  }, []);

  const handleManualScroll = useCallback(() => {
    if (containerRef.current) {
      scrollRef.current = containerRef.current.scrollTop;
      setScrollPosition(scrollRef.current);
    }
  }, []);

  if (!script) return null;

  if (!isActive) {
    return (
      <button
        onClick={onToggle}
        className="absolute bottom-1 left-1 md:bottom-2 md:left-2 z-30 w-8 h-8 md:w-auto md:h-auto md:px-3 md:py-1.5 rounded-lg bg-black/70 backdrop-blur border border-white/5 text-[9px] md:text-[10px] text-white/60 hover:text-white/90 flex items-center justify-center md:gap-1"
      >
        <span>📄</span>
        <span className="hidden md:inline">Script</span>
      </button>
    );
  }

  const mobileHeight = expanded ? "20dvh" : "48px";

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-30 flex flex-col transition-all duration-200"
      style={{ maxHeight: typeof window !== "undefined" && window.innerWidth < 768 ? mobileHeight : "30%" }}
    >
      {/* Control bar */}
      <div className="flex items-center justify-between px-2 md:px-3 py-1 bg-black/80 backdrop-blur-md border-t border-white/5 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[8px] md:text-[9px] text-white/30 uppercase tracking-wider">Script</span>

          {/* Play / Pause */}
          <button
            onClick={() => setIsScrolling(!isScrolling)}
            className="w-6 h-6 rounded bg-surface-overlay hover:bg-surface-overlay text-[10px] text-white/70 flex items-center justify-center"
            title={isScrolling ? "Pause" : "Play"}
          >
            {isScrolling ? "⏸" : "▶"}
          </button>

          {/* Rewind */}
          <button
            onClick={handleRewind}
            className="w-6 h-6 rounded bg-surface-overlay hover:bg-surface-overlay text-[10px] text-white/70 flex items-center justify-center"
            title="Rewind"
          >
            ⏪
          </button>

          {/* Reset */}
          <button
            onClick={handleReset}
            className="w-6 h-6 rounded bg-surface-overlay hover:bg-surface-overlay text-[10px] text-white/70 flex items-center justify-center"
            title="Reset to start"
          >
            ↺
          </button>

          {/* Speed */}
          <div className="flex items-center gap-0.5 ml-1">
            {[0.5, 1, 1.5, 2].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-1.5 py-0.5 rounded text-[9px] transition-colors ${
                  speed === s ? "bg-blue-500/30 text-blue-300" : "bg-white/5 text-white/40 hover:text-white/60"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Mobile peek toggle */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="md:hidden text-[9px] text-white/40 hover:text-white/70 ml-1"
          >
            {expanded ? "▼" : "▲"}
          </button>
        </div>

        <div className="flex items-center gap-1">
          {/* Waiting indicator */}
          {!isLive && !isScrolling && (
            <span className="text-[8px] text-yellow-400/70 mr-1">Waiting for Go Live...</span>
          )}
          {/* Font size */}
          <button onClick={() => setFontSize((s) => Math.max(11, s - 1))} className="w-6 h-6 md:w-5 md:h-5 rounded bg-surface-overlay text-[9px] text-white/50 flex items-center justify-center">A-</button>
          <button onClick={() => setFontSize((s) => Math.min(22, s + 1))} className="w-6 h-6 md:w-5 md:h-5 rounded bg-surface-overlay text-[9px] text-white/50 flex items-center justify-center">A+</button>
          <button onClick={onToggle} className="w-6 h-6 md:w-5 md:h-5 rounded bg-surface-overlay text-[9px] text-white/50 flex items-center justify-center">✕</button>
        </div>
      </div>

      {/* Script content */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto scroll-touch px-3 md:px-6 py-2 bg-black/70 backdrop-blur-md"
        onWheel={handleManualScroll}
        onTouchStart={handleManualScroll}
      >
        <div
          className="text-white/90 leading-relaxed font-light text-center max-w-xl mx-auto"
          style={{ fontSize: `${fontSize}px`, lineHeight: "1.6" }}
        >
          {script}
        </div>
        <div className="h-[20vh]" />
      </div>
    </div>
  );
}
