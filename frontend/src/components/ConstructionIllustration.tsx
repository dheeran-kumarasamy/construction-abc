import type { CSSProperties } from "react";

interface ConstructionIllustrationProps {
  type: "blueprint" | "crane" | "building" | "tools" | "hardhat";
  size?: number;
  style?: CSSProperties;
}

export function ConstructionIllustration({
  type,
  size = 120,
  style,
}: ConstructionIllustrationProps) {
  const baseStyle: CSSProperties = {
    width: size,
    height: size,
    ...style,
  };

  if (type === "blueprint") {
    return (
      <svg
        viewBox="0 0 200 200"
        style={baseStyle}
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="200" height="200" fill="#0f766e" />
        <g stroke="#ccfbf1" strokeWidth="2" fill="none">
          <rect x="30" y="30" width="140" height="140" />
          <line x1="30" y1="80" x2="170" y2="80" />
          <line x1="30" y1="130" x2="170" y2="130" />
          <line x1="80" y1="30" x2="80" y2="170" />
          <line x1="130" y1="30" x2="130" y2="170" />
          <circle cx="50" cy="50" r="5" fill="#ccfbf1" />
          <circle cx="150" cy="150" r="5" fill="#ccfbf1" />
        </g>
      </svg>
    );
  }

  if (type === "crane") {
    return (
      <svg
        viewBox="0 0 200 200"
        style={baseStyle}
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="200" height="200" fill="#f8fafc" />
        <rect x="85" y="20" width="30" height="120" fill="#0f766e" />
        <rect x="50" y="30" width="100" height="8" fill="#0f766e" />
        <line x1="150" y1="38" x2="150" y2="100" stroke="#0f766e" strokeWidth="4" />
        <rect x="130" y="100" width="40" height="50" fill="#fef9c3" stroke="#0f766e" strokeWidth="2" />
        <rect x="20" y="140" width="160" height="10" fill="#6b7280" />
        <circle cx="50" cy="155" r="8" fill="#0f766e" />
        <circle cx="150" cy="155" r="8" fill="#0f766e" />
      </svg>
    );
  }

  if (type === "building") {
    return (
      <svg
        viewBox="0 0 200 200"
        style={baseStyle}
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="200" height="200" fill="#f8fafc" />
        <rect x="50" y="50" width="100" height="110" fill="#0f766e" stroke="#1f2937" strokeWidth="2" />
        <g fill="#ccfbf1">
          <rect x="60" y="60" width="18" height="18" />
          <rect x="85" y="60" width="18" height="18" />
          <rect x="110" y="60" width="18" height="18" />
          <rect x="60" y="85" width="18" height="18" />
          <rect x="85" y="85" width="18" height="18" />
          <rect x="110" y="85" width="18" height="18" />
          <rect x="60" y="110" width="18" height="18" />
          <rect x="85" y="110" width="18" height="18" />
          <rect x="110" y="110" width="18" height="18" />
          <rect x="60" y="135" width="18" height="18" />
          <rect x="85" y="135" width="18" height="18" />
          <rect x="110" y="135" width="18" height="18" />
        </g>
        <polygon points="50,50 100,25 150,50" fill="#e5e7eb" stroke="#1f2937" strokeWidth="2" />
      </svg>
    );
  }

  if (type === "tools") {
    return (
      <svg
        viewBox="0 0 200 200"
        style={baseStyle}
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="200" height="200" fill="#f8fafc" />
        <g stroke="#0f766e" strokeWidth="3" fill="none">
          <circle cx="60" cy="80" r="22" />
          <line x1="82" y1="80" x2="130" y2="80" />
          <line x1="130" y1="70" x2="130" y2="90" />
          <rect x="40" y="120" width="30" height="50" />
          <line x1="55" y1="120" x2="55" y2="170" />
          <line x1="95" y1="140" x2="145" y2="140" />
          <line x1="120" y1="120" x2="145" y2="170" />
        </g>
      </svg>
    );
  }

  if (type === "hardhat") {
    return (
      <svg
        viewBox="0 0 200 200"
        style={baseStyle}
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="200" height="200" fill="#f8fafc" />
        <path d="M 50 120 Q 50 80 100 70 Q 150 80 150 120" fill="#fef9c3" stroke="#0f766e" strokeWidth="3" />
        <rect x="60" y="115" width="80" height="15" fill="#0f766e" />
        <line x1="70" y1="95" x2="90" y2="110" stroke="#0f766e" strokeWidth="2" />
        <line x1="130" y1="95" x2="110" y2="110" stroke="#0f766e" strokeWidth="2" />
        <circle cx="100" cy="130" r="15" fill="none" stroke="#0f766e" strokeWidth="2" />
      </svg>
    );
  }

  return null;
}
