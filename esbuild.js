const shared = {
  bundle: true,
  platform: 'node',
  target: 'node20',
}

Promise.all([
  require('esbuild').build({
    ...shared,
    entryPoints: ['src/server.ts'],
    outfile: 'dist/server.js',
  }),
  require('esbuild').build({
    ...shared,
    entryPoints: ['src/bot.ts'],
    outfile: 'dist/bot.js',
  }),
]).catch(() => process.exit(1))
