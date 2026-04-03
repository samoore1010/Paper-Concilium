import type { ReactNode } from "react";
import type { AppView } from "./AppShell";

const VIEW_TITLES: Record<string, string> = {
  setup: "Home",
  "practice-dashboard": "Practice",
  "practice-exercise": "Practice",
  "script-setup": "Script Setup",
  joining: "Joining Session...",
  meeting: "Live Session",
  feedback: "Session Feedback",
  collection: "Collection",
  progress: "Progress",
  settings: "Settings",
};

const VIEW_BREADCRUMBS: Record<string, string[]> = {
  "practice-exercise": ["Practice", "Exercise"],
  "script-setup": ["Home", "Script Setup"],
  feedback: ["Home", "Session Feedback"],
};

interface HeaderBarProps {
  currentView: AppView;
  actions?: ReactNode;
}

export function HeaderBar({ currentView, actions }: HeaderBarProps) {
  const title = VIEW_TITLES[currentView] ?? "PitchPractice";
  const breadcrumbs = VIEW_BREADCRUMBS[currentView];

  return (
    <header className="h-14 border-b border-white/5 px-6 flex items-center justify-between shrink-0 bg-surface-base/80 backdrop-blur-md sticky top-0 z-30">
      <div className="flex items-center gap-2">
        {breadcrumbs ? (
          <div className="flex items-center gap-1.5 text-sm">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-white/20">/</span>}
                <span className={i === breadcrumbs.length - 1 ? "text-white font-medium" : "text-white/40"}>
                  {crumb}
                </span>
              </span>
            ))}
          </div>
        ) : (
          <h1 className="text-sm font-medium text-white">{title}</h1>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
