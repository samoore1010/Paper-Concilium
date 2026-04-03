import { motion, AnimatePresence } from "framer-motion";
import { Persona, ReactionType } from "../data/personas";
import { MiiAvatar } from "./MiiAvatar";
import { QueuedQuestion } from "./QuestionQueue";

interface AudienceTileProps {
  persona: Persona;
  reaction: ReactionType;
  reactionEmoji?: string;
  isActive?: boolean;
  isMuted?: boolean;
  isSpeaking?: boolean;
  pendingQuestion?: QueuedQuestion;
  onQuestionClick?: (question: QueuedQuestion) => void;
  onClick?: () => void;
  /** Theme accent color for avatar rim lighting */
  themeAccentColor?: string;
}

export function AudienceTile({ persona, reaction, reactionEmoji, isActive, isMuted = true, isSpeaking, pendingQuestion, onQuestionClick, onClick, themeAccentColor }: AudienceTileProps) {
  const getReactionGlowClass = () => {
    if (isSpeaking) return "reaction-glow-speaking";
    if (reaction === "nod" || reaction === "smile") return "reaction-glow-positive";
    if (reaction === "think") return "reaction-glow-thinking";
    if (reaction === "shake" || reaction === "frown") return "reaction-glow-negative";
    return "";
  };

  const displayReaction = isSpeaking ? "speaking" as ReactionType : reaction;

  return (
    <div className="relative h-full" style={{ perspective: 600 }}>
      {/* Question bubble floating above tile */}
      <AnimatePresence>
        {pendingQuestion && !isSpeaking && (
          <motion.button
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            onClick={(e) => {
              e.stopPropagation();
              onQuestionClick?.(pendingQuestion);
            }}
            className="absolute -top-1 left-1/2 -translate-x-1/2 z-20 w-[85%] max-w-[240px] cursor-pointer group"
          >
            <div className="bg-white/95 text-gray-900 rounded-xl px-3 py-2 text-[11px] leading-snug shadow-xl shadow-black/40 border border-white/60 group-hover:bg-white group-hover:shadow-2xl transition-all">
              <p className="line-clamp-4 text-left">"{pendingQuestion.question}"</p>
              <div className="text-[9px] text-blue-600 mt-1 font-semibold flex items-center gap-1">
                <span>🔊</span> Tap to hear
              </div>
            </div>
            {/* Speech bubble triangle */}
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white/95 rotate-45 border-r border-b border-white/60" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Tile */}
      <div
        onClick={onClick}
        className={`relative flex flex-col items-center justify-end overflow-hidden cursor-pointer transition-all duration-200 frosted-glass h-full
          ${isActive ? "ring-2 ring-blue-400" : "ring-1 ring-white/10"}
          ${getReactionGlowClass()}
          bg-gradient-to-b from-[#2a2a4a]/60 to-[#1a1a2e]/60 hover:from-[#32325a]/70 hover:to-[#22223a]/70`}
        style={{ borderRadius: 8, minHeight: 80 }}
      >
        {/* Avatar with pseudo-3D depth */}
        <div className="mt-2 flex-1 flex items-end">
          <MiiAvatar
            persona={persona}
            size={typeof window !== "undefined" && window.innerWidth < 768 ? 70 : 110}
            reaction={displayReaction}
            showReactionEmoji={reactionEmoji}
            themeAccentColor={themeAccentColor}
            enableParallax={true}
            isActiveSpeaker={!!isSpeaking}
          />
        </div>

        {/* Name bar */}
        <div className="w-full flex items-center justify-between px-2 py-1.5 bg-black/40 text-white text-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="truncate font-medium text-[11px]">{persona.name}</span>
            {isSpeaking && (
              <div className="flex gap-0.5 items-end h-3 flex-shrink-0">
                <span className="w-0.5 bg-cyan-400 rounded-full animate-sound-bar-1" style={{ height: "40%" }} />
                <span className="w-0.5 bg-cyan-400 rounded-full animate-sound-bar-2" style={{ height: "70%" }} />
                <span className="w-0.5 bg-cyan-400 rounded-full animate-sound-bar-3" style={{ height: "50%" }} />
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {isMuted && !isSpeaking && (
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                <path d="M8 1a3 3 0 00-3 3v4a3 3 0 006 0V4a3 3 0 00-3-3z" fill="#ef4444" />
                <line x1="2" y1="2" x2="14" y2="14" stroke="#ef4444" strokeWidth="2" />
              </svg>
            )}
            <span className="text-[9px] text-white/40 hidden md:inline">{persona.profession}</span>
          </div>
        </div>

        {/* Thinking indicator */}
        {reaction === "think" && !isSpeaking && (
          <div className="absolute top-2 left-2 flex gap-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-white/60 typing-dot-1" />
            <div className="w-1.5 h-1.5 rounded-full bg-white/60 typing-dot-2" />
            <div className="w-1.5 h-1.5 rounded-full bg-white/60 typing-dot-3" />
          </div>
        )}

        {/* Hand raise indicator (when question is pending) */}
        {pendingQuestion && (
          <div className="absolute top-2 right-2">
            <span className="text-sm animate-bounce">✋</span>
          </div>
        )}
      </div>
    </div>
  );
}
