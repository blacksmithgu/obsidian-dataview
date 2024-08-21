import { MarkdownRenderChild } from "obsidian";
import { executeList } from "query/engine";
import { Query } from "query/query";
import { asyncTryOrPropagate } from "util/normalize";
import { useContext } from "preact/hooks";
import {
    DataviewContext,
    DataviewInit,
    ErrorMessage,
    ErrorPre,
    Lit,
    ReactRenderer,
    useIndexBackedState,
} from "ui/markdown";
import { h, Fragment } from "preact";
import { Literal } from "data-model/value";

export function ListGrouping({ items, sourcePath }: { items: Literal[]; sourcePath: string }) {
    return (
        <ul class="dataview list-view-ul">
            {items.map(item => (
                <li>
                    <Lit value={item} sourcePath={sourcePath} />
                </li>
            ))}
        </ul>
    );
}

export type ListViewState =
    | { state: "loading" }
    | { state: "error"; error: string }
    | { state: "ready"; items: Literal[] };

/** Pure view over list elements.  */
export function ListView({ query, sourcePath }: { query: Query; sourcePath: string }) {
    let context = useContext(DataviewContext);

    let items = useIndexBackedState<ListViewState>(
        context.container,
        context.app,
        context.settings,
        context.index,
        { state: "loading" },
        async () => {
            let result = await asyncTryOrPropagate(() =>
                executeList(query, context.index, sourcePath, context.settings)
            );

            if (!result.successful) return { state: "error", error: result.error, sourcePath };
            return { state: "ready", items: result.value.data };
        }
    );

    if (items.state == "loading")
        return (
            <Fragment>
                <ErrorPre>Loading...</ErrorPre>
            </Fragment>
        );
    else if (items.state == "error")
        return (
            <Fragment>
                {" "}
                <ErrorPre>Dataview: {items.error}</ErrorPre>{" "}
            </Fragment>
        );

    if (items.items.length == 0 && context.settings.warnOnEmptyResult)
        return <ErrorMessage message="Dataview: No results to show for list query." />;

    return <ListGrouping items={items.items} sourcePath={sourcePath} />;
}

export function createListView(init: DataviewInit, query: Query, sourcePath: string): MarkdownRenderChild {
    return new ReactRenderer(init, <ListView query={query} sourcePath={sourcePath} />);
}

export function createFixedListView(init: DataviewInit, elements: Literal[], sourcePath: string): MarkdownRenderChild {
    return new ReactRenderer(init, <ListGrouping items={elements} sourcePath={sourcePath} />);
}
