# iPayX

**Invoice in USDC. Get paid from any chain. One balance on Arc.**

iPayX is a proof-of-concept for teams that bill in stablecoins but do not want payers juggling bridge steps, wallet addresses, and payment hashes over email. You issue a professional invoice with a pay link; the client pays USDC from Ethereum, Base, Arbitrum, or Avalanche testnets; settlement routes to your **Circle programmable wallet on Arc Testnet** via CCTP. One dashboard for invoices sent, bills to pay, deposits, transfers, and balance.

---

## What it does

### For vendors (iPayX accounts)

- Create invoices with line items, due dates, notes, and invoice numbers
- Send pay links by email (Resend) or copy the link manually
- Track **Sent** vs **To pay** — match incoming bills by wallet or email
- View Arc wallet balance, deposit from other chains, and transfer USDC out
- Sign in with **Google** or **email verification code** (Circle W3S)

### For payers (no account required)

- Open `/pay/[token]` and pay with **MetaMask**
- Pay from the chain where USDC already sits; bridging is handled in-flow
- Minimum **$3** for cross-chain transfers

### Public marketing site

Landing, how-it-works, about, and help pages, plus live platform metrics (users, invoices, payments, USDC volume).

### Product boundaries (this build)

| In scope | Out of scope |
|----------|----------------|
| Arc + EVM **testnets**, USDC | Mainnet production treasury |
| Invoicing → pay → balance | Full accounting / ERP |
| Circle MPC wallets (no key export) | Self-custody private keys |

> **Sign-in:** Google and email OTP create **separate** Circle wallets for the same email. Use one method consistently.

---

## Technical implementation

### Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| API | Next.js Route Handlers under `app/api/` |
| Database | Prisma 6 + **PostgreSQL** (Neon in prod; SQLite optional locally via `schema.postgres.prisma` swap) |
| Auth & wallets | [Circle W3S](https://developers.circle.com/wallets/user-controlled) — Google OAuth + email OTP |
| Cross-chain | Circle App Kit + **CCTP** (`@circle-fin/app-kit`, viem adapters) |
| Payer checkout | MetaMask + bridge client (`lib/bridge-client.ts`) |
| Invoice email | [Resend](https://resend.com) (optional; login OTP uses Circle Console SMTP) |
| Sessions | HttpOnly `ipayx_session` cookie; Circle tokens encrypted at rest (`SESSION_SECRET` + `jose`) |

### Architecture (high level)

```text
Marketing (app/(site)/)     →  public pages, /api/metrics
Login (app/login/)          →  Circle SDK → POST /api/auth/session
Dashboard (app/dashboard/)  →  session-gated UI
Pay (app/pay/[token]/)      →  public invoice + MetaMask + CCTP bridge
API (app/api/)              →  auth, invoices, payments, bridge, metrics
lib/                        →  auth, prisma, invoices, email, circle-*, bridge
middleware.ts               →  protects /dashboard/* and most /api/*
```

**Payment flow**

1. Vendor creates invoice → stored in Postgres with `publicToken`
2. Client opens pay URL → `GET /api/invoices/public?token=…`
3. Client signs bridge tx in browser → platform watcher + invoice `status: paid`
4. USDC credited on vendor Arc wallet via Circle / CCTP path

### Data model (Prisma)

- **User** — `walletAddress`, optional `email`, relations to sent/received invoices
- **Session** — encrypted `circleUserTokenEnc` / `circleEncryptionKeyEnc`, expiry
- **Invoice** + **InvoiceItem** — status, parties, `publicToken`, `txHash`, line items

### Security notes

- API routes require `ipayx_session` except public invoice, session bootstrap, metrics, and login OTP endpoint
- Production cookies: `secure: true` when `NODE_ENV=production`
- Secrets only in `.env.local` (gitignored); never commit API keys or `PLATFORM_EVM_PRIVATE_KEY`

### Project layout

```text
app/
  (site)/          # marketing routes
  dashboard/       # overview, invoices, payments, wallet, deposit, transfer
  login/           # Circle sign-in
  pay/[token]/     # public payer UI
  api/             # REST-style handlers
components/        # layout, marketing, invoices, payments, auth
lib/               # business logic & integrations
prisma/            # schema (postgresql provider for deploy)
```

---

## Quick start

```bash
cp .env.example .env.local
# Fill Circle, Google, DATABASE_URL (postgresql://…), SESSION_SECRET, etc.

npm install
npm run db:push    # loads .env.local via dotenv-cli
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Google OAuth:** set `NEXT_PUBLIC_GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback` and add the same URI in Google Cloud Console (no trailing slash).

**Prisma:** CLI reads `.env` by default; `npm run db:push` uses **`.env.local`** so `DATABASE_URL` must be a `postgresql://` URL when using the Postgres schema.

---

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | Postgres connection string |
| `SESSION_SECRET` | Yes | Encrypts session / Circle credentials (`openssl rand -hex 32`) |
| `CIRCLE_API_KEY` | Yes | Circle Developer API |
| `NEXT_PUBLIC_CIRCLE_APP_ID` | Yes | W3S app ID |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Yes | Google OAuth |
| `NEXT_PUBLIC_GOOGLE_REDIRECT_URI` | Yes | OAuth callback (`/auth/callback`) |
| `PLATFORM_EVM_PRIVATE_KEY` | Yes | Platform Arc watcher for bridge settlement |
| `CIRCLE_ENTITY_SECRET` | Yes* | Bridge outbound (*or parsed from `CIRCLE_API_KEY`) |
| `NEXT_PUBLIC_APP_URL` | Yes | Base URL for pay links in emails |
| `RESEND_API_KEY` | No | Invoice notification emails |
| `EMAIL_FROM` | No | Sender address (Resend sandbox: `onboarding@resend.dev`) |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Next.js dev server |
| `npm run build` | `prisma generate` + production build |
| `npm run db:push` | Sync schema to DB (uses `.env.local`) |
| `npm run db:studio` | Prisma Studio |

---

## Deploy

Use **Vercel** + **Neon Postgres** (SQLite does not work on serverless). Set all env vars in the Vercel dashboard; set `NEXT_PUBLIC_APP_URL` and Google redirect URI to your production domain. Keep `/docs` local (gitignored) for detailed deploy and email setup notes.

---

## Disclaimer

iPayX is a **testnet POC** for demonstration. Not financial advice. Review amounts in MetaMask before confirming transactions. Circle user-controlled wallets do not expose exportable private keys.
