export const SITE = {
  name: "iPayX",
  tagline: "Cross-chain USDC invoicing",
  description:
    "Send professional invoices, get paid in USDC from any supported chain, and hold one balance on Arc.",
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
  { name: "Arc", detail: "Unified settlement" },
  { name: "CCTP", detail: "Cross-chain USDC" },
  { name: "Google", detail: "Secure sign-in" },
];

export const HERO = {
  eyebrow: "Built for crypto-native businesses",
  title: "Invoice in USDC. Get paid from any chain.",
  subtitle:
    "iPayX gives freelancers, agencies, and Web3 teams one place to send invoices, collect USDC from Ethereum, Base, Arbitrum, and more — and settle everything into a single Arc balance.",
  ctaPrimary: "Get started free",
  ctaSecondary: "See how it works",
};

export const STATS = [
  { value: "1", label: "Arc balance", hint: "All payments land in your Circle wallet" },
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
      "Payers use MetaMask on the chain where their USDC already lives. Circle CCTP routes funds to Arc — no manual bridging instructions in email threads.",
    points: ["Ethereum, Base, Arbitrum, Avalanche testnets", "Direct Arc Testnet payments supported", "Clear step-by-step payer guidance"],
  },
  {
    title: "Arc wallet balance",
    description:
      "Every payment credits your Circle programmable wallet on Arc Testnet. Bridge in from external chains or pay invoices from your Arc balance when logged in.",
    points: ["Real-time USDC balance", "Withdraw to external testnets", "Copy Arc address for native USDC receives"],
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
    title: "Sign in & get your Arc wallet",
    body: "Use Google to create your Circle programmable wallet on Arc Testnet. Your dashboard shows balance, invoices, and payments immediately.",
  },
  {
    step: "02",
    title: "Create & send an invoice",
    body: "Add line items, set a due date, and send to your client's email or Arc address. They receive a pay link — no iPayX account required to pay.",
  },
  {
    step: "03",
    title: "Client pays from their chain",
    body: "They connect MetaMask, pick the network where their USDC lives, and confirm a guided flow. Funds route to your Arc address via CCTP.",
  },
  {
    step: "04",
    title: "You see it on Arc",
    body: "The invoice marks paid with transaction reference. Your Arc balance updates; activity and overview charts reflect the payment.",
  },
];

export const USER_PATHS = {
  vendors: {
    title: "For vendors & creators",
    items: [
      "Send invoices and track sent vs collected",
      "Bridge testnet USDC into your Arc balance",
      "Withdraw to external chains when needed",
      "Copy pay links for Slack, email, or contracts",
    ],
  },
  payers: {
    title: "For payers & clients",
    items: [
      "Pay via link — no account required",
      "Use MetaMask on a familiar testnet",
      "Pay from Arc balance if they use iPayX",
      "Clear network guidance (Arc-only for direct sends)",
    ],
  },
};

export const CHAINS = [
  "Ethereum Sepolia",
  "Base Sepolia",
  "Arbitrum Sepolia",
  "Avalanche Fuji",
  "Arc Testnet (direct)",
];

export const FAQ = [
  {
    q: "Do my clients need an iPayX account?",
    a: "No. Anyone with the pay link can pay from MetaMask. If they already use iPayX, they can pay from their Arc balance while logged in.",
  },
  {
    q: "Where does the money actually go?",
    a: "Payments settle as USDC in your Circle programmable wallet on Arc Testnet. That's your unified balance inside iPayX.",
  },
  {
    q: "Is this mainnet-ready?",
    a: "This POC runs on testnets (Arc Testnet, Sepolia-family chains). Production mainnet support depends on Circle and Arc network availability in your environment.",
  },
  {
    q: "How do I receive USDC from a friend?",
    a: "Open Payments → Receive and share your Arc Testnet address. They must send USDC on the Arc network — not Ethereum or Base — or it won't credit your wallet.",
  },
  {
    q: "What if I was emailed an invoice but don't see it?",
    a: "Sign in with the same Google email the invoice was sent to, or link your email in the dashboard banner. Invoices also match your Arc wallet address.",
  },
];

export const ABOUT = {
  mission:
    "iPayX exists to make USDC invoicing feel as clear as traditional billing — without giving up the flexibility of multi-chain crypto payments.",
  story:
    "Teams working across chains waste hours chasing transaction hashes, explaining bridges, and reconciling scattered wallets. We built iPayX around Circle programmable wallets and CCTP so vendors issue one invoice and payers use familiar wallets — while settlement stays on Arc.",
  values: [
    { title: "Clarity over jargon", body: "No \"burn\" scares — we explain transfers in plain language." },
    { title: "Payer-friendly", body: "Public pay links and guided MetaMask flows reduce support tickets." },
    { title: "Vendor control", body: "You own your invoice list, balance, and payment status in one dashboard." },
  ],
};
