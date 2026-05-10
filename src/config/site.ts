export const site = {
  name: "Americans for Propriety",
  short: "AfP",
  tagline: "Power with limits. Policy with purpose.",
  url: "https://americansforpropriety.org",
  mission:
    "Americans for Propriety is a civic project advancing public policy that respects democratic limits, serves the common good, and treats public power as a trust — not a tool of private fortune.",
  description:
    "A research and action project for civic propriety in American public life: policy that respects limits, serves people, and answers to the public.",
} as const;

export const nav = [
  { href: "/issues", label: "Issues" },
  { href: "/briefs", label: "Briefs" },
  { href: "/letters", label: "Letters" },
  { href: "/news", label: "News" },
  { href: "/about", label: "About" },
] as const;

export const issueOrder = [
  "economy-and-tax-fairness",
  "labor-and-wages",
  "healthcare",
  "housing",
  "education",
  "reproductive-rights",
  "climate-and-energy",
  "democracy-and-voting",
  "civil-rights-and-immigration",
  "foreign-policy-and-war-powers",
  "disability-justice",
  "indigenous-sovereignty",
  "veterans-and-service-members",
  "tech-and-data-rights",
] as const;

// On the home page, surface a curated subset; the full list lives at /issues.
export const homepageIssueOrder = [
  "economy-and-tax-fairness",
  "labor-and-wages",
  "healthcare",
  "housing",
  "reproductive-rights",
  "climate-and-energy",
  "democracy-and-voting",
  "civil-rights-and-immigration",
  "foreign-policy-and-war-powers",
] as const;
