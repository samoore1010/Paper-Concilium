export type AgeGroup = "young-adult" | "middle-aged" | "senior";
export type PoliticalLeaning = "progressive" | "moderate" | "conservative";
export type Profession = "tech" | "legal" | "finance" | "education" | "healthcare" | "trades";
export type CommunicationStyle = "analytical" | "emotional" | "skeptical" | "supportive" | "blunt";
export type ReactionType = "nod" | "shake" | "think" | "smile" | "frown" | "raised-hand" | "speaking" | "neutral";

export interface Persona {
  id: string;
  name: string;
  age: number;
  ageGroup: AgeGroup;
  gender: string;
  ethnicity: string;
  profession: Profession;
  politicalLeaning: PoliticalLeaning;
  communicationStyle: CommunicationStyle;
  bio: string;
  archetype: string;
  archetypeSource: string;
  disclaimer: string;
  priorities: string[];
  pet_peeves: string[];
  skinTone: string;
  hairColor: string;
  hairStyle: "short" | "long" | "bald" | "curly" | "ponytail" | "bob";
  accessory?: "glasses" | "hat" | "earrings" | "bowtie" | "headscarf";
  shirtColor: string;
}

export const ARCHETYPE_DISCLAIMER = "Characters are original archetypes inspired by public communication styles. They are not impersonations of any real individual.";

export const PERSONA_LIBRARY: Persona[] = [
  {
    id: "maria-chen",
    name: "Maria Chen",
    age: 34,
    ageGroup: "young-adult",
    gender: "Female",
    ethnicity: "Asian American",
    profession: "tech",
    politicalLeaning: "progressive",
    communicationStyle: "analytical",
    bio: "Senior product manager at a Bay Area startup. Data-driven decision maker who values clear metrics and scalable thinking.",
    archetype: "The Metrics-Driven Strategist",
    archetypeSource: "product management frameworks and startup evaluation methodologies",
    disclaimer: "An original character embodying analytical, data-driven evaluation patterns common in tech product management.",
    priorities: ["data-backed claims", "scalability", "user impact", "innovation"],
    pet_peeves: ["vague claims", "no metrics", "buzzword overload"],
    skinTone: "#f0c08a",
    hairColor: "#1a1a2e",
    hairStyle: "long",
    accessory: "glasses",
    shirtColor: "#3b82f6",
  },
  {
    id: "james-wilson",
    name: "James Wilson",
    age: 58,
    ageGroup: "senior",
    gender: "Male",
    ethnicity: "White",
    profession: "finance",
    politicalLeaning: "conservative",
    communicationStyle: "skeptical",
    bio: "Retired CFO with 30 years on Wall Street. Believes in proven fundamentals and is wary of hype cycles.",
    archetype: "The Fiscal Skeptic",
    archetypeSource: "corporate finance evaluation practices and investor due diligence patterns",
    disclaimer: "An original character embodying the rigorous financial scrutiny common among seasoned corporate finance professionals.",
    priorities: ["ROI", "risk management", "profitability", "proven track record"],
    pet_peeves: ["unrealistic projections", "ignoring risks", "dismissing tradition"],
    skinTone: "#f5d0b0",
    hairColor: "#a0a0a0",
    hairStyle: "short",
    accessory: "glasses",
    shirtColor: "#1e3a5f",
  },
  {
    id: "aisha-johnson",
    name: "Aisha Johnson",
    age: 42,
    ageGroup: "middle-aged",
    gender: "Female",
    ethnicity: "Black",
    profession: "legal",
    politicalLeaning: "moderate",
    communicationStyle: "blunt",
    bio: "Partner at a mid-size law firm specializing in corporate litigation. Values precision, logical structure, and strong evidence.",
    archetype: "The Textualist Interrogator",
    archetypeSource: "litigation cross-examination techniques and legal argumentation standards",
    disclaimer: "An original character embodying the rigorous logical scrutiny and blunt directness found in experienced trial attorneys.",
    priorities: ["logical structure", "evidence quality", "credibility", "precedent"],
    pet_peeves: ["emotional manipulation", "weak evidence", "circular reasoning"],
    skinTone: "#8d5524",
    hairColor: "#1a1a1a",
    hairStyle: "curly",
    accessory: "earrings",
    shirtColor: "#7c3aed",
  },
  {
    id: "carlos-reyes",
    name: "Carlos Reyes",
    age: 27,
    ageGroup: "young-adult",
    gender: "Male",
    ethnicity: "Latino",
    profession: "education",
    politicalLeaning: "progressive",
    communicationStyle: "emotional",
    bio: "High school teacher and community organizer. Passionate about equity, accessibility, and real-world impact on everyday people.",
    archetype: "The Empathetic Questioner",
    archetypeSource: "community organizing principles and equity-centered evaluation frameworks",
    disclaimer: "An original character embodying the community-impact focus and passionate advocacy common in grassroots education and organizing.",
    priorities: ["social impact", "accessibility", "community benefit", "authenticity"],
    pet_peeves: ["elitism", "ignoring underserved communities", "corporate jargon"],
    skinTone: "#c68642",
    hairColor: "#2d1b00",
    hairStyle: "short",
    shirtColor: "#16a34a",
  },
  {
    id: "patricia-omalley",
    name: "Patricia O'Malley",
    age: 65,
    ageGroup: "senior",
    gender: "Female",
    ethnicity: "White",
    profession: "healthcare",
    politicalLeaning: "moderate",
    communicationStyle: "supportive",
    bio: "Semi-retired nurse practitioner who ran community health clinics. Values empathy, practical solutions, and honest communication.",
    archetype: "The Practical Mentor",
    archetypeSource: "community healthcare communication patterns and patient-centered evaluation",
    disclaimer: "An original character embodying the supportive yet practical communication style found in experienced healthcare professionals.",
    priorities: ["practical impact", "honesty", "empathy", "feasibility"],
    pet_peeves: ["over-promising", "dismissing concerns", "lack of empathy"],
    skinTone: "#fde7d2",
    hairColor: "#c4a882",
    hairStyle: "bob",
    shirtColor: "#ec4899",
  },
  {
    id: "dev-patel",
    name: "Dev Patel",
    age: 45,
    ageGroup: "middle-aged",
    gender: "Male",
    ethnicity: "South Asian",
    profession: "trades",
    politicalLeaning: "conservative",
    communicationStyle: "blunt",
    bio: "Owns a successful HVAC business with 20 employees. Self-made, values hard work, practical skills, and fiscal responsibility.",
    archetype: "The Bootstrap Pragmatist",
    archetypeSource: "small business ownership principles and self-made entrepreneur evaluation patterns",
    disclaimer: "An original character embodying the no-nonsense, ROI-focused mindset common among self-made small business owners.",
    priorities: ["cost-effectiveness", "practical utility", "common sense", "self-reliance"],
    pet_peeves: ["academic jargon", "impractical ideas", "government overreach"],
    skinTone: "#b07830",
    hairColor: "#1a1a1a",
    hairStyle: "short",
    accessory: "hat",
    shirtColor: "#ea580c",
  },
];

export function getPersonasByFilter(filters: {
  ageGroup?: AgeGroup;
  politicalLeaning?: PoliticalLeaning;
  profession?: Profession;
}): Persona[] {
  return PERSONA_LIBRARY.filter((p) => {
    if (filters.ageGroup && p.ageGroup !== filters.ageGroup) return false;
    if (filters.politicalLeaning && p.politicalLeaning !== filters.politicalLeaning) return false;
    if (filters.profession && p.profession !== filters.profession) return false;
    return true;
  });
}
