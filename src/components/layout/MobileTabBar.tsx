import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Dumbbell,
  Users,
  MoreHorizontal,
  BarChart3,
  Settings,
  X,
} from "lucide-react";
import type { AppView } from "./AppShell";

interface MobileTabBarProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
}

interface TabItem {
  id: AppView | "more";
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const TABS: TabItem[] = [
  { id: "setup", label: "Home", icon: Home },
  { id: "practice-dashboard", label: "Practice", icon: Dumbbell },
  { id: "collection", label: "Collection", icon: Users },
  { id: "more", label: "More", icon: MoreHorizontal },
];

interface MoreItem {
  id: AppView;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const MORE_ITEMS: MoreItem[] = [
  { id: "progress", label: "Progress", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

/** Map child views to their parent tab for active state */
const ACTIVE_MAP: Record<string, AppView | "more"> = {
  "practice-exercise": "practice-dashboard",
  "script-setup": "setup",
  "joining": "setup",
  "meeting": "setup",
  "feedback": "setup",
  "progress": "more",
  "settings": "more",
};

export function MobileTabBar({ currentView, onNavigate }: MobileTabBarProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  const activeTab = ACTIVE_MAP[currentView] ?? currentView;

  const handleTabPress = (tab: TabItem) => {
    if (tab.id === "more") {
      setMoreOpen((prev) => !prev);
    } else {
      setMoreOpen(false);
      onNavigate(tab.id as AppView);
    }
  };

  const handleMoreItemPress = (item: MoreItem) => {
    setMoreOpen(false);
    onNavigate(item.id);
  };

  return (
    <>
      {/* Backdrop for More sheet */}
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setMoreOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* More bottom sheet */}
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            className="fixed left-0 right-0 z-50 md:hidden rounded-t-2xl border-t border-white/10"
            style={{
              bottom: "calc(56px + env(safe-area-inset-bottom, 0px))",
              background: "rgba(var(--surface-raised), 0.95)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
          >
            <div className="px-4 pt-3 pb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-white/40 uppercase tracking-wider">More</span>
              <button
                onClick={() => setMoreOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
              >
                <X size={16} className="text-white/40" />
              </button>
            </div>
            <nav className="px-2 pb-3 flex flex-col gap-1">
              {MORE_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleMoreItemPress(item)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors min-h-[48px] ${
                      active
                        ? "bg-violet-500/15 text-white"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <Icon size={20} className={active ? "text-violet-400" : ""} />
                    <span className={`text-sm ${active ? "font-medium" : ""}`}>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-white/10"
        style={{
          height: "calc(56px + env(safe-area-inset-bottom, 0px))",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          background: "rgba(var(--surface-raised), 0.85)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        <div className="flex items-stretch h-[56px]">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === "more"
              ? moreOpen || activeTab === "more"
              : activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => handleTabPress(tab)}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 relative min-w-[48px] min-h-[48px]"
              >
                {isActive && (
                  <motion.div
                    layoutId="mobile-tab-active"
                    className="absolute top-1 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-violet-400"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <Icon
                  size={22}
                  className={`transition-colors ${
                    isActive ? "text-violet-400" : "text-white/40"
                  }`}
                />
                <span
                  className={`text-[10px] leading-tight transition-colors ${
                    isActive ? "text-violet-400 font-medium" : "text-white/40"
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
