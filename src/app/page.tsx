import type { Metadata } from "next";
import { AtelierLanding } from "@/components/landing/AtelierLanding";

export const metadata: Metadata = {
  title: "Auriga — Find the colours that suit your face.",
  description:
    "Auriga reads your skin tone and searches 5,498 real scarves and fabrics for the colours that will look best near your face.",
};

export default function HomePage() {
  return <AtelierLanding />;
}
