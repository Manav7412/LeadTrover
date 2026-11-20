// Fills the database with FAKE demo data: 2 users, 10 companies, 30 contacts,
// 15 deals, activities and tasks. Run with:  npm run seed
// Safe to run again - it clears the old demo data first.
import { createClient } from "@supabase/supabase-js";
import { makeDemoActivities } from "./demo-activity.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing keys. Fill in .env.local first (see .env.example).");
  process.exit(1);
}
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

const PASSWORD = "LeadTrove-demo-1";
const DAY = 86_400_000;
const daysAgo = (n, hour = 10) => {
  const d = new Date(Date.now() - n * DAY);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};
// Positive n = in the future, negative = in the past (due dates for tasks)
const dueIn = (n, hour = 9) => daysAgo(-n, hour);

function must({ data, error }, what) {
  if (error) {
    console.error(`Failed: ${what}\n`, error.message);
    process.exit(1);
  }
  return data;
}

// ---------- 1. Users ----------
async function makeUser(email, fullName, role) {
  const { data: list } = await db.auth.admin.listUsers({ perPage: 200 });
  const existing = list?.users.find((u) => u.email === email);
  if (existing) await db.auth.admin.deleteUser(existing.id);
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) must({ error }, `create user ${email}`);
  // link the person to their role (the roles table exists once supabase/permissions.sql has been run)
  const { data: roleRows } = await db.from("roles").select("id, name");
  const roleId = roleRows?.find((r) => r.name === ({ owner: "Owner", rep: "Rep", viewer: "Viewer" }[role]))?.id;
  must(await db.from("profiles").insert({ id: data.user.id, full_name: fullName, email, role: role === "viewer" ? "rep" : role, ...(roleId ? { role_id: roleId } : {}) }), "profile " + email);
  return data.user.id;
}

console.log("Clearing old demo data...");
for (const t of ["lead_forms", "email_templates", "tasks", "activities", "deals", "contacts", "companies"]) {
  must(await db.from(t).delete().not("id", "is", null), "clear " + t);
}

console.log("Creating users...");
const manav = await makeUser("manav@leadtrove.demo", "Manav", "owner");
const alex = await makeUser("alex@leadtrove.demo", "Alex", "rep");
await makeUser("guest@leadtrove.demo", "Guest", "viewer"); // read-only login for the public demo button
const ownerOf = (i) => (i % 2 === 0 ? manav : alex);

// ---------- 2. Companies ----------
const companyRows = [
  ["Bright Smile Dental", "brightsmile.example", "Healthcare", "11-50"],
  ["Harbour Plumbing Co", "harbourplumbing.example", "Trades", "11-50"],
  ["Summit Fitness Studio", "summitfitness.example", "Fitness", "1-10"],
  ["Patel & Co Accounting", "patelaccounting.example", "Finance", "11-50"],
  ["Clarke Home Services", "clarkehome.example", "Home Services", "1-10"],
  ["Northside Realty Group", "northsiderealty.example", "Real Estate", "51-200"],
  ["Glow Skin Clinic", "glowskin.example", "Beauty", "1-10"],
  ["Turner Auto Care", "turnerauto.example", "Automotive", "11-50"],
  ["Hayes Law Partners", "hayeslaw.example", "Legal", "11-50"],
  ["Thompson Coaching", "thompsoncoaching.example", "Coaching", "1-10"],
];
const companies = must(
  await db
    .from("companies")
    .insert(companyRows.map(([name, website, industry, size], i) => ({ name, website, industry, size, owner_id: ownerOf(i) })))
    .select(),
  "companies"
);

// ---------- 3. Contacts (3 per company) ----------
// [first, last, status, source, tags, daysSinceCreated]
const people = [
  [["Sarah", "Mitchell", "qualified", "Website Form", ["hot", "new-lead"], 12], ["Tom", "Reyes", "contacted", "Referral", ["warm"], 20], ["Priya", "Shah", "new", "Facebook Ads", ["new-lead"], 2]],
  [["James", "Carter", "new", "Google Ads", ["new-lead"], 3], ["Liam", "O'Brien", "contacted", "Cold Outreach", ["follow-up"], 25], ["Nina", "Kovac", "lost", "Website Form", ["cold"], 60]],
  [["Daniel", "Brooks", "qualified", "Referral", ["hot", "call-booked"], 9], ["Maya", "Singh", "customer", "Instagram", ["client"], 70], ["Ben", "Foster", "new", "Facebook Ads", ["new-lead"], 1]],
  [["Noah", "Patel", "customer", "Referral", ["client", "onboarding"], 45], ["Grace", "Liu", "contacted", "LinkedIn", ["warm"], 16], ["Oscar", "Nguyen", "qualified", "LinkedIn", ["proposal-sent"], 14]],
  [["Ethan", "Clarke", "customer", "Referral", ["client", "live"], 90], ["Zoe", "Harris", "new", "Google Ads", ["new-lead"], 4], ["Callum", "Ross", "contacted", "Cold Outreach", ["follow-up"], 18]],
  [["Emma", "Wilson", "qualified", "Website Form", ["proposal-sent", "hot"], 11], ["Jack", "Morgan", "contacted", "Event", ["warm"], 22], ["Isla", "Murray", "new", "Instagram", ["new-lead"], 5]],
  [["Priya", "Nair", "contacted", "Instagram", ["warm", "contacted"], 15], ["Lucy", "Adams", "new", "Facebook Ads", ["new-lead"], 2], ["Hugo", "Bennett", "lost", "Cold Outreach", ["cold"], 55]],
  [["Liam", "Turner", "lost", "Google Ads", ["lost", "cold"], 48], ["Aisha", "Khan", "qualified", "Referral", ["hot"], 10], ["Felix", "Wright", "new", "Website Form", ["new-lead"], 1]],
  [["Olivia", "Hayes", "customer", "Referral", ["client", "onboarding"], 40], ["Marcus", "Webb", "contacted", "LinkedIn", ["follow-up"], 19], ["Sophie", "Tran", "new", "LinkedIn", ["new-lead"], 6]],
  [["Mia", "Thompson", "customer", "Event", ["client", "onboarding"], 38], ["Harry", "Quinn", "qualified", "Website Form", ["call-booked"], 8], ["Ella", "Moreno", "contacted", "Instagram", ["warm"], 13]],
];
const contactRows = [];
people.forEach((group, ci) =>
  group.forEach(([first, last, status, source, tags, age], pi) => {
    const domain = companyRows[ci][1];
    const n = ci * 3 + pi;
    contactRows.push({
      first_name: first,
      last_name: last,
      email: `${first}.${last}@${domain}`.toLowerCase().replace(/'/g, ""),
      phone: pi === 2 ? null : `+1 555 01${String(n).padStart(2, "0")}`,
      company_id: companies[ci].id,
      owner_id: ownerOf(n),
      source,
      status,
      tags,
      created_at: daysAgo(age),
    });
  })
);
const contacts = must(await db.from("contacts").insert(contactRows).select(), "contacts");
const contactByName = (first, last) => contacts.find((c) => c.first_name === first && c.last_name === last);

// ---------- 4. Deals ----------
const { data: stageRows } = await db.from("stages").select("id, name, pipeline_id, pipelines(name)");
const { data: pipelineRows } = await db.from("pipelines").select("id, name");
const pipe = (n) => pipelineRows.find((p) => p.name === n).id;
const stage = (pipeline, name) => stageRows.find((s) => s.pipelines.name === pipeline && s.name === name).id;

// [title, value, contact first, contact last, pipeline, stage, daysSinceCreated]
const dealDefs = [
  ["Bright Smile - website & ads package", 4800, "Sarah", "Mitchell", "Sales", "Meeting Booked", 8],
  ["Harbour Plumbing - lead gen retainer", 3200, "James", "Carter", "Sales", "New", 3],
  ["Summit Fitness - membership funnel", 5600, "Daniel", "Brooks", "Sales", "Proposal Sent", 7],
  ["Patel Accounting - CRM setup", 2400, "Grace", "Liu", "Sales", "Contacted", 14],
  ["Northside Realty - follow-up automation", 9500, "Emma", "Wilson", "Sales", "Proposal Sent", 10],
  ["Glow Skin - booking system", 1800, "Priya", "Nair", "Sales", "Contacted", 12],
  ["Turner Auto - reactivation campaign", 2200, "Liam", "Turner", "Sales", "Lost", 40],
  ["Hayes Law - intake automation", 6400, "Olivia", "Hayes", "Sales", "Won", 35],
  ["Thompson Coaching - course launch", 3900, "Harry", "Quinn", "Sales", "Meeting Booked", 6],
  ["Clarke Home - quote follow-up", 2750, "Zoe", "Harris", "Sales", "New", 4],
  ["Patel Accounting - onboarding", 3100, "Noah", "Patel", "Client Onboarding", "Kickoff Booked", 6],
  ["Thompson Coaching - onboarding", 4200, "Mia", "Thompson", "Client Onboarding", "Signed", 2],
  ["Clarke Home - onboarding", 2900, "Ethan", "Clarke", "Client Onboarding", "Live", 60],
  ["Summit Fitness - app onboarding", 3500, "Maya", "Singh", "Client Onboarding", "Setup in Progress", 30],
];
const dealRows = dealDefs.map(([title, value, f, l, pl, st, age]) => {
  const c = contactByName(f, l);
  return {
    title, value,
    contact_id: c.id, company_id: c.company_id, owner_id: c.owner_id,
    pipeline_id: pipe(pl), stage_id: stage(pl, st),
    status: st === "Won" ? "won" : st === "Lost" ? "lost" : "open",
    closed_at: st === "Won" ? daysAgo(6) : st === "Lost" ? daysAgo(12) : null,
    created_at: daysAgo(age),
  };
});
const insertedDeals = must(await db.from("deals").insert(dealRows).select("id, title"), "deals");

// The "deal Won -> onboarding deal" automation (supabase/automations.sql) has already created an
// onboarding deal for the Won deal. Move it along to "Setup in Progress" so the demo board looks lived-in.
// (If the automations script has not been run yet, create that deal by hand instead.)
{
  const won = insertedDeals.find((d) => d.title === "Hayes Law - intake automation");
  const hayes = contactByName("Olivia", "Hayes");
  const patch = { title: "Hayes Law - onboarding", stage_id: stage("Client Onboarding", "Setup in Progress"), created_at: daysAgo(25) };
  const { data: auto } = await db.from("deals").select("id").eq("source_deal_id", won.id).maybeSingle();
  if (auto) must(await db.from("deals").update(patch).eq("id", auto.id), "onboarding deal");
  else must(await db.from("deals").insert({ ...patch, value: 6400, contact_id: hayes.id, company_id: hayes.company_id, owner_id: hayes.owner_id, pipeline_id: pipe("Client Onboarding"), status: "open" }), "onboarding deal");
}

// ---------- 5. Activities ----------
// [first, last, type, outcome, notes, nextStep, daysAgo]
const actDefs = [
  ["Sarah", "Mitchell", "call", "Interested", "Wants a quote for a new site and Google Ads.", "Send proposal", 1],
  ["Sarah", "Mitchell", "meeting", "Positive", "Intro meeting, 30 mins. Team of 6, using spreadsheets today.", "Book follow-up demo", 5],
  ["James", "Carter", "email", "Sent", "Sent intro email with case study.", "Call on Thursday", 2],
  ["Daniel", "Brooks", "call", "Booked meeting", "Keen on a funnel for new members.", "Send proposal", 2],
  ["Daniel", "Brooks", "email", "Sent", "Sent proposal v1.", "Chase for reply", 4],
  ["Emma", "Wilson", "meeting", "Positive", "Walked through automation demo.", "Send contract", 3],
  ["Emma", "Wilson", "note", null, "Decision maker is the managing director. Budget approved.", null, 6],
  ["Grace", "Liu", "call", "No answer", "Left voicemail.", "Try again Monday", 9],
  ["Priya", "Nair", "email", "Sent", "Sent pricing sheet.", "Follow up by phone", 11],
  ["Liam", "Turner", "call", "Not interested", "Went with another provider.", null, 38],
  ["Olivia", "Hayes", "meeting", "Signed", "Contract signed, kickoff next week.", "Create onboarding deal", 26],
  ["Harry", "Quinn", "call", "Booked meeting", "Wants to see the course funnel.", "Prepare demo", 1],
  ["Zoe", "Harris", "email", "Sent", "Replied to web enquiry.", "Call tomorrow", 3],
  ["Noah", "Patel", "meeting", "Kickoff planned", "Agreed scope for CRM setup.", "Book kickoff", 5],
  ["Ethan", "Clarke", "note", null, "Client is live and happy. Possible upsell in Q1.", "Check in next month", 12],
  ["Tom", "Reyes", "call", "Left voicemail", null, "Try again next week", 10],
  ["Aisha", "Khan", "call", "Interested", "Referred by Olivia Hayes.", "Send intro email", 7],
  ["Callum", "Ross", "email", "No reply", "Second follow-up sent.", "Final nudge", 15],
];
const actRows = actDefs.map(([f, l, type, outcome, notes, next_step, ago]) => {
  const c = contactByName(f, l);
  return { contact_id: c.id, user_id: c.owner_id, type, outcome, notes, next_step, created_at: daysAgo(ago, 11) };
});
must(await db.from("activities").insert(actRows), "activities");

// Update "last activity" and stale flag on each contact
for (const c of contacts) {
  const latest = actRows.filter((a) => a.contact_id === c.id).map((a) => a.created_at).sort().pop();
  const last = latest ?? c.created_at;
  const stale = !["customer", "lost"].includes(c.status) && Date.now() - new Date(last).getTime() > 7 * DAY;
  must(await db.from("contacts").update({ last_activity_at: last, is_stale: stale }).eq("id", c.id), "contact update");
}

// More calls, emails and meetings over the last 30 days so the dashboard has something to show.
// Only contacts that are not stale get them, so the demo keeps its stale leads.
{
  const staleNow = new Set((await db.from("contacts").select("id").eq("is_stale", true)).data.map((c) => c.id));
  const eligible = contacts.filter((c) => !staleNow.has(c.id) && ["new", "contacted", "qualified"].includes(c.status));
  const extra = makeDemoActivities(eligible);
  must(await db.from("activities").insert(extra), "extra activities");
  const newest = new Map();
  for (const a of extra) if (!newest.has(a.contact_id) || a.created_at > newest.get(a.contact_id)) newest.set(a.contact_id, a.created_at);
  for (const [id, at] of newest) {
    const c = contacts.find((x) => x.id === id);
    const { data: cur } = await db.from("contacts").select("last_activity_at").eq("id", id).single();
    if (!cur.last_activity_at || at > cur.last_activity_at) must(await db.from("contacts").update({ last_activity_at: at }).eq("id", c.id), "last activity");
  }
  actRows.push(...extra);
}

// ---------- 6. Tasks ----------
// [title, first, last, due (days from today, negative = overdue), done]
const taskDefs = [
  ["Call Grace Liu - second attempt", "Grace", "Liu", -3, false],
  ["Chase Daniel Brooks about proposal", "Daniel", "Brooks", -2, false],
  ["Send final nudge to Callum Ross", "Callum", "Ross", -5, false],
  ["Follow up with Priya Nair on pricing", "Priya", "Nair", -1, false],
  ["Send proposal to Sarah Mitchell", "Sarah", "Mitchell", 0, false],
  ["Call James Carter", "James", "Carter", 0, false],
  ["Send contract to Emma Wilson", "Emma", "Wilson", 0, false],
  ["Prepare demo for Harry Quinn", "Harry", "Quinn", 1, false],
  ["Book kickoff with Noah Patel", "Noah", "Patel", 2, false],
  ["Send intro email to Aisha Khan", "Aisha", "Khan", 1, false],
  ["Check in with Ethan Clarke", "Ethan", "Clarke", 14, false],
  ["Call Tom Reyes back (left voicemail)", "Tom", "Reyes", -2, false],
  ["Send welcome pack to Mia Thompson", "Mia", "Thompson", -4, true],
  ["Intro call with Olivia Hayes", "Olivia", "Hayes", -20, true],
];
const taskRows = taskDefs.map(([title, f, l, due, done]) => {
  const c = contactByName(f, l);
  return { title, contact_id: c.id, assigned_to: c.owner_id, due_at: dueIn(due), done };
});
must(await db.from("tasks").insert(taskRows), "tasks");

// ---------- 7. Email templates ----------
must(
  await db.from("email_templates").insert([
    { name: "Intro email", subject: "Quick question, {{first_name}}", body: "Hi {{first_name}},\n\nI help teams like {{company}} keep track of every lead. Do you have 10 minutes this week?\n\nThanks,\n{{owner_name}}" },
    { name: "Proposal follow-up", subject: "Following up on our proposal", body: "Hi {{first_name}},\n\nJust checking you had a chance to look over the proposal. Happy to answer any questions.\n\n{{owner_name}}" },
    { name: "Meeting confirmation", subject: "Confirming our meeting", body: "Hi {{first_name}},\n\nConfirming our meeting. Let me know if anything changes.\n\n{{owner_name}}" },
    { name: "Meeting follow-up", subject: "Great speaking today, {{first_name}}", body: "Hi {{first_name}},\n\nThanks for your time today. As promised, I'll send over a summary for {{company}} by tomorrow.\n\nSpeak soon,\n{{sender_name}}" },
    { name: "Closing the loop", subject: "Should I close your file, {{first_name}}?", body: "Hi {{first_name}},\n\nI haven't heard back, so I'll assume the timing isn't right for {{company}}. If that changes, just reply to this email.\n\nAll the best,\n{{sender_name}}" },
  ]),
  "email templates"
);

// A ready-made public lead form (needs supabase/forms.sql to have been run)
must(
  await db.from("lead_forms").insert({
    name: "Website enquiry", slug: "contact-us", heading: "Talk to our team",
    description: "Tell us a little about what you need and we'll get back to you within one business day.",
    success_message: "Thanks! We've got your details and someone will be in touch within one business day.",
    tags: ["website", "new-lead"], source: "Website Form", default_owner_id: null,
  }),
  "lead form (run supabase/forms.sql first)"
);

const { count: dealCount } = await db.from("deals").select("id", { count: "exact", head: true });
const { count: taskCount } = await db.from("tasks").select("id", { count: "exact", head: true });
console.log(`
Done! Created 2 users, ${companies.length} companies, ${contacts.length} contacts, ${dealCount} deals,
${actRows.length} activities and ${taskCount} tasks.

Log in with:
  Owner:  manav@leadtrove.demo   /  ${PASSWORD}
  Rep:    alex@leadtrove.demo    /  ${PASSWORD}
`);
