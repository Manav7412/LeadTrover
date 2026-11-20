// Makes a believable spread of FAKE calls, emails and meetings over the last 30 days,
// so the dashboard charts have something to show. Same result every time (no randomness).
const DAY = 86_400_000;

function lcg(seed) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

const NOTES = {
  call: ["Quick check-in about pricing.", "Talked through the timeline.", "Discussed their current process.", "Answered questions about onboarding.", "Left a short voicemail."],
  email: ["Sent a follow-up with details.", "Shared the case study.", "Answered their question by email.", "Sent a short recap."],
  meeting: ["Walked through a live demo.", "Intro meeting with the team.", "Reviewed the proposal together."],
  note: ["Prefers contact in the morning.", "Mentioned a budget review next month.", "Referred by an existing client."],
};
const OUTCOMES = {
  call: ["Connected", "Connected", "No answer", "Left voicemail", "Booked meeting", "Interested"],
  email: ["Sent", "Sent", "Replied", "No reply"],
  meeting: ["Held", "Positive", "Held"],
  note: [null],
};

// eligible: contacts that should receive activity [{ id, owner_id }]
export function makeDemoActivities(eligible, days = 30) {
  const rand = lcg(42);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const rows = [];
  for (let d = 0; d < days; d++) {
    const when = new Date(Date.now() - d * DAY);
    const weekend = [0, 6].includes(when.getDay());
    const count = weekend ? Math.floor(rand() * 2) : 2 + Math.floor(rand() * 4);
    for (let i = 0; i < count; i++) {
      const c = pick(eligible);
      const r = rand();
      const type = r < 0.55 ? "call" : r < 0.8 ? "email" : r < 0.93 ? "meeting" : "note";
      const at = new Date(when);
      at.setHours(9 + Math.floor(rand() * 8), Math.floor(rand() * 60), 0, 0);
      if (at.getTime() > Date.now()) continue;
      rows.push({ contact_id: c.id, user_id: c.owner_id, type, outcome: pick(OUTCOMES[type]), notes: pick(NOTES[type]), next_step: null, created_at: at.toISOString() });
    }
  }
  return rows;
}
