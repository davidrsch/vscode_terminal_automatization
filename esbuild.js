// @ts-check
const esbuild = require('esbuild');

const watch = process.argv.includes('--watch');
const production = process.argv.includes('--production');

async function build() {
  /** @type {import('esbuild').BuildOptions} */
  const opts = {
    entryPoints: ['src/extension.ts'],
    bundle: true,
    outfile: 'out/extension.js',
    // vscode is provided by the extension host at runtime
    external: ['vscode'],
    format: 'cjs',
    platform: 'node',
    target: 'node20',
    sourcemap: !production,
    minify: production,
    logLevel: 'info',
  };

  if (watch) {
    const ctx = await esbuild.context(opts);
    await ctx.watch();
    console.log('Watching for changes...');
  } else {
    await esbuild.build(opts);
    console.log('Build complete.');
  }
}

build().catch(() => process.exit(1));
