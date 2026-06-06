/**
 * Inline SVG glyphs for the Assist screens (stroke = currentColor), ported from
 * the design references (`ae-kit.jsx:AEI` + the shell `I` set) so stroke weights
 * and shapes match the handoff pixel-for-pixel. Each is a small presentational
 * component taking a numeric `size` (px) + optional `className`.
 */
import * as React from "react";

type IconProps = { size?: number; className?: string };

function Svg({
  size = 16,
  className,
  children,
  fill = "none",
  stroke = true,
  strokeWidth = 1.8
}: IconProps & {
  children: React.ReactNode;
  fill?: string;
  stroke?: boolean;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={stroke ? "currentColor" : "none"}
      strokeWidth={stroke ? strokeWidth : undefined}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const Sparkle = ({ size, className }: IconProps) => (
  <Svg size={size} className={className} fill="currentColor" stroke={false}>
    <path d="M12 2.5l1.7 5.8L19.5 10l-5.8 1.7L12 17.5l-1.7-5.8L4.5 10l5.8-1.7z" />
    <path d="M19 3l.7 2.3L22 6l-2.3.7L19 9l-.7-2.3L16 6l2.3-.7z" />
  </Svg>
);

export const Mic = ({ size, className }: IconProps) => (
  <Svg size={size} className={className} strokeWidth={1.8}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M6 11a6 6 0 0012 0M12 17v4M9 21h6" />
  </Svg>
);

export const Camera = ({ size, className }: IconProps) => (
  <Svg size={size} className={className} strokeWidth={1.7}>
    <path d="M3 8a2 2 0 012-2h2l1.2-1.6A1 1 0 019 4h6a1 1 0 01.8.4L17 6h2a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    <circle cx="12" cy="13" r="3.4" />
  </Svg>
);

export const Document = ({ size, className }: IconProps) => (
  <Svg size={size} className={className} strokeWidth={1.7}>
    <path d="M7 3h7l4 4v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" />
    <path d="M14 3v4h4M9 12h6M9 16h5" />
  </Svg>
);

export const LinkGlyph = ({ size, className }: IconProps) => (
  <Svg size={size} className={className} strokeWidth={1.8}>
    <path d="M9.5 14.5l5-5" />
    <path d="M11 7.5l1.6-1.6a3.5 3.5 0 014.95 4.95L15.9 12.5" />
    <path d="M13 16.5l-1.6 1.6a3.5 3.5 0 01-4.95-4.95L8.1 11.5" />
  </Svg>
);

export const ChevronRight = ({ size, className }: IconProps) => (
  <Svg size={size} className={className} strokeWidth={2}>
    <path d="M9 6l6 6-6 6" />
  </Svg>
);

export const ChevronLeft = ({ size, className }: IconProps) => (
  <Svg size={size} className={className} strokeWidth={2}>
    <path d="M15 6l-6 6 6 6" />
  </Svg>
);

export const Plus = ({ size, className }: IconProps) => (
  <Svg size={size} className={className} strokeWidth={2}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const Check = ({ size, className }: IconProps) => (
  <Svg size={size} className={className} strokeWidth={2.2}>
    <path d="M5 12.5l4.5 4.5L19 6.5" />
  </Svg>
);

export const X = ({ size, className }: IconProps) => (
  <Svg size={size} className={className} strokeWidth={2}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);

export const Stop = ({ size, className }: IconProps) => (
  <Svg size={size} className={className} fill="currentColor" stroke={false}>
    <rect x="6" y="6" width="12" height="12" rx="2.5" />
  </Svg>
);

export const Upload = ({ size, className }: IconProps) => (
  <Svg size={size} className={className} strokeWidth={1.7}>
    <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
  </Svg>
);

export const Trash = ({ size, className }: IconProps) => (
  <Svg size={size} className={className} strokeWidth={1.7}>
    <path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" />
  </Svg>
);

export const Drag = ({ size, className }: IconProps) => (
  <Svg size={size} className={className} fill="currentColor" stroke={false}>
    <circle cx="9" cy="6" r="1.6" />
    <circle cx="15" cy="6" r="1.6" />
    <circle cx="9" cy="12" r="1.6" />
    <circle cx="15" cy="12" r="1.6" />
    <circle cx="9" cy="18" r="1.6" />
    <circle cx="15" cy="18" r="1.6" />
  </Svg>
);

export const Send = ({ size, className }: IconProps) => (
  <Svg size={size} className={className} strokeWidth={1.9}>
    <path d="M5 12h13M13 6l6 6-6 6" />
  </Svg>
);

export const Undo = ({ size, className }: IconProps) => (
  <Svg size={size} className={className} strokeWidth={1.8}>
    <path d="M9 7L4 12l5 5M4 12h11a5 5 0 010 10h-1" />
  </Svg>
);
