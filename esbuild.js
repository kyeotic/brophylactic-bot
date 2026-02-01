require('esbuild')
  .build({
    entryPoints: ['src/server.ts'],
    bundle: true,
    outfile: 'dist/server.js',
    platform: 'node',
    target: 'node20',
    // minify: true,
  })
  .catch(() => process.exit(1))
