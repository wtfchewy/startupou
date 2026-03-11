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
  metered?: boolean; // true if this startup uses usage-based billing
}

export const STARTUPS: StartupConfig[] = [
  {
    name: "Honch",
    description: "Analytics that ships fixes, not charts.",
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
    metered: true,
  },
  {
    name: "Sckry",
    description: "Everyone you have ever known in one place.",
    domain: "sckry.com",
    logo: "https://app.sckry.com/icon.svg",
    founded: "Sep 2025",
    founders: [
      {
        name: "Raeed Zainuddin",
        photo: "https://media.licdn.com/dms/image/v2/D5603AQF2SNHA76sOzw/profile-displayphoto-scale_200_200/B56ZwfrVLNIwAc-/0/1770057978994?e=1775088000&v=beta&t=hzlk8D5ahK7NnvS5jieGlKNBWYFb3cndrS66sxn3YNA",
        linkedin: "https://linkedin.com/in/raeedz",
      },
      {
        name: "Leon Matos",
        photo: "https://media.licdn.com/dms/image/v2/D4E03AQEguNhNV__q4g/profile-displayphoto-scale_400_400/B4EZv4YFVMIIAg-/0/1769398622004?e=1775088000&v=beta&t=FBXsdRn9EhllmLH_hAftzlclZc72w110WYMYodPW30o",
        linkedin: "https://linkedin.com/in/leonmatos",
      },
    ],
    stripeSecretKey: process.env.SCKRY || "",
    metered: false,
  },
  {
    name: "Sabbath",
    description: "One workflow. Every weekly asset your church needs — written, visual, and internal — powered by AI.",
    domain: "sabbathsystems.com",
    logo: "https://sabbathsystems.com/assets/sabbath-icon-new-sVa-Yf8f.png",
    founded: "Feb 2026",
    founders: [
      {
        name: "Steve Connell",
        photo: "https://sabbathsystems.com/assets/founder-steve-B3UhDzld.png",
        linkedin: "https://www.linkedin.com/in/steve-connell-7b03aa32b/?lipi=urn%3Ali%3Apage%3Ad_flagship3_profile_view_base%3BCcgg6%2B77QbOB7YTIY6FNdg%3D%3D",
      },
    ],
    stripeSecretKey: process.env.SABBATH || "",
    metered: false,
  },
]