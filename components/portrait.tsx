import type { Expression } from "@/lib/types";

type Hair = "curls" | "long" | "crop" | "wavy" | "shaved" | "hijab";

const looks: Record<
  string,
  { skin: string; shade: string; hair: string; cloth: string; style: Hair; glasses?: boolean; earring?: boolean }
> = {
  jordan: { skin: "#c68642", shade: "#a86b30", hair: "#2a2118", cloth: "#243056", style: "curls" },
  priya: { skin: "#8d5524", shade: "#6e3f18", hair: "#1a120e", cloth: "#c47b2b", style: "long" },
  marcus: { skin: "#5c3317", shade: "#3f2412", hair: "#2a211c", cloth: "#2c3038", style: "crop" },
  sofia: { skin: "#e0ac69", shade: "#c48d4e", hair: "#3a2418", cloth: "#8c3d32", style: "wavy" },
  dev: { skin: "#a56b45", shade: "#8a5534", hair: "#1f1a16", cloth: "#1f3d34", style: "shaved", earring: true },
};

function lookFor(slug: string) {
  const all = Object.values(looks);
  let hash = 0;
  for (const char of slug) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return all[hash % all.length];
}

const brows: Record<Expression, string> = {
  guarded: "M58 86 Q78 92 96 84 M108 84 Q126 92 146 86",
  bristling: "M56 90 Q78 74 98 86 M106 86 Q128 74 148 90",
  listening: "M58 88 Q78 80 96 86 M112 80 Q130 72 148 84",
  open: "M58 90 Q78 78 96 86 M108 86 Q128 76 148 88",
  steady: "M58 86 Q78 84 96 86 M108 86 Q128 84 146 86",
  firm: "M56 88 L96 84 M108 84 L148 88",
};

const mouths: Record<Expression, string> = {
  guarded: "M78 138 Q102 142 126 138",
  bristling: "M80 146 Q102 136 124 146",
  listening: "M90 136 Q102 146 114 136",
  open: "M78 134 Q102 150 126 134",
  steady: "M80 136 Q102 146 124 136",
  firm: "M84 140 L120 140",
};

export function Portrait({
  slug,
  name,
  expression,
  mirrored = false,
  className = "",
}: {
  slug: string;
  name: string;
  expression: Expression;
  mirrored?: boolean;
  className?: string;
}) {
  const look = looks[slug] ?? lookFor(slug);
  return (
    <svg
      viewBox="0 0 200 230"
      role="img"
      aria-label={`${name}, looking ${expression}`}
      className={className}
      style={mirrored ? { transform: "scaleX(-1)" } : undefined}
    >
      <circle cx="100" cy="112" r="96" fill="#f6efe4" />
      <path d={brows[expression]} fill="none" stroke="#2a2118" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="100" cy="168" rx="70" ry="36" fill={look.cloth} />
      <ellipse cx="100" cy="108" rx="48" ry="56" fill={look.skin} />
      <ellipse cx="100" cy="118" rx="34" ry="28" fill={look.shade} opacity="0.18" />
      <Hair style={look.style} color={look.hair} />
      <ellipse cx="78" cy="112" rx="5" ry={expression === "bristling" ? 3.2 : 4.4} fill="#1c1612" />
      <ellipse cx="122" cy="112" rx="5" ry={expression === "bristling" ? 3.2 : 4.4} fill="#1c1612" />
      <path d="M100 116 Q104 128 100 132" fill="none" stroke={look.shade} strokeWidth="2" strokeLinecap="round" />
      <path d={mouths[expression]} fill="none" stroke="#6d2e2a" strokeWidth="2.5" strokeLinecap="round" />
      {look.glasses ? (
        <g fill="none" stroke="#1c1612" strokeWidth="2">
          <circle cx="78" cy="112" r="12" />
          <circle cx="122" cy="112" r="12" />
          <path d="M90 112 H110" />
        </g>
      ) : null}
      {look.earring ? <circle cx="146" cy="124" r="3" fill="#e2a23a" /> : null}
    </svg>
  );
}

function Hair({ style, color }: { style: Hair; color: string }) {
  if (style === "hijab") {
    return (
      <path
        d="M52 118 C52 62 148 58 152 120 C160 150 150 176 128 178 L74 178 C48 170 40 146 52 118 Z"
        fill={color}
      />
    );
  }
  if (style === "shaved") {
    return <path d="M62 78 C70 58 132 56 142 82 C132 64 74 66 62 78 Z" fill={color} opacity="0.35" />;
  }
  if (style === "curls") {
    return (
      <g fill={color}>
        <circle cx="62" cy="78" r="14" />
        <circle cx="84" cy="60" r="16" />
        <circle cx="108" cy="54" r="16" />
        <circle cx="132" cy="64" r="15" />
        <circle cx="146" cy="86" r="13" />
        <circle cx="58" cy="100" r="12" />
        <circle cx="148" cy="108" r="11" />
      </g>
    );
  }
  if (style === "long") {
    return (
      <path
        d="M58 96 C54 40 150 36 146 100 C156 70 142 48 100 46 C58 48 46 74 58 96 M46 108 C40 160 58 196 70 188 C60 150 62 120 74 108 Z M154 108 C162 150 146 196 132 186 C144 150 140 120 128 108 Z"
        fill={color}
      />
    );
  }
  if (style === "wavy") {
    return (
      <path
        d="M54 100 C48 48 154 44 150 104 C158 78 140 58 100 56 C64 58 46 78 54 100 M48 112 C42 150 70 170 78 150 C70 130 66 118 78 108 Z"
        fill={color}
      />
    );
  }
  return <path d="M58 96 C62 52 142 50 146 98 C138 70 66 70 58 96 Z" fill={color} />;
}
