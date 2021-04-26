import typescript from '@rollup/plugin-typescript';
import {nodeResolve} from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'src/main.ts',
  output: {
    dir: 'build',
    sourcemap: 'inline',
    format: 'cjs',
    exports: 'default'
  },
  external: ['obsidian'],
  plugins: [
    typescript(),
    nodeResolve({browser: true}),
    commonjs(),
  ],
  onwarn: (warning, warn) => {
    // Sorry rollup, but we're using eval...
    if (/Use of eval is strongly discouraged/.test(warning.message)) return;
    warn(warning);
  }
};