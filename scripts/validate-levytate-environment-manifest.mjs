#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const manifestPath = fileURLToPath(new URL("../docs/LEVYTATE_ENVIRONMENT_MANIFEST.json", import.meta.url));
const environmentNames = ["development", "preview", "production"];
const launchEnvironments = ["preview", "production"];
const launchCriticalNames = [
  "LEVYTATE_BETA_SESSION_SECRET",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];
const variableNamePattern = /^[A-Z][A-Z0-9_]*$/;

function fail(message) {
  throw new Error(message);
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object.`);
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (actual.length !== required.length || actual.some((key, index) => key !== required[index])) {
    fail(`${label} must contain only: ${required.join(", ")}.`);
  }
}

function validateNameList(value, label) {
  if (!Array.isArray(value)) fail(`${label} must be an array.`);
  value.forEach((entry, index) => {
    if (typeof entry !== "string" || !variableNamePattern.test(entry)) {
      fail(`${label} contains an invalid variable name at index ${index}.`);
    }
  });
  if (new Set(value).size !== value.length) fail(`${label} contains a duplicate variable name.`);
  const sorted = [...value].sort();
  if (value.some((entry, index) => entry !== sorted[index])) fail(`${label} must be sorted.`);
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    fail(`${label} could not be read as JSON.`);
  }
}

function validateManifest() {
  const manifest = readJson(manifestPath, "Environment manifest");
  exactKeys(manifest, ["schemaVersion", "environments"], "Environment manifest");
  if (manifest.schemaVersion !== 1) fail("Environment manifest schemaVersion must be 1.");
  exactKeys(manifest.environments, environmentNames, "Environment manifest environments");

  for (const environment of environmentNames) {
    const contract = manifest.environments[environment];
    exactKeys(contract, ["required"], `${environment} environment contract`);
    validateNameList(contract.required, `${environment} required names`);
  }

  for (const environment of launchEnvironments) {
    for (const name of launchCriticalNames) {
      if (!manifest.environments[environment].required.includes(name)) {
        fail(`${environment} environment is missing launch-critical name ${name}.`);
      }
    }
  }

  return manifest;
}

function readOption(args, option) {
  const exactIndex = args.indexOf(option);
  if (exactIndex !== -1) {
    const value = args[exactIndex + 1];
    if (!value || value.startsWith("--")) fail(`${option} requires a value.`);
    args.splice(exactIndex, 2);
    return value;
  }
  const prefix = `${option}=`;
  const inlineIndex = args.findIndex((argument) => argument.startsWith(prefix));
  if (inlineIndex !== -1) {
    const value = args[inlineIndex].slice(prefix.length);
    args.splice(inlineIndex, 1);
    if (!value) fail(`${option} requires a value.`);
    return value;
  }
  return null;
}

function parseOptions(argv) {
  const args = [...argv];
  if (args.includes("--help")) {
    return { help: true, environment: null, namesFile: null };
  }
  const environment = readOption(args, "--environment");
  const namesFile = readOption(args, "--names-file");
  if (args.length) fail("Unknown command-line option.");
  if (Boolean(environment) !== Boolean(namesFile)) {
    fail("--environment and --names-file must be supplied together.");
  }
  return { help: false, environment, namesFile };
}

function validateInventory(manifest, environment, namesFile) {
  if (!environmentNames.includes(environment)) fail("Inventory environment is not supported.");
  const inventory = readJson(resolve(namesFile), "Environment names inventory");
  exactKeys(inventory, ["environment", "names"], "Environment names inventory");
  if (inventory.environment !== environment) fail("Environment names inventory does not match --environment.");
  validateNameList(inventory.names, "Environment inventory names");

  const available = new Set(inventory.names);
  const missing = manifest.environments[environment].required.filter((name) => !available.has(name));
  if (missing.length) fail(`${environment} inventory is missing required names: ${missing.join(", ")}.`);

  return { available: inventory.names.length, required: manifest.environments[environment].required.length };
}

function printHelp() {
  console.log("Usage: node scripts/validate-levytate-environment-manifest.mjs [--environment <name> --names-file <names-only.json>]");
}

try {
  const options = parseOptions(process.argv.slice(2));
  if (options.help) {
    printHelp();
  } else {
    const manifest = validateManifest();
    if (options.environment && options.namesFile) {
      const result = validateInventory(manifest, options.environment, options.namesFile);
      console.log(`PASS ${options.environment} environment name inventory (${result.required} required; ${result.available} supplied)`);
    } else {
      const declarations = environmentNames.reduce((total, environment) => total + manifest.environments[environment].required.length, 0);
      console.log(`PASS credential-free environment manifest (${environmentNames.length} environments; ${declarations} required-name declarations)`);
    }
  }
} catch (error) {
  console.error(`FAIL credential-free environment manifest: ${error instanceof Error ? error.message : "Unknown validation error."}`);
  process.exitCode = 1;
}
