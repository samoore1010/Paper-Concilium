import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Dumbbell,
  Mic,
  Users,
  BarChart3,
  Settings,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import type { AppView } from "./AppShell";

const SIDEBAR_EXPANDED = 240;
const SIDEBAR_COLLAPSED = 64;

export interface NavItem {
  id: AppView;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  section?: "main" | "bottom";
}

const NAV_ITEMS: NavItem[] = [
  { id: "setup", label: "Home", icon: Home },
  { id: "practice-dashboard", label: "Practice", icon: Dumbbell },
  { id: "collection", label: "Collection", icon: Users },
  { id: "progress", label: "Progress", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings, section: "bottom" },
];

interface SidebarProps {
  currentView: AppView;
  collapsed: boolean;
  onToggle: () => void;
  onNavigate: (view: AppView) => void;
  streakCount?: number;
}

export function Sidebar({ currentView, collapsed, onToggle, onNavigate, streakCount }: SidebarProps) {
  const width = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;
  const mainItems = NAV_ITEMS.filter((item) => item.section !== "bottom");
  const bottomItems = NAV_ITEMS.filter((item) => item.section === "bottom");

  // Map some views to their parent nav item for active state
  const activeMap: Record<string, AppView> = {
    "practice-exercise": "practice-dashboard",
    "script-setup": "setup",
    "joining": "setup",
    "meeting": "setup",
    "feedback": "setup",
  };
  const activeId = activeMap[currentView] ?? currentView;

  return (
    <motion.aside
      className="fixed left-0 top-0 h-screen z-40 flex flex-col border-r border-white/5"
      style={{
        background: "rgba(var(--surface-raised), 0.85)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
      animate={{ width }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
    >
      {/* Branding */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-white/5 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
          PP
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              className="text-sm font-semibold text-white whitespace-nowrap overflow-hidden"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.15 }}
            >
              PitchPractice
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Main nav items */}
      <nav className="flex-1 flex flex-col gap-1 px-2 py-3 overflow-y-auto">
        {mainItems.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            active={activeId === item.id}
            collapsed={collapsed}
            onClick={() => onNavigate(item.id)}
          />
        ))}
      </nav>

      {/* Streak badge (when expanded) */}
      <AnimatePresence>
        {!collapsed && streakCount && streakCount > 0 && (
          <motion.div
            className="mx-3 mb-2 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center gap-2"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <span className="text-sm">&#x1F525;</span>
            <span className="text-xs text-orange-300 font-medium">{streakCount} day streak</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom items + collapse toggle */}
      <div className="border-t border-white/5 px-2 py-2 flex flex-col gap-1 shrink-0">
        {bottomItems.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            active={activeId === item.id}
            collapsed={collapsed}
            onClick={() => onNavigate(item.id)}
          />
        ))}
        <button
          onClick={onToggle}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeft size={20} /> : <PanelLeftClose size={20} />}
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                className="text-xs whitespace-nowrap overflow-hidden"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
              >
                Collapse
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  );
}

function NavButton({
  item,
  active,
  collapsed,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;

  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group ${
        active
          ? "bg-violet-500/15 text-white"
          : "text-white/50 hover:text-white/80 hover:bg-white/5"
      }`}
      title={collapsed ? item.label : undefined}
    >
      {active && (
        <motion.div
          layoutId="sidebar-active"
          className="absolute inset-0 rounded-lg bg-violet-500/15 border border-violet-500/20"
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
        />
      )}
      <Icon size={20} className={`shrink-0 relative z-10 ${active ? "text-violet-400" : ""}`} />
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            className={`text-sm whitespace-nowrap overflow-hidden relative z-10 ${active ? "font-medium" : ""}`}
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.15 }}
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
