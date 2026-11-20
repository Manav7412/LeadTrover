// Quotes and fun facts for the welcome page. One of each is shown per day.
// Quotes without a well-known author are credited as sayings, not to a named person.

export type Quote = { text: string; author: string };

export const QUOTES: Quote[] = [
  { text: "The fortune is in the follow-up.", author: "Sales proverb" },
  { text: "You can have everything in life you want, if you will just help enough other people get what they want.", author: "Zig Ziglar" },
  { text: "Pretend that every single person you meet has a sign around their neck that says, 'Make me feel important.'", author: "Mary Kay Ash" },
  { text: "Make every lead feel like the only lead, and never leave one without a next step.", author: "LeadTrove" },
  { text: "People don't buy because they are convinced. They buy because they are heard.", author: "Sales saying" },
  { text: "A pipeline is only as strong as the follow-up behind it.", author: "Sales saying" },
  { text: "Pipeline problems are usually follow-up problems in disguise.", author: "LeadTrove" },
];

export const FUN_FACTS: string[] = [
  "The Rolodex, the contact book of the 1950s, was invented in 1956 by Arnold Neustadter. It was the original CRM.",
  "The sales funnel idea goes back to 1898, when E. St. Elmo Lewis described customers moving through Attention, Interest, Desire and Action.",
  "VisiCalc, the first popular spreadsheet, launched in 1979. Sales teams have been outgrowing spreadsheets ever since.",
  "Salesforce launched in 1999 with a bold pitch for its time: business software with nothing to install, delivered through a website.",
  "'Always Be Closing' became famous from the 1992 film Glengarry Glen Ross, and most modern sales teams have moved on to 'always be helping'.",
  "Many sales trainers say most deals need several follow-ups to close, but most reps give up after one or two. That gap is what LeadTrove is built for.",
  "Business development is often called the 'first mile' of sales: finding and warming up the opportunities that salespeople later close.",
];

// Same quote and fact all day, then it moves on tomorrow.
export function todaysPick() {
  const day = Math.floor(Date.now() / 86_400_000);
  return { quote: QUOTES[day % QUOTES.length], fact: FUN_FACTS[day % FUN_FACTS.length] };
}
