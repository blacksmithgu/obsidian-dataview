/** Provides core preact / rendering utilities for all view types. */
import { App, MarkdownRenderChild, MarkdownRenderer } from "obsidian";
import { h, createContext, ComponentChildren, render } from "preact";
import { useContext, useEffect, useRef, useState } from "preact/hooks";
import { Component } from "obsidian";
import { DataviewSettings, DEFAULT_QUERY_SETTINGS } from "settings";
import { FullIndex } from "data-index";
import { Literal } from "data-model/value";
import { renderValue } from "ui/render";
import { unmountComponentAtNode } from "preact/compat";

export type MarkdownProps = { contents: string; sourcePath: string };
export type MarkdownContext = { component: Component };

/** Shared context for dataview views and objects. */
export type DataviewContexts = {
    app: App;
    component: Component;
    index: FullIndex;
    settings: DataviewSettings;
    container: HTMLElement;
};

export const DataviewContext = createContext<DataviewContexts>(undefined!);

/** Hacky preact component which wraps Obsidian's markdown renderer into a neat component. */
export function Markdown({
    content,
    sourcePath,
    style,
    cls,
    onClick,
}: {
    content: string;
    sourcePath: string;
    style?: string;
    cls?: string;
    onClick?: (e: preact.JSX.TargetedMouseEvent<HTMLElement>) => void;
}) {
    const container = useRef<HTMLElement | null>(null);
    const component = useContext(DataviewContext).component;

    useEffect(() => {
        if (!container.current) return;

        container.current.innerHTML = "";
        MarkdownRenderer.renderMarkdown(content, container.current, sourcePath, component).then(() => {
            if (!container.current) return;

            // Unwrap the paragraph element that is created.
            let paragraph = container.current.querySelector("p");
            if (paragraph) {
                container.current.innerHTML = paragraph.innerHTML;
                paragraph.remove();
            }
        });
    }, [content, sourcePath, container.current]);

    return <span ref={container} style={style} class={cls} onClick={onClick}></span>;
}

/** Hacky wrapper around the asynchronous 'renderValue' operation; this should be remade to be native to react later. */
export function Lit({ value, sourcePath }: { value: Literal; sourcePath: string }) {
    const container = useRef<HTMLElement | null>(null);
    const component = useContext(DataviewContext).component;

    useEffect(() => {
        if (!container.current) return;
        container.current.innerHTML = "";
        renderValue(value, container.current, sourcePath, component, DEFAULT_QUERY_SETTINGS);
    }, [value, sourcePath, container.current]);

    return <span ref={container}></span>;
}

/** Render a simple nice looking error box in a code style. */
export function ErrorPre(props: { children: ComponentChildren }, {}) {
    return <pre class="dataview dataview-error">{props.children}</pre>;
}

/** Render a pretty centered error message in a box. */
export function ErrorMessage({ message }: { message: string }) {
    return (
        <div class="dataview dataview-error-box">
            <p class="dataview dataview-error-message">{message}</p>
        </div>
    );
}

/** A react element which produces nothing. */
export const Nothing = () => null;

/**
 * Complex convienence hook which calls `compute` every time the index updates, updating the current state.
 */
export function useIndexBackedState<T>(
    container: HTMLElement,
    app: App,
    settings: DataviewSettings,
    index: FullIndex,
    initial: T,
    compute: () => Promise<T>
): T {
    let [initialized, setInitialized] = useState(false);
    let [state, updateState] = useState(initial);
    let [lastReload, setLastReload] = useState(index.revision);

    if (!initialized) {
        compute().then(v => updateState(v));
        setInitialized(true);
    }

    // Updated on every container re-create; automatically updates state.
    useEffect(() => {
        let refreshOperation = () => {
            if (lastReload != index.revision && container.isShown() && settings.refreshEnabled) {
                setLastReload(index.revision);
                compute().then(v => updateState(v));
            }
        };

        // Refresh after index changes stop.
        let workEvent = app.workspace.on("dataview:refresh-views", refreshOperation);
        // ...or when the DOM is shown (sidebar expands, tab selected, nodes scrolled into view).
        let nodeEvent = container.onNodeInserted(refreshOperation);

        return () => {
            app.workspace.offref(workEvent);
            nodeEvent();
        };
    }, [container]);

    return state;
}

/** A trivial wrapper which  */
export class ReactRenderer extends MarkdownRenderChild {
    public constructor(
        public app: App,
        public settings: DataviewSettings,
        public index: FullIndex,
        container: HTMLElement,
        public element: h.JSX.Element
    ) {
        super(container);
    }

    public onload(): void {
        const context = {
            app: this.app,
            settings: this.settings,
            index: this.index,
            component: this,
            container: this.containerEl,
        };
        render(<DataviewContext.Provider value={context}>{this.element}</DataviewContext.Provider>, this.containerEl);
    }

    public onunload(): void {
        unmountComponentAtNode(this.containerEl);
    }
}
