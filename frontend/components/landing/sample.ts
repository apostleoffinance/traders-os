/** Illustrative product-example figures only. Not real user statistics. */

export const SAMPLE_LABEL = "Product example";

export const SAMPLE_EQUITY = [
  { t: "1", balance: 20000 },
  { t: "2", balance: 20140 },
  { t: "3", balance: 19980 },
  { t: "4", balance: 20420 },
  { t: "5", balance: 20710 },
  { t: "6", balance: 20580 },
  { t: "7", balance: 20940 },
  { t: "8", balance: 21120 },
  { t: "9", balance: 21380 },
  { t: "10", balance: 21240 },
  { t: "11", balance: 21510 },
  { t: "12", balance: 21643 },
];

export const SAMPLE_TRADES = [
  { symbol: "EURUSD", dir: "Long", r: "+1.20R", session: "London", result: "win" },
  { symbol: "XAUUSD", dir: "Short", r: "−0.80R", session: "Overlap", result: "loss" },
  { symbol: "GBPUSD", dir: "Long", r: "+0.90R", session: "NY", result: "win" },
  { symbol: "USDJPY", dir: "Short", r: "+0.40R", session: "London", result: "win" },
] as const;

export const SAMPLE_EVIDENCE = [
  { label: "Expectancy", value: "+0.31R", tone: "pos" as const },
  { label: "Win rate", value: "63%", tone: "" as const },
  { label: "Profit factor", value: "1.89", tone: "pos" as const },
  { label: "London session", value: "+0.47R", tone: "pos" as const, hint: "edge" },
];

export const SAMPLE_LIMITS = [
  { label: "Daily risk", limit: "500", remaining: "310" },
  { label: "Max drawdown", limit: "2000", remaining: "1640" },
  { label: "Consecutive losses", limit: "4", remaining: "3" },
];

export const FEATURE_HIGHLIGHTS = [
  {
    title: "Auto Trade Sync",
    subtitle: "MT5 & Brokers",
    body: "Pull closed trades into your journal with TraderOSSync — less manual entry, more complete history.",
  },
  {
    title: "Advanced Analytics",
    subtitle: "Performance Insights",
    body: "Analytics Lab goes from essentials to deep dive: expectancy, sessions, edge, behaviour, and execution.",
  },
  {
    title: "Quant Lab",
    subtitle: "Test Your Edge",
    body: "Run structured studies on your own data — distributions, streaks, and research-grade views when the sample supports it.",
  },
  {
    title: "AI Intelligence",
    subtitle: "Smarter Decisions",
    body: "Intelligence Feed and AI coaching interpret deterministic patterns. No buy/sell signals — evidence first.",
  },
] as const;
