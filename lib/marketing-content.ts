import { APP } from "@/lib/settlor-config";
import { SETTLEMENT_CHAIN_LABEL } from "@/lib/solana-config";

export const SITE = {
  name: APP.name,
  tagline: APP.tagline,
  description: APP.description,
};

export const NAV_LINKS = [
  { href: "/#product", label: "Product" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/#for-payers", label: "For payers" },
  { href: "/#platform-metrics", label: "Metrics" },
  { href: "/about", label: "About" },
  { href: "/help", label: "Help" },
] as const;

export const TRUST_PARTNERS = [
  { name: "Circle", detail: "Programmable Wallets" },
  { name: "Solana", detail: "Unified settlement" },
  { name: "CCTP", detail: "Cross-chain USDC" },
  { name: "Google", detail: "Secure sign-in" },
];

export const HERO = {
  eyebrow: "Built for crypto-native businesses",
  title: "Invoice in USDC. Settle on Solana.",
  subtitle: `${APP.name} gives freelancers, agencies, and Web3 teams one place to send invoices, collect USDC from Ethereum, Base, Arbitrum, and more — and settle everything into a single Solana balance.`,
  ctaPrimary: "Get started free",
  ctaSecondary: "See how it works",
};

export const STATS = [
  { value: "1", label: "Solana balance", hint: "All payments land in your Circle wallet" },
  { value: "5+", label: "Source chains", hint: "Bridge or pay from major testnets" },
  { value: "0", label: "Manual reconciliation", hint: "Status, pay links, and email in one flow" },
];

export const PRODUCT_FEATURES = [
  {
    title: "Professional invoices",
    description:
      "Line items, quantities, due dates, notes, and auto-generated invoice numbers. Share a pay link or email the bill directly to your client.",
    points: ["Draft or send immediately", "PDF-ready invoice numbers", "Resend-friendly pay URLs"],
  },
  {
    title: "Cross-chain collection",
    description:
      "Payers use MetaMask on the chain where their USDC already lives. Circle CCTP routes funds to Solana — no manual bridging in email threads.",
    points: [
      "Ethereum, Base, Arbitrum, Avalanche testnets",
      `Direct ${SETTLEMENT_CHAIN_LABEL} payments via Phantom`,
      "Clear step-by-step payer guidance",
    ],
  },
  {
    title: "Solana wallet balance",
    description: `Every payment credits your Circle programmable wallet on ${SETTLEMENT_CHAIN_LABEL}. Bridge in from external chains or pay invoices from your Settlor balance when logged in.`,
    points: [
      "Real-time USDC balance",
      "Withdraw to external testnets",
      "Copy Solana address for native USDC receives",
    ],
  },
  {
    title: "To pay & sent views",
    description:
      "Separate views for bills you owe and invoices you issued. Match payees by wallet, email, or Google account so nothing gets lost after sign-in.",
    points: ["To pay inbox for received bills", "Sent tab with pay link copy", "Status filters: pending, paid, overdue"],
  },
  {
    title: "Email notifications",
    description:
      "Clients receive invoice emails with amount, due date, and a one-click pay link. You get clarity when it's time to follow up.",
    points: ["Powered by Resend", "Sandbox-friendly for development", "Paid / pending at a glance"],
  },
  {
    title: "Secure sessions",
    description:
      "Google sign-in with Circle W3S. Session tokens are encrypted server-side; payers can settle public invoices without creating an account.",
    points: ["HttpOnly cookies", "Encrypted Circle credentials", "Public pay pages via secure tokens"],
  },
];

export const HOW_IT_WORKS_STEPS = [
  {
    step: "01",
    title: "Sign in & get your Solana wallet",
    body: `Use Google to create your Circle programmable wallet on ${SETTLEMENT_CHAIN_LABEL}. Your dashboard shows balance, invoices, and payments immediately.`,
  },
  {
    step: "02",
    title: "Create & send an invoice",
    body: "Add line items, set a due date, and send to your client's email or wallet. They receive a pay link — no Settlor account required to pay.",
  },
  {
    step: "03",
    title: "Client pays from their chain",
    body: "They connect MetaMask or Phantom, pick where their USDC lives, and confirm a guided flow. Funds settle to your Solana address via CCTP.",
  },
  {
    step: "04",
    title: "You see it on Solana",
    body: "The invoice marks paid with transaction reference. Your USDC balance updates; activity and overview charts reflect the payment.",
  },
];

export const USER_PATHS = {
  vendors: {
    title: "For vendors & creators",
    items: [
      "Send invoices and track sent vs collected",
      "Bridge testnet USDC into your Solana balance",
      "Withdraw to external chains when needed",
      "Copy pay links for Slack, email, or contracts",
    ],
  },
  payers: {
    title: "For payers & clients",
    items: [
      "Pay via link — no account required",
      "Use MetaMask on a familiar testnet",
      "Pay from Settlor balance if they use Settlor",
      "Clear network guidance for direct Solana sends",
    ],
  },
};

export const CHAINS = [
  "Ethereum Sepolia",
  "Base Sepolia",
  "Arbitrum Sepolia",
  "Avalanche Fuji",
  `${SETTLEMENT_CHAIN_LABEL} (direct)`,
];

export const FAQ = [
  {
    q: "Do my clients need a Settlor account?",
    a: "No. Anyone with the pay link can pay from MetaMask or Phantom. If they already use Settlor, they can pay from their Solana balance while logged in.",
  },
  {
    q: "Where does the money actually go?",
    a: `Payments settle as USDC in your Circle programmable wallet on ${SETTLEMENT_CHAIN_LABEL}. That's your unified balance inside Settlor.`,
  },
  {
    q: "Is this mainnet-ready?",
    a: "Set NEXT_PUBLIC_SETTLOR_NETWORK=mainnet and use production Circle + Helius keys. Default is devnet for safe testing.",
  },
  {
    q: "How do I receive USDC from a friend?",
    a: `Open Payments → Receive and share your ${SETTLEMENT_CHAIN_LABEL} address. They must send USDC on Solana — not Ethereum or Base.`,
  },
  {
    q: "What if I was emailed an invoice but don't see it?",
    a: "Sign in with the same Google email the invoice was sent to, or link your email in the dashboard banner. Invoices also match your Solana wallet address.",
  },
];

export const ABOUT = {
  mission:
    "Settlor exists to make USDC invoicing feel as clear as traditional billing — without giving up the flexibility of multi-chain crypto payments.",
  story:
    "Teams working across chains waste hours chasing transaction hashes, explaining bridges, and reconciling scattered wallets. We built Settlor around Circle programmable wallets and CCTP so vendors issue one invoice and payers use familiar wallets — while settlement stays on Solana.",
  values: [
    { title: "Clarity over jargon", body: "We explain transfers in plain language." },
    { title: "Payer-friendly", body: "Public pay links and guided wallet flows reduce support tickets." },
    { title: "Vendor control", body: "You own your invoice list, balance, and payment status in one dashboard." },
  ],
};
