# Settlor design system

Cross-chain USDC invoicing on Solana. Visual language: precise, nocturnal, settlement-focused — not generic fintech orange.

## Scene

Freelancers and Web3 teams review invoices in bright offices or at night; the product should feel like a Solana-native settlement layer: deep surfaces, crisp type, green-to-violet energy on actions only.

## Typography

- **Display:** Bricolage Grotesque — headings, logo wordmark
- **Body:** Manrope — UI, forms, tables

## Color (OKLCH)

| Token | Role |
|-------|------|
| `--color-brand` | Solana green — primary actions, links |
| `--color-brand-secondary` | Solana violet — gradients, accents |
| `--color-surface` | Cool tinted page background |
| `--color-sidebar` | Dark app shell (dashboard nav) |
| `--color-ink` | Primary text |

## Components

Use semantic classes from `globals.css`: `btn-accent`, `btn-primary`, `card`, `text-brand`, `bg-brand-subtle`, `gradient-hero`, `gradient-brand`.

Do not use raw `orange-*` or legacy iPayX palette.
