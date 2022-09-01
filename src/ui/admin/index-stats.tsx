import { FullIndex } from "data-index";
import { View, WorkspaceLeaf } from "obsidian";
import { h, render } from "preact";
import { unmountComponentAtNode } from "preact/compat";
import { DataviewSettings } from "settings";
import { useIndexBackedState } from "ui/markdown";

export function IndexStats({ index, container, settings }: { index: FullIndex, container: HTMLElement, settings: DataviewSettings }) {
    // We don't care about the actual return value; we just use this to intelligently re-render.
    // TODO: Index statistics may care about some index metadata which index revisions don't capture;
    // we'll want to add a different state function which listens to a more broad event.
    useIndexBackedState(container, index.app, settings, index, null, async () => { return null; });

    return <div>
        <h1 class="text-centered"><u>Dataview</u></h1>
        <p class="text-centered">Currently tracking <b>{index.pages.size}</b> files.</p>
    </div>;
}

/** Renders statistics about the dataview index in an administration window which shows timing data. */
export class IndexStatsView extends View {

    /** The view type of this view. */
    public static readonly TYPE: string = "dataview:index-stats";

    public constructor(leaf: WorkspaceLeaf, private index: FullIndex, private settings: DataviewSettings) {
        super(leaf);

        this.navigation = true;
    }

    public override async onOpen() {
        render(<IndexStats index={this.index} container={this.containerEl} settings={this.settings} />, this.containerEl);
    }

    public override async onClose() {
        unmountComponentAtNode(this.containerEl);
    }

    public override getViewType(): string {
        return IndexStatsView.TYPE;
    }

    public override getDisplayText(): string {
        return "Dataview: Index State";
    }
}
