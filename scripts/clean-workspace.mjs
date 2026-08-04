import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');

const generatedPaths = [
    '.DS_Store',
    '.claude-flow',
    '.next',
    '.next-analyze',
    '.next-audit',
    '.next-dev-alt',
    '.next-verify',
    '.superpowers/brainstorm',
    '.turbo',
    'docs/.DS_Store',
    'next-env.d.ts',
    'node_modules/.cache',
    'output',
    'outputs',
    'public/sw.js',
    'scripts/.DS_Store',
    'sidang_prep',
    'tmp',
    'tsconfig.tsbuildinfo',
];

if (process.argv.includes('--dependencies')) {
    generatedPaths.push('node_modules');
}

for (const relativePath of generatedPaths) {
    const targetPath = path.resolve(repositoryRoot, relativePath);
    const relativeTarget = path.relative(repositoryRoot, targetPath);

    if (relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) {
        throw new Error(`Refusing to remove path outside repository: ${targetPath}`);
    }

    await rm(targetPath, { recursive: true, force: true });
    console.log(`Removed ${relativePath}`);
}
