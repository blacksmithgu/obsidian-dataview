import typescript from '@rollup/plugin-typescript';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import webWorker from 'rollup-plugin-web-worker-loader';

const isProd = process.env.BUILD === "production";

export default [{
  input: 'src/main.ts',
  output: {
    dir: 'build',
    sourcemap: 'inline',
    sourcemapExcludeSources: isProd,
    format: 'cjs',
    exports: 'default'
  },
  external: ['obsidian'],
  treeshake: "smallest",
  plugins: [
    nodeResolve({ browser: true }),
    commonjs(),
    webWorker({ inline: true, forceInline: true, targetPlatform: 'browser' }),
    typescript(),
  ],
  onwarn: (warning, warn) => {
    // Sorry rollup, but we're using eval...
    if (/Use of eval is strongly discouraged/.test(warning.message)) return;
    warn(warning);
  }
}];
