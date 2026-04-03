import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import { Persona, ReactionType } from "../data/personas";
import { getIdleProfile, FidgetType } from "../data/idleProfiles";

interface MiiAvatarProps {
  persona: Persona;
  size?: number;
  reaction?: ReactionType;
  showReactionEmoji?: string;
  /** Theme accent color for rim lighting (hex) */
  themeAccentColor?: string;
  /** Enable hover parallax effect */
  enableParallax?: boolean;
  /** Whether this avatar is the active speaker */
  isActiveSpeaker?: boolean;
}

/** SVG transform for fidget animations applied to layer groups */
interface FidgetState {
  head: string;
  body: string;
  armLeft: string;
  armRight: string;
  accessory: string;
}

const DEFAULT_FIDGET: FidgetState = {
  head: "",
  body: "",
  armLeft: "",
  armRight: "",
  accessory: "",
};

export function MiiAvatar({
  persona,
  size = 120,
  reaction = "neutral",
  showReactionEmoji,
  themeAccentColor = "#6366f1",
  enableParallax = false,
  isActiveSpeaker = false,
}: MiiAvatarProps) {
  const [eyeOffset, setEyeOffset] = useState(0);
  const [fidgetState, setFidgetState] = useState<FidgetState>(DEFAULT_FIDGET);
  const [activeFidget, setActiveFidget] = useState<FidgetType | null>(null);
  const fidgetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animOverrideRef = useRef<HTMLDivElement>(null);

  // Derive reaction visuals from props (no setState needed)
  const REACTION_MAP: Record<ReactionType, { animClass: string; bodyAnimClass: string; mouthShape: "neutral" | "smile" | "frown" | "open" }> = {
    nod: { animClass: "animate-nod", bodyAnimClass: "animate-lean-forward", mouthShape: "smile" },
    smile: { animClass: "", bodyAnimClass: "", mouthShape: "smile" },
    shake: { animClass: "animate-shake-head", bodyAnimClass: "", mouthShape: "frown" },
    frown: { animClass: "", bodyAnimClass: "", mouthShape: "frown" },
    think: { animClass: "", bodyAnimClass: "animate-lean-back", mouthShape: "neutral" },
    "raised-hand": { animClass: "", bodyAnimClass: "", mouthShape: "open" },
    speaking: { animClass: "", bodyAnimClass: "animate-lean-forward", mouthShape: "open" },
    neutral: { animClass: "", bodyAnimClass: "", mouthShape: "neutral" },
  };
  const reactionVisuals = REACTION_MAP[reaction] || REACTION_MAP.neutral;

  const bodyAnimClass = reactionVisuals.bodyAnimClass;
  const mouthShape = reactionVisuals.mouthShape;

  // Idle profile based on persona personality
  const idleProfile = useMemo(() => getIdleProfile(persona), [persona]);

  // Parallax motion values
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Spring-smoothed parallax offsets for different depth layers
  const springConfig = { stiffness: 150, damping: 20 };
  const layerBackX = useSpring(useTransform(mouseX, [-1, 1], [3, -3]), springConfig);
  const layerBackY = useSpring(useTransform(mouseY, [-1, 1], [2, -2]), springConfig);
  const layerMidX = useSpring(useTransform(mouseX, [-1, 1], [1, -1]), springConfig);
  const layerMidY = useSpring(useTransform(mouseY, [-1, 1], [0.5, -0.5]), springConfig);
  const layerFrontX = useSpring(useTransform(mouseX, [-1, 1], [-2, 2]), springConfig);
  const layerFrontY = useSpring(useTransform(mouseY, [-1, 1], [-1.5, 1.5]), springConfig);

  // Handle mouse movement for parallax
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!enableParallax || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      mouseX.set(x);
      mouseY.set(y);
    },
    [enableParallax, mouseX, mouseY]
  );

  const handleMouseLeave = useCallback(() => {
    mouseX.set(0);
    mouseY.set(0);
  }, [mouseX, mouseY]);

  // Eye tracking with persona-specific restlessness
  useEffect(() => {
    const interval = Math.max(1500, 3000 / idleProfile.eyeRestlessness);
    const eyeInterval = setInterval(() => {
      const range = 4 * idleProfile.eyeRestlessness;
      setEyeOffset((Math.random() - 0.5) * range);
    }, interval);
    return () => clearInterval(eyeInterval);
  }, [idleProfile.eyeRestlessness]);

  // Clear one-shot animation class (nod, shake) after it plays via DOM
  useEffect(() => {
    const el = animOverrideRef.current;
    if (!el || !reactionVisuals.animClass) return;
    // Re-trigger CSS animation by removing/re-adding class
    el.classList.remove(reactionVisuals.animClass);
    void el.offsetWidth; // force reflow
    el.classList.add(reactionVisuals.animClass);
    const timer = setTimeout(() => el.classList.remove(reactionVisuals.animClass), 1000);
    return () => clearTimeout(timer);
  }, [reaction, reactionVisuals.animClass]);

  // Fidget animation system — randomized per-character idle fidgets
  const playFidget = useCallback(() => {
    // Don't fidget during active reactions
    if (reaction !== "neutral" && reaction !== "think") return;

    const { fidgets } = idleProfile;
    if (fidgets.length === 0) return;

    const fidget = fidgets[Math.floor(Math.random() * fidgets.length)];
    setActiveFidget(fidget.type);

    // Apply SVG transforms based on fidget type
    const transforms = { ...DEFAULT_FIDGET };
    switch (fidget.type) {
      case "head-tilt-left":
        transforms.head = "rotate(-5)";
        break;
      case "head-tilt-right":
        transforms.head = "rotate(5)";
        break;
      case "chin-raise":
        transforms.head = "translate(0, -2)";
        break;
      case "look-around":
        transforms.head = "translate(2, 0)";
        break;
      case "finger-drum":
        transforms.armRight = "translate(0, -1)";
        break;
      case "pen-tap":
        transforms.armRight = "translate(0, -2) rotate(-5)";
        break;
      case "glasses-adjust":
      case "glasses-push":
        transforms.armRight = "translate(-4, -8) rotate(-15)";
        break;
      case "phone-check":
        transforms.armRight = "translate(-2, -6) rotate(-10)";
        break;
      case "note-writing":
        transforms.armRight = "translate(-1, -3) rotate(-8)";
        break;
      case "arm-cross":
        transforms.armLeft = "rotate(-20) translate(4, 4)";
        transforms.armRight = "rotate(20) translate(-4, 4)";
        break;
      case "arm-uncross":
        transforms.armLeft = "";
        transforms.armRight = "";
        break;
      case "weight-shift":
        transforms.body = "translate(2, 0)";
        break;
      case "lean-forward":
        transforms.body = "translate(0, 1) rotate(1)";
        break;
      case "lean-back":
        transforms.body = "translate(0, -1) rotate(-1)";
        break;
      case "shoulder-roll":
        transforms.body = "translate(0, -1)";
        break;
      case "posture-straighten":
        transforms.body = "translate(0, -1.5)";
        break;
      case "hat-adjust":
        transforms.accessory = "translate(0, -2)";
        break;
      case "bowtie-touch":
        transforms.accessory = "translate(0, -1)";
        transforms.armRight = "translate(-2, -4)";
        break;
    }

    setFidgetState(transforms);

    // Reset fidget after animation duration
    setTimeout(() => {
      setFidgetState(DEFAULT_FIDGET);
      setActiveFidget(null);
    }, fidget.duration * 1000);
  }, [reaction, idleProfile]);

  // Schedule fidgets at random intervals
  useEffect(() => {
    const scheduleFidget = () => {
      const { fidgetIntervalMin, fidgetIntervalMax } = idleProfile;
      const delay =
        (fidgetIntervalMin + Math.random() * (fidgetIntervalMax - fidgetIntervalMin)) * 1000;
      fidgetTimerRef.current = setTimeout(() => {
        playFidget();
        scheduleFidget();
      }, delay);
    };

    scheduleFidget();
    return () => {
      if (fidgetTimerRef.current) clearTimeout(fidgetTimerRef.current);
    };
  }, [playFidget, idleProfile]);

  // Dimensions
  const s = size;
  const cx = s / 2;
  const headR = s * 0.32;
  const eyeY = s * 0.38;
  const eyeSpacing = s * 0.1;
  const mouthY = s * 0.52;
  const bodyY = s * 0.68;

  // Dynamic breathing style using persona-specific profile
  const breatheStyle: React.CSSProperties = {
    animation: `subtle-breathe ${idleProfile.breatheDuration}s ease-in-out infinite`,
    transformOrigin: "center bottom",
  };

  // Override breathing during reactions
  const getBreathStyle = (): React.CSSProperties => {
    if (reaction === "nod" || reaction === "smile" || reaction === "speaking") {
      return { animation: `subtle-breathe 2.5s ease-in-out infinite`, transformOrigin: "center bottom" };
    }
    if (reaction === "shake" || reaction === "frown") {
      return { animation: `subtle-breathe 6s ease-in-out infinite`, transformOrigin: "center bottom" };
    }
    return breatheStyle;
  };

  // Fidget transition style for smooth SVG transforms
  const fidgetTransition = activeFidget
    ? "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)"
    : "transform 0.5s ease-out";

  const renderHair = () => {
    const hairProps = { fill: persona.hairColor };
    switch (persona.hairStyle) {
      case "long":
        return (
          <>
            <ellipse cx={cx} cy={s * 0.28} rx={headR + 4} ry={headR + 2} {...hairProps} />
            <rect x={cx - headR - 3} y={s * 0.28} width={8} height={s * 0.28} rx={4} {...hairProps} />
            <rect x={cx + headR - 5} y={s * 0.28} width={8} height={s * 0.28} rx={4} {...hairProps} />
          </>
        );
      case "curly":
        return (
          <>
            <ellipse cx={cx} cy={s * 0.25} rx={headR + 6} ry={headR + 4} {...hairProps} />
            <circle cx={cx - headR} cy={s * 0.22} r={6} {...hairProps} />
            <circle cx={cx + headR} cy={s * 0.22} r={6} {...hairProps} />
            <circle cx={cx - headR + 8} cy={s * 0.16} r={5} {...hairProps} />
            <circle cx={cx + headR - 8} cy={s * 0.16} r={5} {...hairProps} />
          </>
        );
      case "bob":
        return (
          <>
            <ellipse cx={cx} cy={s * 0.27} rx={headR + 5} ry={headR + 1} {...hairProps} />
            <rect x={cx - headR - 4} y={s * 0.27} width={headR * 2 + 8} height={s * 0.15} rx={6} {...hairProps} />
          </>
        );
      case "bald":
        return null;
      case "ponytail":
        return (
          <>
            <ellipse cx={cx} cy={s * 0.27} rx={headR + 3} ry={headR + 1} {...hairProps} />
            <ellipse cx={cx + headR + 6} cy={s * 0.2} rx={5} ry={10} {...hairProps} />
          </>
        );
      case "short":
      default:
        return <ellipse cx={cx} cy={s * 0.27} rx={headR + 3} ry={headR} {...hairProps} />;
    }
  };

  const renderAccessory = () => {
    switch (persona.accessory) {
      case "glasses":
        return (
          <g
            stroke="#333"
            strokeWidth={1.5}
            fill="none"
            style={{ transition: fidgetTransition }}
            transform={fidgetState.accessory}
          >
            <circle cx={cx - eyeSpacing} cy={eyeY} r={7} />
            <circle cx={cx + eyeSpacing} cy={eyeY} r={7} />
            <line x1={cx - eyeSpacing + 7} y1={eyeY} x2={cx + eyeSpacing - 7} y2={eyeY} />
            <line x1={cx - eyeSpacing - 7} y1={eyeY} x2={cx - eyeSpacing - 12} y2={eyeY - 3} />
            <line x1={cx + eyeSpacing + 7} y1={eyeY} x2={cx + eyeSpacing + 12} y2={eyeY - 3} />
          </g>
        );
      case "earrings":
        return (
          <>
            <circle cx={cx - headR - 2} cy={s * 0.42} r={3} fill="#ffd700" />
            <circle cx={cx + headR + 2} cy={s * 0.42} r={3} fill="#ffd700" />
          </>
        );
      case "hat":
        return (
          <g
            style={{ transition: fidgetTransition }}
            transform={fidgetState.accessory}
          >
            <rect x={cx - headR - 6} y={s * 0.15} width={headR * 2 + 12} height={8} rx={2} fill="#4a3728" />
            <rect x={cx - headR + 4} y={s * 0.08} width={headR * 2 - 8} height={12} rx={4} fill="#5c4033" />
          </g>
        );
      case "bowtie":
        return (
          <g
            fill="#c0392b"
            style={{ transition: fidgetTransition }}
            transform={fidgetState.accessory}
          >
            <polygon points={`${cx - 8},${bodyY - 2} ${cx},${bodyY + 2} ${cx - 8},${bodyY + 6}`} />
            <polygon points={`${cx + 8},${bodyY - 2} ${cx},${bodyY + 2} ${cx + 8},${bodyY + 6}`} />
            <circle cx={cx} cy={bodyY + 2} r={2} fill="#a0302a" />
          </g>
        );
      case "headscarf":
        return (
          <ellipse cx={cx} cy={s * 0.24} rx={headR + 8} ry={headR + 4} fill="#7c3aed" opacity={0.7} />
        );
      default:
        return null;
    }
  };

  const renderMouth = () => {
    if (reaction === "speaking") {
      return (
        <g className="animate-speaking-mouth" style={{ transformOrigin: `${cx}px ${mouthY + 2}px` }}>
          <ellipse cx={cx} cy={mouthY + 2} rx={5} ry={4} fill="#333" />
        </g>
      );
    }
    switch (mouthShape) {
      case "smile":
        return <path d={`M${cx - 8},${mouthY} Q${cx},${mouthY + 8} ${cx + 8},${mouthY}`} stroke="#333" strokeWidth={2} fill="none" />;
      case "frown":
        return <path d={`M${cx - 8},${mouthY + 4} Q${cx},${mouthY - 4} ${cx + 8},${mouthY + 4}`} stroke="#333" strokeWidth={2} fill="none" />;
      case "open":
        return <ellipse cx={cx} cy={mouthY + 2} rx={5} ry={4} fill="#333" />;
      default:
        return <line x1={cx - 7} y1={mouthY + 1} x2={cx + 7} y2={mouthY + 1} stroke="#333" strokeWidth={2} strokeLinecap="round" />;
    }
  };

  const renderArms = () => {
    const armBaseY = bodyY + s * 0.08;
    const armColor = persona.skinTone;

    const leftArmTransform = fidgetState.armLeft;
    const rightArmTransform = fidgetState.armRight;

    switch (reaction) {
      case "raised-hand":
      case "speaking":
        return (
          <>
            <ellipse cx={cx - s * 0.22} cy={armBaseY} rx={4} ry={s * 0.12} fill={armColor} />
            <ellipse cx={cx + s * 0.22} cy={armBaseY - s * 0.2} rx={4} ry={s * 0.15} fill={armColor} transform={`rotate(-45 ${cx + s * 0.22} ${armBaseY})`} />
          </>
        );
      case "shake":
      case "frown":
        return (
          <>
            <ellipse cx={cx - s * 0.15} cy={armBaseY + s * 0.08} rx={4} ry={s * 0.1} fill={armColor} transform={`rotate(-20 ${cx - s * 0.15} ${armBaseY})`} />
            <ellipse cx={cx + s * 0.15} cy={armBaseY + s * 0.08} rx={4} ry={s * 0.1} fill={armColor} transform={`rotate(20 ${cx + s * 0.15} ${armBaseY})`} />
          </>
        );
      default:
        return (
          <>
            <g style={{ transition: fidgetTransition, transformOrigin: `${cx - s * 0.22}px ${armBaseY - s * 0.05}px` }} transform={leftArmTransform}>
              <ellipse cx={cx - s * 0.22} cy={armBaseY} rx={4} ry={s * 0.12} fill={armColor} />
            </g>
            <g style={{ transition: fidgetTransition, transformOrigin: `${cx + s * 0.22}px ${armBaseY - s * 0.05}px` }} transform={rightArmTransform}>
              <ellipse cx={cx + s * 0.22} cy={armBaseY} rx={4} ry={s * 0.12} fill={armColor} />
            </g>
          </>
        );
    }
  };

  // Dynamic drop shadow that responds to reactions
  const getShadowOpacity = () => {
    if (reaction === "nod" || reaction === "speaking") return 0.4;
    if (reaction === "think") return 0.2;
    return 0.3;
  };

  const getShadowScale = () => {
    if (reaction === "nod" || reaction === "speaking") return "scale(1.1, 0.15)";
    if (reaction === "think") return "scale(0.9, 0.12)";
    return "scale(1, 0.13)";
  };

  return (
    <div
      ref={(el) => {
        containerRef.current = el;
        animOverrideRef.current = el;
      }}
      className="relative"
      style={{ width: s, height: s }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Pseudo-3D container with perspective */}
      <div
        style={{
          width: s,
          height: s,
          perspective: s * 3,
          transformStyle: "preserve-3d",
        }}
      >
        {/* Dynamic drop shadow */}
        <div
          style={{
            position: "absolute",
            bottom: 2,
            left: "50%",
            width: s * 0.6,
            height: s * 0.1,
            marginLeft: -(s * 0.3),
            background: `radial-gradient(ellipse, rgba(0,0,0,${getShadowOpacity()}) 0%, transparent 70%)`,
            transform: getShadowScale(),
            transition: "transform 0.4s ease, opacity 0.4s ease",
            pointerEvents: "none",
          }}
        />

        {/* Rim lighting glow */}
        <div
          style={{
            position: "absolute",
            inset: -2,
            borderRadius: "50%",
            background: `radial-gradient(ellipse at 30% 20%, ${themeAccentColor}18 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, ${themeAccentColor}10 0%, transparent 50%)`,
            pointerEvents: "none",
            opacity: isActiveSpeaker ? 0.9 : 0.5,
            transition: "opacity 0.3s ease",
          }}
        />

        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
          {/* Rim light SVG filter */}
          <defs>
            <filter id={`rim-${persona.id}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur" />
              <feFlood floodColor={themeAccentColor} floodOpacity="0.15" result="color" />
              <feComposite in="color" in2="blur" operator="in" result="rimGlow" />
              <feMerge>
                <feMergeNode in="rimGlow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* ===== LAYER 1 (BACK): Body + Back Arms ===== */}
          <motion.g
            className={bodyAnimClass}
            style={{
              x: enableParallax ? layerBackX : 0,
              y: enableParallax ? layerBackY : 0,
              ...getBreathStyle(),
            }}
          >
            <g
              style={{ transition: fidgetTransition, transformOrigin: `${cx}px ${bodyY}px` }}
              transform={fidgetState.body}
            >
              {/* Body */}
              <ellipse cx={cx} cy={bodyY + s * 0.18} rx={s * 0.3} ry={s * 0.22} fill={persona.shirtColor} />
              {/* Neck */}
              <rect x={cx - 6} y={s * 0.58} width={12} height={12} fill={persona.skinTone} />
              {/* Back arm (left) — rendered behind body for depth */}
              {renderArms()}
            </g>
          </motion.g>

          {/* ===== LAYER 2 (MID): Head + Face ===== */}
          <motion.g
            filter={`url(#rim-${persona.id})`}
            style={{
              x: enableParallax ? layerMidX : 0,
              y: enableParallax ? layerMidY : 0,
            }}
          >
            <g
              style={{ transition: fidgetTransition, transformOrigin: `${cx}px ${s * 0.36}px` }}
              transform={fidgetState.head}
            >
              {/* Hair behind */}
              {renderHair()}

              {/* Head */}
              <ellipse cx={cx} cy={s * 0.36} rx={headR} ry={headR + 2} fill={persona.skinTone} />

              {/* Eyes with tracking */}
              <g className="animate-eye-blink" style={{ transformOrigin: `${cx}px ${eyeY}px` }}>
                <ellipse cx={cx - eyeSpacing + eyeOffset} cy={eyeY} rx={3.5} ry={4} fill="#333" />
                <ellipse cx={cx + eyeSpacing + eyeOffset} cy={eyeY} rx={3.5} ry={4} fill="#333" />
                <ellipse cx={cx - eyeSpacing + eyeOffset + 1} cy={eyeY - 1} rx={1.5} ry={1.5} fill="#fff" />
                <ellipse cx={cx + eyeSpacing + eyeOffset + 1} cy={eyeY - 1} rx={1.5} ry={1.5} fill="#fff" />
              </g>

              {/* Eyebrows */}
              <line
                x1={cx - eyeSpacing - 5}
                y1={eyeY - 8}
                x2={cx - eyeSpacing + 5}
                y2={eyeY - (reaction === "frown" || reaction === "shake" ? 6 : 9)}
                stroke="#333"
                strokeWidth={2}
                strokeLinecap="round"
              />
              <line
                x1={cx + eyeSpacing - 5}
                y1={eyeY - (reaction === "frown" || reaction === "shake" ? 6 : 9)}
                x2={cx + eyeSpacing + 5}
                y2={eyeY - 8}
                stroke="#333"
                strokeWidth={2}
                strokeLinecap="round"
              />

              {/* Nose */}
              <path d={`M${cx},${s * 0.42} Q${cx + 3},${s * 0.47} ${cx},${s * 0.47}`} stroke="#c9a080" strokeWidth={1.5} fill="none" />

              {/* Mouth */}
              {renderMouth()}
            </g>
          </motion.g>

          {/* ===== LAYER 3 (FRONT): Accessories ===== */}
          <motion.g
            style={{
              x: enableParallax ? layerFrontX : 0,
              y: enableParallax ? layerFrontY : 0,
            }}
          >
            {renderAccessory()}
          </motion.g>
        </svg>
      </div>

      {/* Reaction emoji floating up */}
      {showReactionEmoji && (
        <div className="absolute -top-2 right-0 text-xl animate-float-up pointer-events-none">
          {showReactionEmoji}
        </div>
      )}
    </div>
  );
}
