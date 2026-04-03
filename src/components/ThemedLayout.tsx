import { motion, Variants } from "framer-motion";
import { ReactNode } from "react";
import { SessionTheme } from "../data/themes";

interface ThemedLayoutProps {
  theme: SessionTheme;
  children: ReactNode[];
}

export function ThemedLayout({ theme, children }: ThemedLayoutProps) {
  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.3,
      },
    },
  };

  const tileVariants = {
    hidden: { opacity: 0, scale: 0.8, y: 20 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { type: "spring" as const, stiffness: 200, damping: 20 },
    },
  };

  // On mobile, always use responsive grid (specialized layouts need too much horizontal space)
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  if (isMobile) {
    return (
      <GridLayout containerVariants={containerVariants} tileVariants={tileVariants} totalTiles={children.length}>
        {children}
      </GridLayout>
    );
  }

  switch (theme.tileLayout) {
    case "panel":
      return (
        <PanelLayout containerVariants={containerVariants} tileVariants={tileVariants}>
          {children}
        </PanelLayout>
      );
    case "semicircle":
      return (
        <SemicircleLayout containerVariants={containerVariants} tileVariants={tileVariants}>
          {children}
        </SemicircleLayout>
      );
    case "theater":
      return (
        <TheaterLayout containerVariants={containerVariants} tileVariants={tileVariants}>
          {children}
        </TheaterLayout>
      );
    default:
      return (
        <GridLayout containerVariants={containerVariants} tileVariants={tileVariants} totalTiles={children.length}>
          {children}
        </GridLayout>
      );
  }
}

interface LayoutProps {
  children: ReactNode[];
  containerVariants: Variants;
  tileVariants: Variants;
  totalTiles?: number;
}

// Shark Tank: panel of judges in a row with golden ambient glow
function PanelLayout({ children, containerVariants, tileVariants }: LayoutProps) {
  return (
    <motion.div
      className="h-full flex flex-col gap-3 relative"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Golden ambient glow behind panel */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 50% 80%, rgba(212,160,23,0.06) 0%, transparent 60%)",
        }}
      />
      <div className="flex-1 flex gap-2 md:gap-3 items-stretch flex-wrap md:flex-nowrap relative z-10">
        {children.map((child, i) => (
          <motion.div
            key={i}
            className="flex-1 min-w-[120px]"
            variants={tileVariants}
            layout
          >
            {child}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// Courtroom: semicircle jury arc with subtle wood-grain texture
function SemicircleLayout({ children, containerVariants, tileVariants }: LayoutProps) {
  const audienceCount = children.length;
  return (
    <motion.div
      className="h-full relative"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Elevated bench backdrop hint */}
      <div
        className="absolute top-0 left-[10%] right-[10%] h-[30%] pointer-events-none rounded-b-xl"
        style={{
          background: "linear-gradient(to bottom, rgba(139,69,19,0.06) 0%, transparent 100%)",
        }}
      />
      {children.map((child, i) => {
        const angleRange = Math.min(140, audienceCount * 25);
        const startAngle = (180 - angleRange) / 2;
        const angle = startAngle + (angleRange / Math.max(1, audienceCount - 1)) * i;
        const radian = (angle * Math.PI) / 180;

        const radiusX = 38;
        const radiusY = 32;
        const centerX = 50;
        const centerY = 50;

        const x = centerX - radiusX * Math.cos(radian);
        const y = centerY - radiusY * Math.sin(radian);

        const distFromCenter = Math.abs(i - (audienceCount - 1) / 2) / Math.max(1, (audienceCount - 1) / 2);
        const scale = 1 - distFromCenter * 0.1;

        const tileWidth = Math.min(220, Math.max(140, 800 / audienceCount));
        const tileHeight = tileWidth * 0.8;

        return (
          <motion.div
            key={i}
            className="absolute"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              transform: `translate(-50%, -50%) scale(${scale})`,
              width: tileWidth,
              height: tileHeight,
            }}
            variants={tileVariants}
            layout
          >
            {child}
          </motion.div>
        );
      })}
    </motion.div>
  );
}

// Lecture hall: theater rows with perspective + spotlight from above
function TheaterLayout({ children, containerVariants, tileVariants }: LayoutProps) {
  const audienceCount = children.length;
  const rowSize = Math.ceil(audienceCount / 2);
  const frontRow = children.slice(0, rowSize);
  const backRow = children.slice(rowSize);

  return (
    <motion.div
      className="h-full flex flex-col gap-2 justify-center relative"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Spotlight cone from above */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-[40%] pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.05) 0%, transparent 70%)",
        }}
      />
      {backRow.length > 0 && (
        <div className="flex gap-2 items-stretch px-4 md:px-8 opacity-80 relative z-10" style={{ flex: "0 0 35%" }}>
          {backRow.map((child, i) => (
            <motion.div
              key={`back-${i}`}
              className="flex-1"
              style={{ transform: "scale(0.88)" }}
              variants={tileVariants}
              layout
            >
              {child}
            </motion.div>
          ))}
        </div>
      )}
      <div className="flex gap-2 md:gap-3 items-stretch relative z-10" style={{ flex: "0 0 45%" }}>
        {frontRow.map((child, i) => (
          <motion.div
            key={`front-${i}`}
            className="flex-1"
            variants={tileVariants}
            layout
          >
            {child}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// Default grid
function GridLayout({ children, containerVariants, tileVariants, totalTiles = 7 }: LayoutProps) {
  // Mobile: always 2 cols, auto-rows with min height
  // Desktop: adaptive cols based on count
  const gridCols =
    totalTiles <= 2
      ? "grid-cols-2"
      : totalTiles <= 4
      ? "grid-cols-2"
      : totalTiles <= 6
      ? "grid-cols-2 md:grid-cols-3"
      : "grid-cols-2 md:grid-cols-4";

  return (
    <motion.div
      className={`grid ${gridCols} gap-1.5 md:gap-3 h-full auto-rows-fr overflow-y-auto md:overflow-hidden scroll-touch`}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {children.map((child, i) => (
        <motion.div key={i} variants={tileVariants} layout>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
