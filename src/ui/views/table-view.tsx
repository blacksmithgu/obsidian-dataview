import { Literal } from "data-model/value";
import { executeTable } from "query/engine";
import { Query } from "query/query";
import { asyncTryOrPropagate } from "util/normalize";
import {
    DataviewContext,
    DataviewInit,
    ErrorMessage,
    ErrorPre,
    Lit,
    Markdown,
    ReactRenderer,
    useIndexBackedState,
} from "ui/markdown";
import { h, Fragment } from "preact";
import { useContext } from "preact/hooks";
import { MarkdownRenderChild } from "obsidian";

/** JSX component which returns the result count. */
function ResultCount(props: { length: number }) {
    const { settings } = useContext(DataviewContext);
    return settings.showResultCount ? <span class="dataview small-text">{props.length}</span> : <Fragment></Fragment>;
}

/** Simple table over headings and corresponding values. */
export function TableGrouping({
    headings,
    values,
    sourcePath,
}: {
    headings: string[];
    values: Literal[][];
    sourcePath: string;
}) {
    let settings = useContext(DataviewContext).settings;

    return (
        <Fragment>
            <table class="dataview table-view-table">
                <thead class="table-view-thead">
                    <tr class="table-view-tr-header">
                        {headings.map((heading, index) => (
                            <th class="table-view-th">
                                <Markdown sourcePath={sourcePath} content={heading} />
                                {index == 0 && <ResultCount length={values.length} />}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody class="table-view-tbody">
                    {values.map(row => (
                        <tr>
                            {row.map(element => (
                                <td>
                                    <Lit value={element} sourcePath={sourcePath} />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            {settings.warnOnEmptyResult && values.length == 0 && (
                <ErrorMessage message="Dataview: No results to show for table query." />
            )}
        </Fragment>
    );
}

export type TableViewState =
    | { state: "loading" }
    | { state: "error"; error: string }
    | { state: "ready"; headings: string[]; values: Literal[][] };

/** Pure view over list elements.  */
export function TableView({ query, sourcePath }: { query: Query; sourcePath: string }) {
    let context = useContext(DataviewContext);

    let items = useIndexBackedState<TableViewState>(
        context.container,
        context.app,
        context.settings,
        context.index,
        { state: "loading" },
        async () => {
            let result = await asyncTryOrPropagate(() =>
                executeTable(query, context.index, sourcePath, context.settings)
            );
            if (!result.successful) return { state: "error", error: result.error };
            return { state: "ready", headings: result.value.names, values: result.value.data };
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

    return <TableGrouping headings={items.headings} values={items.values} sourcePath={sourcePath} />;
}

export function createTableView(init: DataviewInit, query: Query, sourcePath: string): MarkdownRenderChild {
    return new ReactRenderer(init, <TableView query={query} sourcePath={sourcePath} />);
}

export function createFixedTableView(
    init: DataviewInit,
    headings: string[],
    values: Literal[][],
    sourcePath: string
): MarkdownRenderChild {
    return new ReactRenderer(init, <TableGrouping values={values} headings={headings} sourcePath={sourcePath} />);
}
