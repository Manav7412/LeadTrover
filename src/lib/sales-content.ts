// Quotes and fun facts for the welcome page. One of each is shown per day.
// Quotes without a well-known author are credited as sayings, not to a named person.

import { dateInput } from "./dates";

export type Quote = { text: string; author: string };

export const QUOTES: Quote[] = [
  { text: "The fortune is in the follow-up.", author: "Sales proverb" },
  { text: "You can have everything in life you want, if you will just help enough other people get what they want.", author: "Zig Ziglar" },
  { text: "Pretend that every single person you meet has a sign around their neck that says, 'Make me feel important.'", author: "Mary Kay Ash" },
  { text: "Make every lead feel like the only lead, and never leave one without a next step.", author: "LeadTrove" },
  { text: "People don't buy because they are convinced. They buy because they are heard.", author: "Sales saying" },
  { text: "A pipeline is only as strong as the follow-up behind it.", author: "Sales saying" },
  { text: "Pipeline problems are usually follow-up problems in disguise.", author: "LeadTrove" },
  { text: "Seek first to understand, then to be understood.", author: "Stephen R. Covey" },
  { text: "A follow-up scheduled is a deal protected.", author: "LeadTrove" },
  { text: "Speed to lead wins: the first person to reply usually gets the conversation.", author: "Sales saying" },
  { text: "Ask a better question and the prospect will sell themselves.", author: "Sales saying" },
  { text: "No lead is cold if you were the last one to be useful.", author: "LeadTrove" },
  { text: "Every 'not now' is a 'maybe later'. Put a date on it.", author: "LeadTrove" },
  { text: "Listen twice as much as you talk. You have two ears and one mouth for a reason.", author: "Sales saying" },
  { text: "A lead without an owner is a lead nobody is working.", author: "LeadTrove" },
  { text: "Today's follow-up is tomorrow's referral.", author: "Sales saying" },
  { text: "Clear notes today save a confused call next week.", author: "LeadTrove" },
  { text: "Small daily habits close bigger deals than occasional heroics.", author: "Sales saying" },
  { text: "Your best next customer is probably already in your contacts.", author: "Sales saying" },
  { text: "Done is better than perfect, especially for the follow-up email.", author: "Sales saying" },
  { text: "Know what happens next, and make sure the customer knows it too.", author: "LeadTrove" },
  { text: "Trust is built in the follow-through.", author: "Sales saying" },
  { text: "Quiet leads are not lost leads. They are waiting for a reason to reply.", author: "LeadTrove" },
  { text: "The best time to log the call is right after the call.", author: "LeadTrove" },
  { text: "Hope is not a pipeline strategy. A scheduled next step is.", author: "Sales saying" },
];

export const FUN_FACTS: string[] = [
  "The Rolodex, the contact book of the 1950s, was invented in 1956 by Arnold Neustadter. It was the original CRM.",
  "The sales funnel idea goes back to 1898, when E. St. Elmo Lewis described customers moving through Attention, Interest, Desire and Action.",
  "VisiCalc, the first popular spreadsheet, launched in 1979. Sales teams have been outgrowing spreadsheets ever since.",
  "Salesforce launched in 1999 with a bold pitch for its time: business software with nothing to install, delivered through a website.",
  "'Always Be Closing' became famous from the 1992 film Glengarry Glen Ross, and most modern sales teams have moved on to 'always be helping'.",
  "Many sales trainers say most deals need several follow-ups to close, but most reps give up after one or two. That gap is what LeadTrove is built for.",
  "Business development is often called the 'first mile' of sales: finding and warming up the opportunities that salespeople later close.",
  "The first email was sent by Ray Tomlinson in 1971, and he chose the @ symbol to separate the user's name from the computer's name.",
  "Alexander Graham Bell made the first telephone call on 10 March 1876, saying: \"Mr. Watson, come here, I want to see you.\"",
  "Toll-free 800 numbers were introduced by AT&T in 1967, so customers could call businesses without paying for the call.",
  "The 80/20 rule is named after the economist Vilfredo Pareto, who noticed that about 80% of Italy's land was owned by 20% of the people.",
  "The first product ever scanned with a barcode at a checkout was a pack of Wrigley's chewing gum, in 1974.",
  "The first banner ad appeared on the HotWired website in 1994.",
  "One of the first things ever bought online was a Sting CD, sold through a website called NetMarket in 1994.",
  "The mechanical cash register was invented by James Ritty, a saloon owner in Dayton, Ohio, in 1879, to stop employees from pocketing money.",
  "The US National Do Not Call Registry opened in 2003, which is why modern outreach leans on permission and relevance.",
  "The word 'spam' for junk email comes from a Monty Python sketch in which the word is repeated over and over.",
  "Dale Carnegie's book How to Win Friends and Influence People was published in 1936 and is still read by salespeople today.",
  "Post-it Notes went on sale across the United States in 1980, after years of development at 3M.",
  "Gmail launched on 1 April 2004, and many people first thought it was an April Fools' joke because of its 1 GB of storage.",
  "Amazon began in 1994 as an online bookstore, long before it sold almost everything else.",
  "HubSpot was founded in 2005 and helped make the idea of inbound marketing popular: attract customers instead of chasing them.",

];

// Same quote and fact all day, then both move on at midnight in the team's time zone.
// The two lists have different lengths, so the pairs keep changing instead of repeating together.
export function todaysPick(now = new Date()) {
  const day = Math.floor(Date.parse(dateInput(0, now) + "T00:00:00Z") / 86_400_000);
  return { quote: QUOTES[day % QUOTES.length], fact: FUN_FACTS[day % FUN_FACTS.length] };
}
