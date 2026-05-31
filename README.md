# Settlor

**Invoice in USDC. Settle on Solana.**

Settlor is a cross-chain USDC invoicing app: vendors sign in with Google (Circle W3S), get a **Circle programmable wallet on Solana**, and collect payments from EVM testnets via **CCTP** into one SPL USDC balance.

---

## Gas sponsorship (users don’t need SOL)

Circle covers many wallet operations, but Solana still needs **SOL for rent and fees** (e.g. ATA creation). Settlor includes a **platform gas sponsor**:

| Variable | Purpose |
|----------|---------|
| `PLATFORM_SOL_PRIVATE_KEY` | JSON byte array (`solana-keygen`) or base58 secret — **fee payer** wallet |
| `HELIUS_API_KEY` | Reliable devnet/mainnet RPC ([helius.dev](https://helius.dev)) |

On login, `/api/auth/me` may drip **~0.02 SOL** to the user’s Circle wallet if balance is low.

**What to open / fund**

1. **[Helius](https://helius.dev)** — create project → API key → add `HELIUS_API_KEY`
2. **Sponsor keypair** — `solana-keygen new -o sponsor.json` → fund the pubkey with SOL on devnet (or mainnet)
3. Set `PLATFORM_SOL_PRIVATE_KEY` to the JSON array from `sponsor.json`
4. **Circle Console** — enable **SOL-DEVNET** (or **SOL** for mainnet) for your W3S app

Optional: `GET /api/solana/gas-sponsor` shows sponsor status; `POST` tops up the logged-in wallet.

---

## Mainnet switch

```bash
NEXT_PUBLIC_SETTLOR_NETWORK=mainnet
# Circle: SOL + mainnet app config
# USDC mint: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
# Fund sponsor + Helius mainnet RPC
```

Default is **devnet** (`SOL-DEVNET`, mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`).

---

## Quick start

```bash
cp .env.example .env.local
# Fill Circle, Google, DATABASE_URL, SESSION_SECRET, PLATFORM_SOL_PRIVATE_KEY, HELIUS_API_KEY

npm install
npm run db:push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Google OAuth:** `NEXT_PUBLIC_GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback` (same in Google Cloud Console).

---

## Architecture

- **Auth:** Circle W3S + Google / email OTP (unchanged)
- **Settlement:** `SOL-DEVNET` / `SOL` Circle **EOA** wallets
- **Inbound pay:** MetaMask → CCTP → vendor Solana address (`useForwarder: true`)
- **Direct Solana pay:** Phantom SPL USDC transfer
- **Balance pay:** Circle `transactions/transfer` on Solana
- **Outbound:** Circle wallet → EVM via App Kit + `w3s-solana-wallet-provider`
- **Session cookie:** `settlor_session` (legacy `ipayx_session` still accepted)

---

## Env reference

See [.env.example](.env.example).

---

## Stack

Next.js 16 · Prisma · Circle W3S · App Kit / CCTP · `@solana/web3.js` · Helius RPC
