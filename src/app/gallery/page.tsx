import type { Metadata } from "next";
import { GalleryStudio } from "@/components/gallery/GalleryStudio";

export const metadata: Metadata = {
  title: "Auriga — Fabric gallery",
  description:
    "Every scraped textile colourway and Auriga colour in one place, with filters and a place to write down how each cloth feels in person.",
};

export default function GalleryPage() {
  return <GalleryStudio />;
}
