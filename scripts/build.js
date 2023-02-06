const glob = require('glob')
const { build } = require('esbuild')
const entryPoints = glob.sync('./client/src/*.ts')

build({
  entryPoints,
  bundle: true,
  outbase: './',
  outfile: './out/main.js',
  platform: 'node',
  external: ['vscode'],
  format: 'cjs',
  watch: false,
})
