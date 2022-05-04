import "obsidian";
import { DvAPIInterface } from "./api";
import { DvEvtTriggerArgs } from "./events";

declare module "obsidian" {
    interface MetadataCache {
        trigger(...args: DvEvtTriggerArgs): void;
        trigger(name: string, ...data: any[]): void;
    }

    interface App {
        appId?: string;
        plugins: {
            enabledPlugins: Set<string>;
            plugins: {
                dataview?: {
                    api: DvAPIInterface;
                };
            };
        };
    }

    interface Workspace {
        /** Sent to rendered dataview components to tell them to possibly refresh */
        on(name: "dataview:refresh-views", callback: () => void, ctx?: any): EventRef;
    }
}
