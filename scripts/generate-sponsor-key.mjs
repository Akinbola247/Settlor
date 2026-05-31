#!/usr/bin/env node
/**
 * Generate PLATFORM_SOL_PRIVATE_KEY without Solana CLI.
 * Usage: node scripts/generate-sponsor-key.mjs
 */
import { Keypair } from "@solana/web3.js";
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const kp = Keypair.generate();
const secret = Array.from(kp.secretKey);
const pubkey = kp.publicKey.toBase58();

const outPath = resolve(dirname(fileURLToPath(import.meta.url)), "..", "sponsor.json");
writeFileSync(outPath, JSON.stringify(secret), "utf8");

console.log("\nSponsor wallet created.\n");
console.log("Public key (fund this with devnet SOL):");
console.log(`  ${pubkey}\n`);
console.log("Saved secret to sponsor.json (gitignored if you add it to .gitignore).");
console.log("\nAdd to .env.local:\n");
console.log(`PLATFORM_SOL_PRIVATE_KEY=${JSON.stringify(secret)}\n`);
console.log("Fund devnet SOL:");
console.log(`  https://faucet.solana.com — paste ${pubkey}`);
console.log("  or https://faucet.circle.com (if available for SOL)\n");
