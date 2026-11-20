export const ACTIVITY_TYPES = ["call", "email", "meeting", "note"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

// Outcome choices shown for each kind of activity (notes have no outcome).
export const OUTCOMES: Record<ActivityType, string[]> = {
  call: ["Connected", "Interested", "Booked meeting", "No answer", "Left voicemail", "Not interested", "Wrong number"],
  email: ["Sent", "Replied", "No reply", "Bounced"],
  meeting: ["Held", "Positive", "Rescheduled", "No-show"],
  note: [],
};

export const TYPE_LABEL: Record<ActivityType, string> = { call: "Call", email: "Email", meeting: "Meeting", note: "Note" };

export const TYPE_ICON: Record<ActivityType, string> = {
  call: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z",
  email: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6",
  meeting: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  note: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
};
