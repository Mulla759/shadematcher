import { readableInk } from "@/lib/color";

export function ConfidencePill({
  label,
  level,
}: {
  label: string;
  level: string;
}) {
  return (
    <span className="confidence" data-level={level}>
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: "currentColor",
          display: "inline-block",
        }}
      />
      {label} confidence
    </span>
  );
}

export function ScoreBar({ value }: { value: number }) {
  return (
    <span className="score-bar" aria-hidden="true">
      <i style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
    </span>
  );
}

export function Swatch({
  hex,
  size = 34,
  className = "",
}: {
  hex: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={className}
      style={{
        display: "inline-block",
        width: size,
        height: size,
        background: hex,
        border: "1px solid rgba(25,20,16,0.16)",
        position: "relative",
      }}
      aria-label={hex}
    >
      <span
        style={{
          position: "absolute",
          inset: 4,
          border: "1px solid rgba(255,255,255,0.24)",
        }}
      />
    </span>
  );
}

export function SwatchChip({
  hex,
  name,
  active,
  onClick,
}: {
  hex: string;
  name: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="fabric-chip"
      data-active={active}
      style={{ background: hex }}
      onClick={onClick}
      title={name}
      aria-label={`Preview ${name}`}
      aria-pressed={active}
    />
  );
}

export function InkChip({ hex, name }: { hex: string; name: string }) {
  return (
    <span
      className="region-chip"
      style={{ color: "var(--ink-2)" }}
      title={name}
    >
      <i style={{ background: hex }} />
      {name}
    </span>
  );
}

export function SwatchLegend({ hex, name }: { hex: string; name: string }) {
  return (
    <span
      className="mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        color: "var(--ink-3)",
      }}
    >
      <i
        style={{
          width: 10,
          height: 10,
          background: hex,
          border: "1px solid rgba(25,20,16,0.16)",
          display: "inline-block",
        }}
      />
      {name}
    </span>
  );
}

export function ColourWord({ hex, children }: { hex: string; children: React.ReactNode }) {
  return <span style={{ color: readableInk(hex) === "#FBF8F2" ? "#FBF8F2" : "inherit" }}>{children}</span>;
}
