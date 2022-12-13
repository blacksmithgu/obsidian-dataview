import nodeResolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import webWorker from "rollup-plugin-web-worker-loader";
import copy from "rollup-plugin-copy";
import ttypescript from "ttypescript";
import typescript2 from "rollup-plugin-typescript2";

const BASE_CONFIG = {
    input: "src/main.ts",
    external: ["obsidian", "@codemirror/view", "@codemirror/state", "@codemirror/language"],
    onwarn: (warning, warn) => {
        // Sorry rollup, but we're using eval...
        if (/Use of eval is strongly discouraged/.test(warning.message)) return;
        warn(warning);
    },
};
const getRollupPlugins = (tsconfig, ...plugins) =>
    [
        typescript2(tsconfig),
        nodeResolve({ browser: true }),
        commonjs(),
        webWorker({ inline: true, forceInline: true, targetPlatform: "browser" }),
    ].concat(plugins);

const DEV_PLUGIN_CONFIG = {
    ...BASE_CONFIG,
    output: {
        dir: "test-vault/.obsidian/plugins/dataview",
        sourcemap: "inline",
        format: "cjs",
        exports: "default",
        name: "Dataview (Development)",
    },
    plugins: getRollupPlugins(
        undefined,
        copy({
            targets: [
                { src: "manifest.json", dest: "test-vault/.obsidian/plugins/dataview/" },
                { src: "styles.css", dest: "test-vault/.obsidian/plugins/dataview/" },
            ],
        })
    ),
};

const PROD_PLUGIN_CONFIG = {
    ...BASE_CONFIG,
    output: {
        dir: "build",
        sourcemap: "inline",
        sourcemapExcludeSources: true,
        format: "cjs",
        exports: "default",
        name: "Dataview (Production)",
    },
    plugins: getRollupPlugins(),
};

const LIBRARY_CONFIG = {
    ...BASE_CONFIG,
    input: "src/index.ts",
    output: {
        dir: "lib",
        sourcemap: true,
        format: "cjs",
        name: "Dataview (Library)",
    },
    plugins: getRollupPlugins(
        { tsconfig: "tsconfig-lib.json", typescript: ttypescript },
        copy({ targets: [{ src: "src/typings/*.d.ts", dest: "lib/typings" }] })
    ),
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
