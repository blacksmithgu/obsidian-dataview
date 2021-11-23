import "obsidian";
import { DataviewAPIInterface, DataviewEvents } from "./api";

declare module "obsidian" {
    interface MetadataCache {
        trigger(...args: DataviewEvents): void;
        trigger(name: string, ...data: any[]): void;
    }
    interface App {
        plugins: {
            enabledPlugins: Set<string>;
            plugins: {
                dataview?: {
                    api: DataviewAPIInterface;
                };
            };
        };
    }
}
