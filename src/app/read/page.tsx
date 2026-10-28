import type { Metadata } from "next";
import { ShadeStudio } from "@/components/shade/ShadeStudio";

export const metadata: Metadata = {
  title: "Auriga — Read your tone. Find your colour.",
  description:
    "A local-first shade reading: a face guide, CIELAB skin reading, and an open search across 5,498 scraped textile colourways.",
};

export default function ReadPage() {
  return <ShadeStudio />;
}
