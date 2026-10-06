export type MarketingCampaign = {
  summary: string;
  headline: string;
  subtitle: string;
  body: string;
  subject: string;
  preheader: string;
  imageBrief: string; layout: "left" | "right" | "wide";
  reviewNotes: string[];
};