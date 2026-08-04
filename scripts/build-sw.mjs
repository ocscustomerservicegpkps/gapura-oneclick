#!/usr/bin/env node

/**
 * build-sw.mjs
 *
 * Builds the production Service Worker (app/sw.ts → public/sw.js)
 * using esbuild with NO eval() calls, making it compliant with
 * Google Play Protect security scanning.
 *
 * Usage:
 *   node scripts/build-sw.mjs          # production build
 *   NODE_ENV=development node scripts/build-sw.mjs  # dev build (still no eval)
 */

import { build } from "esbuild";
import { readFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");

const isProduction = process.env.NODE_ENV !== "development";

const outfile = resolve(projectRoot, "public/sw.js");

// Ensure public directory exists
if (!existsSync(resolve(projectRoot, "public"))) {
  mkdirSync(resolve(projectRoot, "public"), { recursive: true });
}

async function main() {
  console.log(`[build-sw] Building service worker (${isProduction ? "production" : "development"})...`);

  try {
    await build({
      entryPoints: [resolve(projectRoot, "app/sw.ts")],
      bundle: true,
      outfile,
      format: "iife",
      target: ["chrome100", "firefox100", "safari16"],
      minify: isProduction,
      sourcemap: false,
      // CRITICAL: No eval() — this is the key setting that prevents
      // Google Play Protect from flagging the service worker.
      legalComments: "none",
      define: {
        "process.env.NODE_ENV": JSON.stringify(isProduction ? "production" : "development"),
      },
      alias: {
        "@": resolve(projectRoot, "."),
      },
      external: [],
      logLevel: "info",
      // Reject any output containing eval()
      banner: {
        js: `/* Gapura OneClick Service Worker - Built ${new Date().toISOString()} */`,
      },
    });

    // Verify no eval() in output
    const output = readFileSync(outfile, "utf-8");
    const evalCount = (output.match(/\beval\s*\(/g) || []).length;

    if (evalCount > 0) {
      console.error(`[build-sw] ERROR: Output contains ${evalCount} eval() call(s). Google Play Protect will flag this.`);
      process.exit(1);
    }

    const sizeKB = (Buffer.byteLength(output) / 1024).toFixed(1);
    console.log(`[build-sw] ✓ Built successfully (${sizeKB} KB, 0 eval calls)`);
  } catch (error) {
    console.error("[build-sw] Build failed:", error);
    process.exit(1);
  }
}

main();
