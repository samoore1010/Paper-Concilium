import { motion } from "framer-motion";

interface LandingPageProps {
  onSelectMode: (mode: "perform" | "practice") => void;
}

export function LandingPage({ onSelectMode }: LandingPageProps) {
  return (
    <div className="min-h-[100dvh] bg-surface-base text-white flex flex-col">
      {/* Header */}
      <header className="px-6 py-6 text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center font-bold text-sm">PP</div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">PitchPractice</h1>
        </div>
        <p className="text-sm text-white/40">AI-Powered Presentation Training</p>
      </header>

      {/* Mode Selection */}
      <div className="flex-1 flex items-center justify-center px-4 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 max-w-3xl w-full">
          {/* Practice Mode */}
          <motion.button
            onClick={() => onSelectMode("practice")}
            className="group relative overflow-hidden rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-900/30 to-indigo-900/20 p-6 md:p-8 text-left transition-all hover:border-purple-400/50 hover:shadow-lg hover:shadow-purple-500/10"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="text-4xl mb-4">🎯</div>
            <h2 className="text-xl md:text-2xl font-bold mb-2">Practice</h2>
            <p className="text-sm text-white/50 leading-relaxed mb-4">
              Guided exercises to improve your speaking skills. Read scripts, get scored on delivery, earn XP, and level up.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="text-caption px-2 py-1 rounded-full bg-purple-500/20 text-purple-300">Guided Scripts</span>
              <span className="text-caption px-2 py-1 rounded-full bg-purple-500/20 text-purple-300">Delivery Scoring</span>
              <span className="text-caption px-2 py-1 rounded-full bg-purple-500/20 text-purple-300">XP & Levels</span>
            </div>
            <div className="absolute top-4 right-4 text-xs text-purple-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              Start Training →
            </div>
          </motion.button>

          {/* Perform Mode */}
          <motion.button
            onClick={() => onSelectMode("perform")}
            className="group relative overflow-hidden rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-900/30 to-cyan-900/20 p-6 md:p-8 text-left transition-all hover:border-blue-400/50 hover:shadow-lg hover:shadow-blue-500/10"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="text-4xl mb-4">🎤</div>
            <h2 className="text-xl md:text-2xl font-bold mb-2">Perform</h2>
            <p className="text-sm text-white/50 leading-relaxed mb-4">
              Present your own content to an AI audience. Get persona-driven feedback on your pitch, speech, or argument.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="text-caption px-2 py-1 rounded-full bg-blue-500/20 text-blue-300">AI Audience</span>
              <span className="text-caption px-2 py-1 rounded-full bg-blue-500/20 text-blue-300">Live Reactions</span>
              <span className="text-caption px-2 py-1 rounded-full bg-blue-500/20 text-blue-300">Detailed Feedback</span>
            </div>
            <div className="absolute top-4 right-4 text-xs text-blue-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              Start Presenting →
            </div>
          </motion.button>
        </div>
      </div>
    </div>
  );
}
