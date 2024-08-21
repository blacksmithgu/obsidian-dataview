/** Provides core preact / rendering utilities for all view types. */
import { App, MarkdownRenderChild, MarkdownRenderer } from "obsidian";
import { h, createContext, ComponentChildren, render, Fragment } from "preact";
import { useContext, useEffect, useRef, useState } from "preact/hooks";
import { Component } from "obsidian";
import { DataviewSettings } from "settings";
import { FullIndex } from "data-index";
import { Literal, Values, Widgets } from "data-model/value";
import React, { unmountComponentAtNode } from "preact/compat";
import { renderMinimalDate, renderMinimalDuration } from "util/normalize";
import { currentLocale } from "util/locale";
import { DataArray } from "api/data-array";
import { extractImageDimensions, isImageEmbed } from "util/media";

export type MarkdownProps = { contents: string; sourcePath: string };
export type MarkdownContext = { component: Component };

/** Context need to create dataviews. */
export type DataviewInit = {
    app: App;
    index: FullIndex;
    settings: DataviewSettings;
    container: HTMLElement;
};

/** Shared context for dataview views and objects. */
export type DataviewContexts = DataviewInit & {
    component: Component;
};

export const DataviewContext = createContext<DataviewContexts>(undefined!);

/** Hacky preact component which wraps Obsidian's markdown renderer into a neat component. */
export function RawMarkdown({
    content,
    sourcePath,
    inline = true,
    style,
    cls,
    onClick,
}: {
    content: string;
    sourcePath: string;
    inline?: boolean;
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
            if (!container.current || !inline) return;

            // Unwrap any created paragraph elements if we are inline.
            let paragraph = container.current.querySelector("p");
            while (paragraph) {
                let children = paragraph.childNodes;
                paragraph.replaceWith(...Array.from(children));
                paragraph = container.current.querySelector("p");
            }
        });
    }, [content, sourcePath, container.current]);

    return <span ref={container} style={style} class={cls} onClick={onClick}></span>;
}

/** Hacky preact component which wraps Obsidian's markdown renderer into a neat component. */
export const Markdown = React.memo(RawMarkdown);

/** Embeds an HTML element in the react DOM. */
export function RawEmbedHtml({ element }: { element: HTMLElement }) {
    const container = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!container.current) return;
        container.current.innerHTML = "";
        container.current.appendChild(element);
    }, [container.current, element]);

    return <span ref={container}></span>;
}

/** Embeds an HTML element in the react DOM. */
export const EmbedHtml = React.memo(RawEmbedHtml);

/** Intelligently render an arbitrary literal value. */
export function RawLit({
    value,
    sourcePath,
    inline = false,
    depth = 0,
}: {
    value: Literal | undefined;
    sourcePath: string;
    inline?: boolean;
    depth?: number;
}) {
    const context = useContext(DataviewContext);

    // Short-circuit if beyond the maximum render depth.
    if (depth >= context.settings.maxRecursiveRenderDepth) return <Fragment>...</Fragment>;

    if (Values.isNull(value) || value === undefined) {
        return <Markdown content={context.settings.renderNullAs} sourcePath={sourcePath} />;
    } else if (Values.isString(value)) {
        return <Markdown content={value} sourcePath={sourcePath} />;
    } else if (Values.isNumber(value)) {
        return <Fragment>{"" + value}</Fragment>;
    } else if (Values.isBoolean(value)) {
        return <Fragment>{"" + value}</Fragment>;
    } else if (Values.isDate(value)) {
        return <Fragment>{renderMinimalDate(value, context.settings, currentLocale())}</Fragment>;
    } else if (Values.isDuration(value)) {
        return <Fragment>{renderMinimalDuration(value)}</Fragment>;
    } else if (Values.isLink(value)) {
        // Special case handling of image/video/etc embeddings to bypass the Obsidian API not working.
        if (isImageEmbed(value)) {
            let realFile = context.app.metadataCache.getFirstLinkpathDest(value.path, sourcePath);
            if (!realFile) return <Markdown content={value.markdown()} sourcePath={sourcePath} />;

            let dimensions = extractImageDimensions(value);
            let resourcePath = context.app.vault.getResourcePath(realFile);

            if (dimensions && dimensions.length == 2)
                return <img alt={value.path} src={resourcePath} width={dimensions[0]} height={dimensions[1]} />;
            else if (dimensions && dimensions.length == 1)
                return <img alt={value.path} src={resourcePath} width={dimensions[0]} />;
            else return <img alt={value.path} src={resourcePath} />;
        }

        return <Markdown content={value.markdown()} sourcePath={sourcePath} />;
    } else if (Values.isHtml(value)) {
        return <EmbedHtml element={value} />;
    } else if (Values.isWidget(value)) {
        if (Widgets.isListPair(value)) {
            return (
                <Fragment>
                    <Lit value={value.key} sourcePath={sourcePath} />:{" "}
                    <Lit value={value.value} sourcePath={sourcePath} />
                </Fragment>
            );
        } else if (Widgets.isExternalLink(value)) {
            return (
                <a href={value.url} rel="noopener" target="_blank" class="external-link">
                    {value.display ?? value.url}
                </a>
            );
        } else {
            return <b>&lt;unknown widget '{value.$widget}'&gt;</b>;
        }
    } else if (Values.isFunction(value)) {
        return <Fragment>&lt;function&gt;</Fragment>;
    } else if (Values.isArray(value) || DataArray.isDataArray(value)) {
        if (!inline) {
            return (
                <ul class={"dataview dataview-ul dataview-result-list-ul"}>
                    {value.map(subvalue => (
                        <li class="dataview-result-list-li">
                            <Lit value={subvalue} sourcePath={sourcePath} inline={inline} depth={depth + 1} />
                        </li>
                    ))}
                </ul>
            );
        } else {
            if (value.length == 0) return <Fragment>&lt;Empty List&gt;</Fragment>;

            return (
                <span class="dataview dataview-result-list-span">
                    {value.map((subvalue, index) => (
                        <Fragment>
                            {index == 0 ? "" : ", "}
                            <Lit value={subvalue} sourcePath={sourcePath} inline={inline} depth={depth + 1} />
                        </Fragment>
                    ))}
                </span>
            );
        }
    } else if (Values.isObject(value)) {
        // Don't render classes in case they have recursive references; spoopy.
        if (value?.constructor?.name && value?.constructor?.name != "Object") {
            return <Fragment>&lt;{value.constructor.name}&gt;</Fragment>;
        }

        if (!inline) {
            return (
                <ul class="dataview dataview-ul dataview-result-object-ul">
                    {Object.entries(value).map(([key, value]) => (
                        <li class="dataview dataview-li dataview-result-object-li">
                            {key}: <Lit value={value} sourcePath={sourcePath} inline={inline} depth={depth + 1} />
                        </li>
                    ))}
                </ul>
            );
        } else {
            if (Object.keys(value).length == 0) return <Fragment>&lt;Empty Object&gt;</Fragment>;

            return (
                <span class="dataview dataview-result-object-span">
                    {Object.entries(value).map(([key, value], index) => (
                        <Fragment>
                            {index == 0 ? "" : ", "}
                            {key}: <Lit value={value} sourcePath={sourcePath} inline={inline} depth={depth + 1} />
                        </Fragment>
                    ))}
                </span>
            );
        }
    }

    return <Fragment>&lt;Unrecognized: {JSON.stringify(value)}&gt;</Fragment>;
}

/** Intelligently render an arbitrary literal value. */
export const Lit = React.memo(RawLit);

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

/**
 * Complex convenience hook which calls `compute` every time the index updates, updating the current state.
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

    // Initial setup to queue fetching the correct state.
    if (!initialized) {
        setLastReload(index.revision);
        setInitialized(true);

        compute().then(updateState);
    }

    // Updated on every container re-create; automatically updates state.
    useEffect(() => {
        const refreshOperation = () => {
            if (lastReload != index.revision && container.isShown() && settings.refreshEnabled) {
                compute().then(updateState);
                setLastReload(index.revision);
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
    }, [container, lastReload]);

    return state;
}

/** A trivial wrapper which allows a react component to live for the duration of a `MarkdownRenderChild`. */
export class ReactRenderer extends MarkdownRenderChild {
    public constructor(public init: DataviewInit, public element: h.JSX.Element) {
        super(init.container);
    }

    public onload(): void {
        const context = Object.assign({}, { component: this }, this.init);
        render(<DataviewContext.Provider value={context}>{this.element}</DataviewContext.Provider>, this.containerEl);
    }

    public onunload(): void {
        unmountComponentAtNode(this.containerEl);
    }
}
