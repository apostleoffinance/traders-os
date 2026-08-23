/** Illustrative product-example figures only. Not real user statistics. */

export const SAMPLE_LABEL = "Product example";

export const SAMPLE_EQUITY = [
  { t: "1", balance: 10000 },
  { t: "2", balance: 10018 },
  { t: "3", balance: 9986 },
  { t: "4", balance: 10042 },
  { t: "5", balance: 10071 },
  { t: "6", balance: 10038 },
  { t: "7", balance: 10112 },
  { t: "8", balance: 10094 },
  { t: "9", balance: 10147 },
  { t: "10", balance: 10129 },
  { t: "11", balance: 10188 },
  { t: "12", balance: 10214 },
];

export const SAMPLE_TRADES = [
  { symbol: "EURUSD", dir: "Long", r: "+1.20R", session: "London", result: "win" },
  { symbol: "GBPJPY", dir: "Short", r: "−0.80R", session: "Overlap", result: "loss" },
  { symbol: "NAS100", dir: "Long", r: "+0.90R", session: "NY", result: "win" },
  { symbol: "XAUUSD", dir: "Short", r: "+0.40R", session: "London", result: "win" },
] as const;

export const SAMPLE_EVIDENCE = [
  { label: "Expectancy", value: "+0.31R", tone: "pos" as const },
  { label: "Win rate", value: "58%", tone: "" as const },
  { label: "Risk after losses", value: "−34%", tone: "neg" as const, hint: "escalation" },
  { label: "London session", value: "+0.47R", tone: "pos" as const },
];

export const SAMPLE_LIMITS = [
  { label: "Daily risk", limit: "500", remaining: "310" },
  { label: "Max drawdown", limit: "2000", remaining: "1640" },
  { label: "Consecutive losses", limit: "4", remaining: "3" },
];
