import type { Metadata } from "next";
import { ToneLab } from "@/components/lab/ToneLab";

export const metadata: Metadata = {
  title: "Lab — Raw tone capability",
  description:
    "Open the webcam, run a 478-point face mesh on-device, and print a stable CIELAB skin reading.",
};

export default function LabPage() {
  return <ToneLab />;
}
