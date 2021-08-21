import typescript from '@rollup/plugin-typescript';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import webWorker from 'rollup-plugin-web-worker-loader';
import copy from 'rollup-plugin-copy';
import ttypescript from 'ttypescript'
import tsPlugin from 'rollup-plugin-typescript2'

const libCfg = {
  input: 'src/index.ts',
  output: {
    dir: 'lib',
    sourcemap: true,
    format: 'cjs',
  },
  external: ['obsidian'],
  plugins: [
    tsPlugin({
      tsconfig: 'tsconfig-lib.json',
      typescript: ttypescript
    }),
    nodeResolve({ browser: true }),
    commonjs(),
    webWorker({ inline: true, forceInline: true, targetPlatform: 'browser' }),
  ],
  onwarn: (warning, warn) => {
    // Sorry rollup, but we're using eval...
    if (/Use of eval is strongly discouraged/.test(warning.message)) return;
    warn(warning);
  }
}

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

const pluginCfg = {
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
};


let configs = [];
if (process.env.BUILD === "lib") {
  // lib
  configs.push(libCfg);
} else if (isProd) {
  // build
  configs.push(pluginCfg, libCfg);
} else {
  // dev
  configs.push(pluginCfg);
}
export default configs;
