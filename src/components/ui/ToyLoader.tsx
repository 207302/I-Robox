"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useState, type ComponentType } from "react";

export type ToyLoaderType = "car" | "truck" | "bike";

const VEHICLE_WIDTH = 48;
const DRIVE_DURATION = 1.4;

const TOY_TYPES: ToyLoaderType[] = ["car", "truck", "bike"];

function pickRandomType(): ToyLoaderType {
  return TOY_TYPES[Math.floor(Math.random() * TOY_TYPES.length)]!;
}

type WheelProps = {
  cx: number;
  cy: number;
  r: number;
  spin: boolean;
};

function Wheel({ cx, cy, r, spin }: WheelProps) {
  const circle = <circle cx={cx} cy={cy} r={r} fill="currentColor" />;
  if (!spin) return circle;

  return (
    <motion.g
      style={{ transformOrigin: `${cx}px ${cy}px` }}
      animate={{ rotate: 360 }}
      transition={{ duration: DRIVE_DURATION, ease: "linear", repeat: Infinity }}
    >
      {circle}
    </motion.g>
  );
}

function CarIcon({ spin }: { spin: boolean }) {
  return (
    <svg
      width={VEHICLE_WIDTH}
      height={32}
      viewBox="0 0 48 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M6 18h4l3-6h10l3 4h8c2 0 3 1 3 3v2H6v-3z"
        fill="currentColor"
      />
      <path d="M14 12V9l4-2h6l4 2v3" fill="currentColor" />
      <Wheel cx={14} cy={24} r={4} spin={spin} />
      <Wheel cx={34} cy={24} r={4} spin={spin} />
    </svg>
  );
}

function TruckIcon({ spin }: { spin: boolean }) {
  return (
    <svg
      width={VEHICLE_WIDTH}
      height={36}
      viewBox="0 0 48 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d="M4 12h14v14H4V12z" fill="currentColor" />
      <path d="M6 12V8l6-4h4l4 4v4" fill="currentColor" />
      <rect x={18} y={20} width={26} height={6} rx={1} fill="currentColor" />
      <Wheel cx={11} cy={28} r={5} spin={spin} />
      <Wheel cx={38} cy={28} r={5} spin={spin} />
    </svg>
  );
}

function BikeIcon({ spin }: { spin: boolean }) {
  return (
    <svg
      width={VEHICLE_WIDTH}
      height={32}
      viewBox="0 0 48 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M19 20 L22.5 11.5 L24.5 11.5 L21 20 Z"
        fill="currentColor"
      />
      <path
        d="M22.5 11.5 L29 9.5 L30.5 11 L24.5 13.5 Z"
        fill="currentColor"
      />
      <rect x={19.5} y={7.5} width={9} height={2.5} rx={1.25} fill="currentColor" />
      <path
        d="M24.5 13.5 L33 19.5 L35.5 21 L26.5 21 Z"
        fill="currentColor"
      />
      <Wheel cx={12} cy={22} r={6} spin={spin} />
      <Wheel cx={36} cy={22} r={6} spin={spin} />
    </svg>
  );
}

const ICONS: Record<ToyLoaderType, ComponentType<{ spin: boolean }>> = {
  car: CarIcon,
  truck: TruckIcon,
  bike: BikeIcon,
};

type Props = {
  type?: ToyLoaderType;
  className?: string;
  "aria-label"?: string;
};

export function ToyLoader({ type: typeProp, className = "", "aria-label": ariaLabel = "Loading" }: Props) {
  const [type] = useState<ToyLoaderType>(() => typeProp ?? pickRandomType());
  const prefersReducedMotion = useReducedMotion();
  const spin = !prefersReducedMotion;
  const Icon = ICONS[typeProp ?? type];

  return (
    <div
      className={`w-full ${className}`.trim()}
      role="progressbar"
      aria-live="polite"
      aria-label={ariaLabel}
      aria-valuetext="Loading"
    >
      <div className="relative h-10 w-full overflow-hidden">
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 text-blue"
          style={{ width: VEHICLE_WIDTH }}
          initial={false}
          animate={
            prefersReducedMotion
              ? { left: "50%", x: "-50%" }
              : { left: ["0px", `calc(100% - ${VEHICLE_WIDTH}px)`] }
          }
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: DRIVE_DURATION, ease: "linear", repeat: Infinity }
          }
        >
          <Icon spin={spin} />
        </motion.div>
      </div>
      <div className="h-[3px] w-full rounded-full bg-gray-2" aria-hidden />
    </div>
  );
}
