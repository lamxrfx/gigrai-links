// Where the automatic news comes from. To add a source: copy a line, give it a short id,
// the name shown on the site, its RSS/Atom feed address and a category.
// filter: true  = broad feed, only keep stories that mention AI, remote work, gig work etc.
// require: /.../ = only keep stories matching this pattern (for very broad feeds)
export const CATEGORIES = [
  { id: "ai", name: "AI news" },
  { id: "ai-work", name: "AI work & pay" },
  { id: "remote", name: "Remote work" },
  { id: "scams", name: "Scams & safety" },
];

export const RELEVANT = /\b(AI|A\.I\.|artificial intelligence|LLMs?|chatbots?|OpenAI|ChatGPT|Anthropic|Claude|Gemini|DeepMind|machine learning|remote work|work from home|working from home|remote jobs?|hybrid work|freelanc\w*|gig (work|economy|workers?)|side hustle|contractors?|data annotation|data label\w*|AI train\w*|RLHF|Mercor|Scale AI|Surge AI|micro1|Outlier|Turing|Handshake|job scams?|recruitment scams?|task scams?|fake job)\b/i;

const HN = (q) => `https://hnrss.org/newest?q=${encodeURIComponent(q)}&points=3`;

export const SOURCES = [
  // AI news
  { id: "techcrunch-ai", name: "TechCrunch", url: "https://techcrunch.com/category/artificial-intelligence/feed/", cat: "ai" },
  { id: "verge-ai", name: "The Verge", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", cat: "ai" },
  { id: "ars", name: "Ars Technica", url: "https://arstechnica.com/feed/", cat: "ai", filter: true },
  { id: "mittr-ai", name: "MIT Technology Review", url: "https://www.technologyreview.com/topic/artificial-intelligence/feed", cat: "ai" },
  { id: "guardian-ai", name: "The Guardian", url: "https://www.theguardian.com/technology/artificialintelligenceai/rss", cat: "ai" },
  { id: "bbc-tech", name: "BBC News", url: "https://feeds.bbci.co.uk/news/technology/rss.xml", cat: "ai", filter: true },
  { id: "openai", name: "OpenAI", url: "https://openai.com/news/rss.xml", cat: "ai" },
  { id: "deepmind", name: "Google DeepMind", url: "https://deepmind.google/blog/rss.xml", cat: "ai" },
  { id: "google-ai", name: "Google", url: "https://blog.google/innovation-and-ai/technology/ai/rss/", cat: "ai" },
  // The AI training work industry (Hacker News searches for each company)
  { id: "hn-mercor", name: "Hacker News", url: HN("Mercor"), cat: "ai-work" },
  { id: "hn-scale", name: "Hacker News", url: HN('"Scale AI"'), cat: "ai-work" },
  { id: "hn-micro1", name: "Hacker News", url: HN("micro1"), cat: "ai-work" },
  { id: "hn-annotation", name: "Hacker News", url: HN('"data annotation"'), cat: "ai-work" },
  // Remote work
  { id: "hiringlab", name: "Indeed Hiring Lab", url: "https://www.hiringlab.org/feed/", cat: "remote", filter: true },
  { id: "buffer", name: "Buffer", url: "https://buffer.com/resources/feed", cat: "remote", require: /\b(remote|work from home|working from home|four-day|4-day|async|hybrid|distributed)\b/i },
  // Scams and safety
  { id: "ftc-alerts", name: "FTC Consumer Alerts", url: "https://consumer.ftc.gov/blog/gd-rss.xml", cat: "scams", require: /\b(job|work|employ|task|recruit|gig|remote|hiring)\w*/i },
  { id: "guardian-security", name: "The Guardian", url: "https://www.theguardian.com/technology/data-computer-security/rss", cat: "scams", require: /\b(scam|fraud|phishing|fake)\w*/i },
];
