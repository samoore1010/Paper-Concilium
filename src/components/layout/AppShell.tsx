import { useState, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Sidebar } from "./Sidebar";
import { HeaderBar } from "./HeaderBar";
import { MobileTabBar } from "./MobileTabBar";

export type AppView =
  | "setup"
  | "practice-dashboard"
  | "practice-exercise"
  | "script-setup"
  | "joining"
  | "meeting"
  | "feedback"
  | "collection"
  | "progress"
  | "settings";

const STORAGE_KEY = "pp-sidebar-collapsed";
const SIDEBAR_EXPANDED = 240;
const SIDEBAR_COLLAPSED = 64;
const MOBILE_BREAKPOINT = 768;

/** Views where all navigation chrome is hidden for full-screen immersion */
const IMMERSIVE_VIEWS: AppView[] = ["meeting", "joining"];

// --- Mobile detection via matchMedia ---
const mobileQuery = typeof window !== "undefined"
  ? window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  : null;

function subscribeMobile(cb: () => void) {
  mobileQuery?.addEventListener("change", cb);
  return () => mobileQuery?.removeEventListener("change", cb);
}

function getIsMobile() {
  return mobileQuery?.matches ?? false;
}

interface AppShellProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  headerActions?: ReactNode;
  children: ReactNode;
  streakCount?: number;
}

export function AppShell({ currentView, onNavigate, headerActions, children, streakCount }: AppShellProps) {
  const isMobile = useSyncExternalStore(subscribeMobile, getIsMobile, () => false);

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const isImmersive = IMMERSIVE_VIEWS.includes(currentView);

  const toggleSidebar = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* noop */ }
      return next;
    });
  };

  // Keyboard shortcut: Ctrl+B to toggle sidebar (desktop only)
  useEffect(() => {
    if (isMobile) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isMobile]);

  // Immersive mode: no shell, just content
  if (isImmersive) {
    return <>{children}</>;
  }

  // Mobile layout: bottom tab bar, no sidebar
  if (isMobile) {
    return (
      <div className="min-h-[100dvh] bg-surface-base text-white flex flex-col">
        <HeaderBar currentView={currentView} actions={headerActions} />
        <main className="flex-1 overflow-y-auto pb-[calc(56px+env(safe-area-inset-bottom,0px))]">
          {children}
        </main>
        <MobileTabBar currentView={currentView} onNavigate={onNavigate} />
      </div>
    );
  }

  // Desktop layout: sidebar
  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;

  return (
    <div className="min-h-screen bg-surface-base text-white">
      <Sidebar
        currentView={currentView}
        collapsed={collapsed}
        onToggle={toggleSidebar}
        onNavigate={onNavigate}
        streakCount={streakCount}
      />

      <motion.div
        className="min-h-screen flex flex-col"
        animate={{ marginLeft: sidebarWidth }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
      >
        <HeaderBar currentView={currentView} actions={headerActions} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </motion.div>
    </div>
  );
}
