import "obsidian";
import { DvAPIInterface } from "./api";
import { DvEvtTriggerArgs } from "./events";

declare module "obsidian" {
    interface MetadataCache {
        trigger(...args: DvEvtTriggerArgs): void;
        trigger(name: string, ...data: any[]): void;
    }
    interface App {
        plugins: {
            enabledPlugins: Set<string>;
            plugins: {
                dataview?: {
                    api: DvAPIInterface;
                };
            };
        };
    }
}
