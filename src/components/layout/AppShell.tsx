import { useState, useEffect, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Sidebar } from "./Sidebar";
import { HeaderBar } from "./HeaderBar";

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

/** Views where the sidebar is hidden for full-screen immersion */
const IMMERSIVE_VIEWS: AppView[] = ["meeting", "joining"];

interface AppShellProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  headerActions?: ReactNode;
  children: ReactNode;
  streakCount?: number;
}

export function AppShell({ currentView, onNavigate, headerActions, children, streakCount }: AppShellProps) {
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

  // Keyboard shortcut: Ctrl+B to toggle sidebar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Immersive mode: no shell, just content
  if (isImmersive) {
    return <>{children}</>;
  }

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
