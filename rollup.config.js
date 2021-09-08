import nodeResolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import webWorker from "rollup-plugin-web-worker-loader";
import copy from "rollup-plugin-copy";
import ttypescript from "ttypescript";
import typescript2 from "rollup-plugin-typescript2";

const LIBRARY_CONFIG = {
    input: "src/index.ts",
    output: {
        dir: "lib",
        sourcemap: true,
        format: "cjs",
    },
    external: ["obsidian"],
    plugins: [
        typescript2({
            tsconfig: "tsconfig-lib.json",
            typescript: ttypescript,
        }),
        nodeResolve({ browser: true }),
        commonjs(),
        webWorker({ inline: true, forceInline: true, targetPlatform: "browser" }),
    ],
    onwarn: (warning, warn) => {
        // Sorry rollup, but we're using eval...
        if (/Use of eval is strongly discouraged/.test(warning.message)) return;
        warn(warning);
    },
};

const PROD_PLUGIN_CONFIG = {
    input: "src/main.ts",
    output: {
        dir: "build",
        sourcemap: "inline",
        sourcemapExcludeSources: true,
        format: "cjs",
        exports: "default",
    },
    external: ["obsidian"],
    plugins: [
        nodeResolve({ browser: true }),
        commonjs(),
        webWorker({ inline: true, forceInline: true, targetPlatform: "browser" }),
        typescript2({ tsconfig: "tsconfig.json" }),
    ],
    onwarn: (warning, warn) => {
        // Sorry rollup, but we're using eval...
        if (/Use of eval is strongly discouraged/.test(warning.message)) return;
        warn(warning);
    },
};

const DEV_PLUGIN_CONFIG = {
    input: "src/main.ts",
    output: {
        dir: "test-vault/.obsidian/plugins/dataview",
        format: "cjs",
        sourcemap: "inline",
        exports: "default",
    },
    external: ["obsidian"],
    plugins: [
        nodeResolve({ browser: true }),
        commonjs(),
        webWorker({ inline: true, forceInline: true, targetPlatform: "browser" }),
        typescript2({ tsconfig: "tsconfig.json" }),
        copy({
            targets: [
                { src: "manifest.json", dest: "test-vault/.obsidian/plugins/dataview/" },
                { src: "styles.css", dest: "test-vault/.obsidian/plugins/dataview/" },
            ],
        }),
    ],
    onwarn: (warning, warn) => {
        // Sorry rollup, but we're using eval...
        if (/Use of eval is strongly discouraged/.test(warning.message)) return;
        warn(warning);
    },
};

let configs = [];
if (process.env.BUILD === "lib") {
    // Library build, only library code.
    configs.push(LIBRARY_CONFIG);
} else if (process.env.BUILD === "production") {
    // Production build, build library and main plugin.
    configs.push(LIBRARY_CONFIG, PROD_PLUGIN_CONFIG);
} else if (process.env.BUILD === "dev") {
    // Dev build, only build the plugin.
    configs.push(DEV_PLUGIN_CONFIG);
} else {
    // Default to the dev build.
    configs.push(DEV_PLUGIN_CONFIG);
}

export default configs;
