export interface Founder {
  name: string;
  photo: string; // URL to headshot
  linkedin: string; // LinkedIn profile URL
}

export interface StartupConfig {
  name: string;
  description: string;
  domain: string;
  logo: string; // URL to logo image
  founded: string; // e.g. "Jan 2025"
  founders: Founder[];
  stripeSecretKey: string;
}

export const STARTUPS: StartupConfig[] = [
  {
    name: "Honch",
    description: "The Web Analytics Platform that Speaks Human.",
    domain: "honch.io",
    logo: "https://honch.io/icon.svg",
    founded: "Feb 2026",
    founders: [
      {
        name: "Wes Harvell",
        photo: "https://media.licdn.com/dms/image/v2/D5603AQGgpVs6CfhwXg/profile-displayphoto-scale_200_200/B56ZvsbBVHK4AY-/0/1769198065570?e=1774483200&v=beta&t=CMKQ8ueRQ93pNJ_2hVN0UEEJDxrHiIDOyzjsngthiJ0",
        linkedin: "https://linkedin.com/in/wesharvell",
      },
    ],
    stripeSecretKey: process.env.HONCH || "",
  },
]