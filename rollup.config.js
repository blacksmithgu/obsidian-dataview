import typescript from '@rollup/plugin-typescript';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import webWorker from 'rollup-plugin-web-worker-loader';
import copy from 'rollup-plugin-copy'

const isProd = process.env.BUILD === "production";

let plugins = [
  nodeResolve({ browser: true }),
  commonjs(),
  webWorker({ inline: true, forceInline: true, targetPlatform: 'browser' }),
  typescript(),
]

if (!isProd) {
  plugins.push(copy({
    targets: [
      {src: 'manifest.json', dest: 'test-vault/.obsidian/plugins/dataview/'},
      {src: 'styles.css', dest: 'test-vault/.obsidian/plugins/dataview/'},
    ]
  }))
}

export default [{
  input: 'src/main.ts',
  output: {
    dir: isProd ? 'build' : 'test-vault/.obsidian/plugins/dataview',
    sourcemap: 'inline',
    sourcemapExcludeSources: isProd,
    format: 'cjs',
    exports: 'default'
  },
  external: ['obsidian'],
  treeshake: "smallest",
  plugins,
  onwarn: (warning, warn) => {
    // Sorry rollup, but we're using eval...
    if (/Use of eval is strongly discouraged/.test(warning.message)) return;
    warn(warning);
  }
}];
