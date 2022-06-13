require('esbuild')
  .build({
    entryPoints: ['src/lambda.ts'],
    bundle: true,
    outfile: 'dist/lambda.js',
    platform: 'node',
    target: 'node16.9',
    // minify: true,
  })
  .catch(() => process.exit(1))
