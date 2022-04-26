import type { DataviewApi } from "api/plugin-api";
import "obsidian";

declare module "obsidian" {
    interface MetadataCache {
        trigger(...args: Parameters<MetadataCache["on"]>): void;
        trigger(name: string, ...data: any[]): void;
    }

    interface App {
        appId?: string;
        plugins: {
            enabledPlugins: Set<string>;
            plugins: {
                dataview?: {
                    api: DataviewApi;
                },
                "obsidian-task-collector"?: {
                    api?: {
                        getCompletedTaskValues(): string;
                        getIncompleteTaskValues(): string;
                        isComplete(value: string): boolean;
                        isCanceled(value: string): boolean;
                        getMark(): Promise<string>;
                    };
                };
            };
        };
    }

    interface Workspace {
        /** Sent to rendered dataview components to tell them to possibly refresh */
        on(name: "dataview:refresh-views", callback: () => void, ctx?: any): EventRef;
    }
}

declare global {
    interface Window {
        DataviewAPI?: DataviewApi;
    }
}
