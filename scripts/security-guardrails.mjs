import { spawnSync } from 'node:child_process';

const checks = [
  {
    name: 'Service-role auth bypass in app routes',
    command: [
      'rg',
      '-n',
      "Bearer \\$\\{process\\.env\\.SUPABASE_SERVICE_ROLE_KEY\\}|isServiceRole",
      'app/api',
      'proxy.ts',
    ],
  },
  {
    name: 'Unsigned or suspicious backup files in repo',
    command: [
      'rg',
      '--files',
      '-g',
      '!node_modules',
      '-g',
      '!output',
      '-g',
      '*.bak',
      '-g',
      '*.bak2',
      '-g',
      '*page 2.tsx',
    ],
  },
  {
    name: 'Hard-coded demo credentials or shared passwords in docs',
    command: [
      'rg',
      '-n',
      'Demo Credentials|\\| Password \\||Gapura123!',
      '.',
      '-g',
      '!node_modules',
      '-g',
      '!output',
      '-g',
      '!security_best_practices_report.md',
      '-g',
      '!scripts/security-guardrails.mjs',
    ],
  },
  {
    name: 'Public caching in protected API routes',
    command: [
      'rg',
      '-n',
      'Cache-Control.*public|CDN-Cache-Control.*public',
      'app/api',
      '-g',
      '!app/api/embed/**',
      '-g',
      '!app/api/master-data/**',
      '-g',
      '!app/api/dashboards/route.ts',
    ],
  },
];

let hasFailure = false;

for (const check of checks) {
  const result = spawnSync(check.command[0], check.command.slice(1), {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
  const hasMatches = result.status === 0 && output.length > 0;
  const commandFailed = result.status !== 0 && result.status !== 1;

  if (commandFailed) {
    console.error(`[security:guardrails] Failed to run check: ${check.name}`);
    if (output) console.error(output);
    hasFailure = true;
    continue;
  }

  if (hasMatches) {
    console.error(`[security:guardrails] FAILED: ${check.name}`);
    console.error(output);
    hasFailure = true;
    continue;
  }

  console.log(`[security:guardrails] OK: ${check.name}`);
}

if (hasFailure) {
  process.exit(1);
}
