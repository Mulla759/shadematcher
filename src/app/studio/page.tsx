import type { Metadata } from "next";
import { Studio } from "@/components/studio/Studio";

export const metadata: Metadata = {
  title: "Studio — Auriga",
  description:
    "Live skin reading, fabric colour matching and a landmark-anchored hijab preview.",
};

export default function StudioPage() {
  return <Studio />;
}
