import React from "react";

interface MersalLogoProps {
  className?: string;
  width?: number | string;
  height?: number | string;
  isDarkBackground?: boolean;
}

export const MersalLogo: React.FC<MersalLogoProps> = ({
  className = "",
  width = "120",
  height = "120",
  isDarkBackground = true,
}) => {
  // We construct a high-fidelity SVG representation of the Mersal Foundation Logo
  // It features:
  // 1. Stylized Gold/Yellow Calligraphy "مرسال"
  // 2. Stylized "M" Letter with Green, Red, and Black/Dark paths
  // 3. Teal "ersal" letters
  // 4. Teal spaced-out "FOUNDATION" letters
  // The background is fully transparent so it fits dark of the site and white of the reports.

  const rightLegColor = isDarkBackground ? "#f8fafc" : "#0f172a"; // Light on dark, dark on print white

  return (
    <svg
      id="mersal-foundation-svg-logo"
      width={width}
      height={height}
      viewBox="0 0 500 500"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} transition-all duration-300`}
      referrerPolicy="no-referrer"
    >
      <g>
        {/* UPPER PORTION: STYLIZED GOLD/YELLOW ARABIC CALLIGRAPHY "مرسال" */}
        {/* Base and stems constructed following the modern block Kufic logo geometry */}
        <path
          d="M74 213.5H127C133.075 213.5 138 208.575 138 202.5V155.5C138 149.425 142.925 144.5 149 144.5H161C167.075 144.5 172 149.425 172 155.5V191.5C172 197.575 176.925 202.5 183 202.5H196C202.075 202.5 207 197.575 207 191.5V155.5C207 149.425 211.925 144.5 218 144.5H230C236.075 144.5 241 149.425 241 155.5V202.5C241 208.575 245.925 213.5 252 213.5H356C362.075 213.5 367 208.575 367 202.5V191.5C367 185.425 371.925 180.5 378 180.5H417.5C423.575 180.5 428.5 185.425 428.5 191.5V220.5C428.5 226.575 423.575 231.5 417.5 231.5H332.5C320.35 231.5 310.5 241.35 310.5 253.5V254.5C310.5 257.261 308.261 259.5 305.5 259.5H172C165.925 259.5 161 254.575 161 248.5V220.5C161 214.425 156.075 209.5 150 209.5H138C131.925 209.5 127 214.425 127 220.5V248.5C127 254.575 122.075 259.5 116 259.5H74C67.9249 259.5 63 254.575 63 248.5V224.5C63 218.425 67.9249 213.5 74 213.5Z"
          fill="#dfa013"
        />
        {/* Right Calligraphy Loop element (for the ل letter / dot design) */}
        <rect x="389" y="193" width="13" height="13" rx="1.5" fill="#dfa013" />

        {/* MIDDLE PORTION: SPECIAL "Mersal" LOGO TEXT */}
        {/* Stylized M (left green leg, middle red V, right dark leg) */}
        {/* Left Green Leg */}
        <path
          d="M63 263H76V345H63V263Z"
          fill="#10b981"
        />
        {/* Middle Red V */}
        <path
          d="M76 263L107.5 345L139 263V285L107.5 365L76 285V263Z"
          fill="#ef4444"
        />
        {/* Right Dark Leg */}
        <path
          d="M139 263H152V345H139V263Z"
          fill={rightLegColor}
        />

        {/* Teal "ersal" Text */}
        <text
          x="163"
          y="345"
          fill="#0d9488"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize="84"
          fontWeight="900"
          letterSpacing="-0.03em"
        >
          ersal
        </text>

        {/* LOWER PORTION: "FOUNDATION" */}
        <text
          x="63"
          y="405"
          fill="#0ca5e9"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize="30"
          fontWeight="700"
          letterSpacing="0.45em"
        >
          FOUNDATION
        </text>
      </g>
    </svg>
  );
};
