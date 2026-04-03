import { motion, AnimatePresence } from "framer-motion";
import { Persona, ReactionType } from "../data/personas";
import { MiiAvatar } from "./MiiAvatar";
import { QueuedQuestion } from "./QuestionQueue";
import { CharacterContext } from "../data/themes";

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
  /** Room-adaptive character context */
  characterContext?: CharacterContext;
  /** Whether to play entrance animation (session just started) */
  showEntrance?: boolean;
  /** Reaction intensity 0.3-1.0 from LLM, drives animation amplitude */
  reactionIntensity?: number;
}

export function AudienceTile({ persona, reaction, reactionEmoji, isActive, isMuted = true, isSpeaking, pendingQuestion, onQuestionClick, onClick, themeAccentColor, characterContext, showEntrance, reactionIntensity }: AudienceTileProps) {
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
            <div className="bg-white/95 text-gray-900 rounded-xl px-3 py-2 text-label leading-snug shadow-xl shadow-black/40 border border-white/60 group-hover:bg-white group-hover:shadow-2xl transition-all">
              <p className="line-clamp-4 text-left">"{pendingQuestion.question}"</p>
              <div className="text-caption text-blue-600 mt-1 font-semibold flex items-center gap-1">
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
        {/* Avatar with pseudo-3D depth + room-adaptive entrance */}
        <motion.div
          className="mt-2 flex-1 flex items-end relative"
          initial={showEntrance ? { y: 20, opacity: 0 } : false}
          animate={{ y: 0, opacity: 1 }}
          transition={showEntrance ? { duration: 1.2, ease: "easeOut" } : undefined}
        >
          {/* Seating prop rendered beneath character */}
          {characterContext?.seatingProp && (
            <SeatingProp
              type={characterContext.seatingProp.type}
              color={characterContext.seatingProp.color}
              accentColor={characterContext.seatingProp.accentColor}
            />
          )}
          <MiiAvatar
            persona={persona}
            size={typeof window !== "undefined" && window.innerWidth < 768 ? 70 : 110}
            reaction={displayReaction}
            reactionIntensity={reactionIntensity}
            showReactionEmoji={reactionEmoji}
            themeAccentColor={themeAccentColor}
            enableParallax={true}
            isActiveSpeaker={!!isSpeaking}
          />
        </motion.div>

        {/* Name bar */}
        <div className="w-full flex items-center justify-between px-2 py-1.5 bg-black/40 text-white text-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="truncate font-medium text-label">{persona.name}</span>
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
            <span className="text-caption text-white/40 hidden md:inline">{persona.profession}</span>
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

/** SVG seating props rendered beneath characters to ground them in the room */
function SeatingProp({ type, color, accentColor }: { type: string; color: string; accentColor?: string }) {
  const accent = accentColor || color;

  switch (type) {
    case "statement-chair":
      return (
        <svg className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none" width="90" height="28" viewBox="0 0 90 28">
          {/* Chair back */}
          <rect x="15" y="0" width="60" height="8" rx="3" fill={color} opacity="0.6" />
          {/* Chair arms */}
          <rect x="8" y="4" width="8" height="18" rx="2" fill={color} opacity="0.5" />
          <rect x="74" y="4" width="8" height="18" rx="2" fill={color} opacity="0.5" />
          {/* Golden accent line */}
          <rect x="18" y="2" width="54" height="1.5" rx="0.75" fill={accent} opacity="0.4" />
        </svg>
      );
    case "bench-seat":
      return (
        <svg className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none" width="100" height="24" viewBox="0 0 100 24">
          {/* Bench surface */}
          <rect x="5" y="8" width="90" height="6" rx="2" fill={color} opacity="0.5" />
          {/* Wood grain accent */}
          <rect x="10" y="10" width="80" height="1" rx="0.5" fill={accent} opacity="0.3" />
          {/* Legs */}
          <rect x="12" y="14" width="4" height="10" rx="1" fill={color} opacity="0.4" />
          <rect x="84" y="14" width="4" height="10" rx="1" fill={color} opacity="0.4" />
        </svg>
      );
    case "theater-seat":
      return (
        <svg className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none" width="70" height="22" viewBox="0 0 70 22">
          {/* Seat cushion */}
          <rect x="10" y="8" width="50" height="8" rx="4" fill={color} opacity="0.5" />
          {/* Armrests */}
          <rect x="5" y="4" width="6" height="14" rx="2" fill={color} opacity="0.4" />
          <rect x="59" y="4" width="6" height="14" rx="2" fill={color} opacity="0.4" />
          {/* Accent */}
          <rect x="14" y="10" width="42" height="1" rx="0.5" fill={accent} opacity="0.25" />
        </svg>
      );
    case "desk-edge":
      return (
        <svg className="absolute bottom-5 left-1/2 -translate-x-1/2 pointer-events-none" width="100" height="16" viewBox="0 0 100 16">
          {/* Desk surface */}
          <rect x="0" y="4" width="100" height="6" rx="1" fill={color} opacity="0.6" />
          {/* Accent edge */}
          <rect x="0" y="10" width="100" height="2" rx="0.5" fill={accent} opacity="0.3" />
        </svg>
      );
    default:
      return null;
  }
}
