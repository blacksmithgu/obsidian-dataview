const {Plugin, Notice, debounce} = require("obsidian");
const fs = require("fs");

const watchNeeded = window.process.platform !== "darwin" && window.process.platform !== "win32";

module.exports = class HotReload extends Plugin {

    statCache = new Map();  // path -> Stat
    queue = Promise.resolve();

    run(val, err) {
        return this.queue = this.queue.then(val, err);
    }

    reindexPlugins = debounce(() => this.run(() => this.getPluginNames()), 500, true);
    requestScan    = debounce(() => this.run(() => this.checkVersions()),  250, true);

    onload() {
        app.workspace.onLayoutReady(async ()=> {
            this.pluginReloaders = {};
            this.inProgress = null;
            await this.getPluginNames();
            this.registerEvent( this.app.vault.on("raw", this.requestScan));
            this.watch(".obsidian/plugins");
            this.requestScan();
            this.addCommand({
                id: "scan-for-changes",
                name: "Check plugins for changes and reload them",
                callback: () => this.requestScan()
            })
        });
    }

    watch(path) {
        if (this.app.vault.adapter.watchers.hasOwnProperty(path)) return;
        const realPath = [this.app.vault.adapter.basePath, path].join("/");
        const lstat = fs.lstatSync(realPath);
        if (lstat && (watchNeeded || lstat.isSymbolicLink()) && fs.statSync(realPath).isDirectory()) {
            this.app.vault.adapter.startWatchPath(path, false);
        }
    }

    async checkVersions() {
        const base = this.app.plugins.getPluginFolder();
        for (const dir of Object.keys(this.pluginNames)) {
            for (const file of ["manifest.json", "main.js", "styles.css", ".hotreload"]) {
                const path = `${base}/${dir}/${file}`;
                const stat = await app.vault.adapter.stat(path);
                if (stat) {
                    if (this.statCache.has(path) && stat.mtime !== this.statCache.get(path).mtime) {
                        this.onFileChange(path);
                    }
                    this.statCache.set(path, stat);
                }
            }
        }
    }

    async getPluginNames() {
        const plugins = {}, enabled = new Set();
        for (const {id, dir} of Object.values(app.plugins.manifests)) {
            this.watch(dir);
            plugins[dir.split("/").pop()] = id;
            if (
                await this.app.vault.exists(dir+"/.git") ||
                await this.app.vault.exists(dir+"/.hotreload")
            ) enabled.add(id);
        }
        this.pluginNames = plugins;
        this.enabledPlugins = enabled;
    }

    onFileChange(filename) {
        if (!filename.startsWith(this.app.plugins.getPluginFolder()+"/")) return;
        const path = filename.split("/");
        const base = path.pop(), dir = path.pop();
        if (path.length === 1 && dir === "plugins") return this.watch(filename);
        if (path.length != 2) return;
        const plugin = dir && this.pluginNames[dir];
        if (base === "manifest.json" || base === ".hotreload" || base === ".git" || !plugin) return this.reindexPlugins();
        if (base !== "main.js" && base !== "styles.css") return;
        if (!this.enabledPlugins.has(plugin)) return;
        const reloader = this.pluginReloaders[plugin] || (
            this.pluginReloaders[plugin] = debounce(() => this.run(() => this.reload(plugin), console.error), 750, true)
        );
        reloader();
    }

    async reload(plugin) {
        const plugins = app.plugins;

        // Don't reload disabled plugins
        if (!plugins.enabledPlugins.has(plugin)) return;

        await plugins.disablePlugin(plugin);
        console.debug("disabled", plugin);

        // Ensure sourcemaps are loaded (Obsidian 14+)
        const oldDebug = localStorage.getItem("debug-plugin");
        localStorage.setItem("debug-plugin", "1");
        try {
            await plugins.enablePlugin(plugin);
        } finally {
            // Restore previous setting
            if (oldDebug === null) localStorage.removeItem("debug-plugin"); else localStorage.setItem("debug-plugin", oldDebug);
        }
        console.debug("enabled", plugin);
        new Notice(`Plugin "${plugin}" has been reloaded`);
    }
}
