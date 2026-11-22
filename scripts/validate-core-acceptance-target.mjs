#!/usr/bin/env node
// Safe staging target metadata gate. Does not connect, alter, seed, or assert acceptance.
import { readFileSync } from "node:fs";
import { validateCoreAcceptanceTarget } from "../lib/levytate/core-acceptance-target.mjs";

const args=process.argv.slice(2);
if (args.length===1 && args[0]==="--help") {
  console.log("Usage: node scripts/validate-core-acceptance-target.mjs --file <credential-free-observed-target.json>");
} else if (args.length!==2 || args[0]!=="--file") {
  console.error("BLOCKED core acceptance target: supply an observed metadata file, never credentials");
  process.exitCode=2;
} else {
  try {
    const evidence=JSON.parse(readFileSync(args[1],"utf8"));
    validateCoreAcceptanceTarget(evidence);
    console.log("PASS: isolated Core target metadata preflight only; hosted authentication, migration parity and client acceptance remain unverified");
  } catch (error) {
    const message=error instanceof Error && error.message.startsWith("BLOCKED core acceptance target:")
      ? error.message : "BLOCKED core acceptance target: evidence unavailable or invalid";
    console.error(message);
    process.exitCode=2;
  }
}
