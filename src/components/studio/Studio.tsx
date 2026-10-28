"use client";

import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { MirrorStage } from "./MirrorStage";
import { ReadingPanel } from "./ReadingPanel";
import { useFaceStudio } from "./useFaceStudio";

export function Studio() {
  const studio = useFaceStudio();

  return (
    <div className="studio-body">
      <div className="studio-topbar">
        <div className="shell studio-topbar-inner">
          <Logo compact />
          <div className="studio-status">
            <span className={`status-dot ${studio.cameraState === "live" ? "live" : ""}`} />
            <span className="mono" style={{ color: "var(--ink-3)" }}>
              Studio 01 · {studio.cameraState === "live" ? "camera live" : studio.mode === "photo" ? "still photo" : "idle"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span className="mono" style={{ color: "var(--ink-3)", display: "flex", alignItems: "center", gap: 6 }}>
              <ShieldCheck size={12} strokeWidth={1.7} />
              On-device by default
            </span>
            <Link className="text-link" href="/">
              <ArrowLeft size={13} strokeWidth={1.6} />
              Atelier
            </Link>
            <Link className="text-link" href="/lab">
              Raw lab
            </Link>
          </div>
        </div>
      </div>

      <div className="shell" style={{ paddingInline: 0 }}>
        <div className="studio-grid">
          <div className="studio-left">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "baseline",
                padding: "0 4px",
              }}
            >
              <span className="mono muted">The mirror / live preview</span>
              <span className="mono muted">4:5 · front-facing</span>
            </div>
            <MirrorStage studio={studio} />
          </div>
          <div className="studio-right">
            <ReadingPanel studio={studio} />
          </div>
        </div>
      </div>
    </div>
  );
}
