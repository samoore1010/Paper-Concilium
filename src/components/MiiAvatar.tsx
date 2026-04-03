import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import { Persona, ReactionType } from "../data/personas";
import { getIdleProfile, FidgetType } from "../data/idleProfiles";

interface MiiAvatarProps {
  persona: Persona;
  size?: number;
  reaction?: ReactionType;
  /** Reaction intensity 0.3-1.0. Drives animation amplitude. */
  reactionIntensity?: number;
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

/**
 * Reaction transform targets — defines the physical motion for each reaction type.
 * Values are at intensity=1.0 and get scaled by actual intensity.
 */
interface ReactionTransforms {
  headRotate: number;    // degrees
  headY: number;         // px offset
  headX: number;         // px offset
  bodyRotate: number;    // degrees
  bodyY: number;         // px offset
  shoulderY: number;     // px offset for body follow-through
  mouthShape: "neutral" | "smile" | "frown" | "open";
}

const REACTION_TRANSFORMS: Record<ReactionType, ReactionTransforms> = {
  nod:          { headRotate: -8,  headY: 3,  headX: 0,  bodyRotate: 2,   bodyY: 1,   shoulderY: 1,   mouthShape: "smile" },
  smile:        { headRotate: -3,  headY: 0,  headX: 0,  bodyRotate: 0,   bodyY: 0,   shoulderY: 0,   mouthShape: "smile" },
  shake:        { headRotate: 6,   headY: 0,  headX: 4,  bodyRotate: -1,  bodyY: 0,   shoulderY: 0.5, mouthShape: "frown" },
  frown:        { headRotate: 2,   headY: 1,  headX: 0,  bodyRotate: -1,  bodyY: -0.5, shoulderY: 0,  mouthShape: "frown" },
  think:        { headRotate: 5,   headY: -2, headX: 1,  bodyRotate: -2,  bodyY: -1,  shoulderY: -0.5, mouthShape: "neutral" },
  "raised-hand": { headRotate: 0, headY: 0,  headX: 0,  bodyRotate: 0,   bodyY: 0,   shoulderY: 0,   mouthShape: "open" },
  speaking:     { headRotate: -2,  headY: 1,  headX: 0,  bodyRotate: 3,   bodyY: 1.5, shoulderY: 1,   mouthShape: "open" },
  neutral:      { headRotate: 0,   headY: 0,  headX: 0,  bodyRotate: 0,   bodyY: 0,   shoulderY: 0,   mouthShape: "neutral" },
};

export function MiiAvatar({
  persona,
  size = 120,
  reaction = "neutral",
  reactionIntensity = 0.6,
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
  const prevReactionRef = useRef<ReactionType>("neutral");
  const secondaryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accessoryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settlingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Idle profile with spring physics
  const idleProfile = useMemo(() => getIdleProfile(persona), [persona]);
  const springCfg = idleProfile.reactionSpring;

  // Clamp intensity
  const intensity = Math.max(0.3, Math.min(1.0, reactionIntensity));

  // Get reaction transform targets scaled by intensity
  const reactionTarget = REACTION_TRANSFORMS[reaction] || REACTION_TRANSFORMS.neutral;
  const mouthShape = reactionTarget.mouthShape;

  // === SPRING-DRIVEN MOTION VALUES ===
  // Primary head motion
  const headRotateTarget = useMotionValue(0);
  const headYTarget = useMotionValue(0);
  const headXTarget = useMotionValue(0);

  // Secondary body motion (follows head with delay)
  const bodyRotSpring = useMotionValue(0);
  const bodyYSpring = useMotionValue(0);

  // Accessory physics (follows head with more delay + higher spring)
  const accessoryRotateTarget = useMotionValue(0);
  const accessoryYTarget = useMotionValue(0);

  // Build per-character spring configs from idle profile
  const primarySpring = useMemo(() => ({
    stiffness: springCfg.stiffness,
    damping: springCfg.damping,
    mass: springCfg.mass,
  }), [springCfg.stiffness, springCfg.damping, springCfg.mass]);

  const secondarySpring = useMemo(() => ({
    stiffness: springCfg.stiffness * 0.7,
    damping: springCfg.damping * 1.2,
    mass: springCfg.mass * 1.3,
  }), [springCfg.stiffness, springCfg.damping, springCfg.mass]);

  const accessorySpring = useMemo(() => ({
    stiffness: springCfg.stiffness * 1.4,
    damping: springCfg.damping * 0.6,
    mass: springCfg.mass * 0.5,
  }), [springCfg.stiffness, springCfg.damping, springCfg.mass]);

  // Smoothed motion values via springs
  const springHeadRotate = useSpring(headRotateTarget, primarySpring);
  const springHeadY = useSpring(headYTarget, primarySpring);
  const springHeadX = useSpring(headXTarget, primarySpring);
  const springBodyRotate = useSpring(bodyRotSpring, secondarySpring);
  const springBodyY = useSpring(bodyYSpring, secondarySpring);
  const springAccRotate = useSpring(accessoryRotateTarget, accessorySpring);
  const springAccY = useSpring(accessoryYTarget, accessorySpring);

  // Parallax motion values
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const parallaxSpring = { stiffness: 150, damping: 20 };
  const layerBackX = useSpring(useTransform(mouseX, [-1, 1], [3, -3]), parallaxSpring);
  const layerBackY = useSpring(useTransform(mouseY, [-1, 1], [2, -2]), parallaxSpring);
  const layerMidX = useSpring(useTransform(mouseX, [-1, 1], [1, -1]), parallaxSpring);
  const layerMidY = useSpring(useTransform(mouseY, [-1, 1], [0.5, -0.5]), parallaxSpring);
  const layerFrontX = useSpring(useTransform(mouseX, [-1, 1], [-2, 2]), parallaxSpring);
  const layerFrontY = useSpring(useTransform(mouseY, [-1, 1], [-1.5, 1.5]), parallaxSpring);

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

  // === PHYSICS-DRIVEN REACTION SYSTEM ===
  // When reaction changes: drive primary spring → stagger secondary → stagger accessory → settle
  useEffect(() => {
    prevReactionRef.current = reaction;

    // Clean up previous timers
    if (secondaryTimerRef.current) clearTimeout(secondaryTimerRef.current);
    if (accessoryTimerRef.current) clearTimeout(accessoryTimerRef.current);
    if (settlingTimerRef.current) clearTimeout(settlingTimerRef.current);
    if (shakeIntervalRef.current) clearInterval(shakeIntervalRef.current);

    const target = REACTION_TRANSFORMS[reaction] || REACTION_TRANSFORMS.neutral;
    const overshootMult = 1 + springCfg.overshoot * intensity;

    // Step 1: Drive primary head motion immediately (with overshoot)
    headRotateTarget.set(target.headRotate * intensity * overshootMult);
    headYTarget.set(target.headY * intensity * overshootMult);
    headXTarget.set(target.headX * intensity * overshootMult);

    // For head shake: oscillate X position to simulate repeated shake
    if (reaction === "shake") {
      let shakeCount = 0;
      const maxShakes = Math.round(2 + intensity * 3); // 2-5 shakes based on intensity
      shakeIntervalRef.current = setInterval(() => {
        shakeCount++;
        if (shakeCount >= maxShakes) {
          if (shakeIntervalRef.current) clearInterval(shakeIntervalRef.current);
          headXTarget.set(0);
          return;
        }
        // Alternate direction with decaying amplitude
        const decay = 1 - (shakeCount / maxShakes) * 0.6;
        const direction = shakeCount % 2 === 0 ? 1 : -1;
        headXTarget.set(target.headX * intensity * direction * decay);
      }, 180);
    }

    // Step 2: Secondary motion (shoulders/body) follows after delay
    secondaryTimerRef.current = setTimeout(() => {
      bodyRotSpring.set(target.bodyRotate * intensity);
      bodyYSpring.set((target.bodyY + target.shoulderY) * intensity);
    }, springCfg.secondaryDelay);

    // Step 3: Accessories follow with more delay + bouncier spring
    accessoryTimerRef.current = setTimeout(() => {
      // Accessories respond to head motion — they exaggerate the head's movement
      const accessoryReact = target.headRotate * intensity * 1.3;
      const accessoryBounce = target.headY * intensity * 0.8;
      accessoryRotateTarget.set(accessoryReact);
      accessoryYTarget.set(accessoryBounce);
    }, springCfg.accessoryDelay);

    // Step 4: Settling — if reaction is a one-shot (nod, shake), return to neutral after
    if (reaction === "nod" || reaction === "shake") {
      const settleDelay = reaction === "shake"
        ? 180 * Math.round(2 + intensity * 3) + 200 // wait for shakes to finish
        : 400 + springCfg.settlingDuration * 500;

      settlingTimerRef.current = setTimeout(() => {
        // Damped return: remove overshoot, settle to gentle rest position
        headRotateTarget.set(target.headRotate * intensity * 0.15);
        headYTarget.set(target.headY * intensity * 0.1);
        headXTarget.set(0);

        // Body settles back
        setTimeout(() => {
          bodyRotSpring.set(0);
          bodyYSpring.set(0);
        }, springCfg.secondaryDelay * 0.5);

        // Accessories trail behind
        setTimeout(() => {
          accessoryRotateTarget.set(0);
          accessoryYTarget.set(0);
        }, springCfg.accessoryDelay * 0.5);
      }, settleDelay);
    }

    // Neutral: return everything to zero
    if (reaction === "neutral") {
      headRotateTarget.set(0);
      headYTarget.set(0);
      headXTarget.set(0);
      // Body follows with delay
      secondaryTimerRef.current = setTimeout(() => {
        bodyRotSpring.set(0);
        bodyYSpring.set(0);
      }, springCfg.secondaryDelay * 0.7);
      // Accessories trail
      accessoryTimerRef.current = setTimeout(() => {
        accessoryRotateTarget.set(0);
        accessoryYTarget.set(0);
      }, springCfg.accessoryDelay * 0.7);
    }

    return () => {
      if (secondaryTimerRef.current) clearTimeout(secondaryTimerRef.current);
      if (accessoryTimerRef.current) clearTimeout(accessoryTimerRef.current);
      if (settlingTimerRef.current) clearTimeout(settlingTimerRef.current);
      if (shakeIntervalRef.current) clearInterval(shakeIntervalRef.current);
    };
  }, [reaction, intensity, springCfg, headRotateTarget, headYTarget, headXTarget, bodyRotSpring, bodyYSpring, accessoryRotateTarget, accessoryYTarget]);

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
      ref={containerRef}
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

          {/* ===== LAYER 1 (BACK): Body + Arms — spring-driven secondary motion ===== */}
          <motion.g
            style={{
              x: enableParallax ? layerBackX : 0,
              y: enableParallax ? layerBackY : 0,
              rotate: springBodyRotate,
              translateY: springBodyY,
              ...getBreathStyle(),
              transformOrigin: `${cx}px ${bodyY}px`,
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
              {/* Arms */}
              {renderArms()}
            </g>
          </motion.g>

          {/* ===== LAYER 2 (MID): Head + Face — spring-driven primary motion ===== */}
          <motion.g
            filter={`url(#rim-${persona.id})`}
            style={{
              x: enableParallax ? layerMidX : 0,
              y: enableParallax ? layerMidY : 0,
              rotate: springHeadRotate,
              translateY: springHeadY,
              translateX: springHeadX,
              transformOrigin: `${cx}px ${s * 0.36}px`,
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

          {/* ===== LAYER 3 (FRONT): Accessories — spring-driven accessory physics ===== */}
          <motion.g
            style={{
              x: enableParallax ? layerFrontX : 0,
              y: enableParallax ? layerFrontY : 0,
              rotate: springAccRotate,
              translateY: springAccY,
              transformOrigin: `${cx}px ${s * 0.36}px`,
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
