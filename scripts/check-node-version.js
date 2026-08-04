#!/usr/bin/env node

/**
 * @file
 * 
 * File ini berisi script untuk memvalidasi versi Node.js yang digunakan
 */

console.log(`Checking Node.js version (current: v${process.versions.node})...`);

const [majorRaw, minorRaw] = process.versions.node.split(".");
const major = Number(majorRaw);
const minor = Number(minorRaw);

const isSupported =
  (major === 20 && minor >= 9) || (major > 20 && major < 25);

if (!isSupported) {
  console.error(
    [
      `Unsupported Node.js version: v${process.versions.node}`,
      "This project requires Node.js >=20.9.0 and <25.",
      "Recommended: Node.js 22 LTS.",
      "Example with nvm: nvm install 22 && nvm use 22",
    ].join("\n")
  );
  process.exit(1);
}
