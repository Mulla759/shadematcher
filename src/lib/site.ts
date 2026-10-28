/** Public-facing site details used by the footer, privacy page and feedback links. */
export const SITE = {
  name: "Auriga",
  tagline: "Colour atelier",
  repo: "https://github.com/Mulla759/shadematcher",
  issues: "https://github.com/Mulla759/shadematcher/issues",
  /** Optional: set NEXT_PUBLIC_CONTACT_EMAIL to show a mail link. */
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "",
} as const;
