export const formatMoney = (n: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(n);

export type StageOutcome = "open" | "won" | "lost";

export type BoardDeal = {
  id: string;
  title: string;
  value: number;
  stage_id: string;
  contactName: string;
  companyName: string;
  ownerName: string;
  createdAt: string;
};
// A deal's status follows the type ("outcome") of the stage it sits in.
export type BoardStage = { id: string; name: string; outcome: StageOutcome };
