export interface StartupConfig {
  name: string;
  description: string;
  domain: string;
  logo: string; // URL to logo image
  founded: string; // e.g. "Jan 2025"
  stripeSecretKey: string;
}

export const STARTUPS: StartupConfig[] = [
  {
    name: "Honch",
    description: "The Web Analytics Platform that Speaks Human.",
    domain: "honch.io",
    logo: "https://honch.io/icon.svg",
    founded: "Feb 2026",
    stripeSecretKey: process.env.HONCH || "",
  },
]