import { setEmojiShorthandCompletionField, setInlineField } from "data-import/inline-field";
import { LIST_ITEM_REGEX } from "data-import/markdown-file";
import { SListEntry, SListItem, STask } from "data-model/serialized/markdown";
import { Grouping, Groupings } from "data-model/value";
import { DateTime } from "luxon";
import { MarkdownRenderChild, Platform, Vault } from "obsidian";
import { Fragment, h } from "preact";
import { useContext } from "preact/hooks";
import { executeTask } from "query/engine";
import { Query } from "query/query";
import {
    DataviewContext,
    ErrorPre,
    ErrorMessage,
    Lit,
    Markdown,
    ReactRenderer,
    useIndexBackedState,
    DataviewInit,
} from "ui/markdown";
import { asyncTryOrPropogate } from "util/normalize";

/** JSX component which renders a task element recursively. */
function TaskItem({ item }: { item: STask }) {
    let context = useContext(DataviewContext);

    // Navigate to the given task on click.
    const onClicked = (evt: preact.JSX.TargetedMouseEvent<HTMLElement>) => {
        // Skip this event if a link was pressed.
        if (evt.target != null && evt.target != undefined && (evt.target as HTMLElement).tagName == "A") {
            return;
        }

        evt.stopPropagation();
        const selectionState = {
            eState: {
                cursor: {
                    from: { line: item.line, ch: item.position.start.col },
                    to: { line: item.line + item.lineCount - 1, ch: item.position.end.col },
                },
                line: item.line,
            },
        };

        // MacOS interprets the Command key as Meta.
        context.app.workspace.openLinkText(
            item.link.toFile().obsidianLink(),
            item.path,
            evt.ctrlKey || (evt.metaKey && Platform.isMacOS),
            selectionState as any
        );
    };

    // Check/uncheck trhe task in the original file.
    const onChecked = (evt: preact.JSX.TargetedEvent<HTMLInputElement>) => {
        evt.stopPropagation();

        const completed = evt.currentTarget.checked;
        const status = completed ? "x" : " ";

        // Update data-task on the parent element (css style)
        const parent = evt.currentTarget.parentElement;
        parent?.setAttribute("data-task", status);

        let updatedText = undefined;
        if (context.settings.taskCompletionTracking)
            updatedText = setTaskCompletion(
                item.text,
                context.settings.taskCompletionUseEmojiShorthand,
                context.settings.taskCompletionText,
                context.settings.taskCompletionDateFormat,
                completed
            );

        rewriteTask(context.app.vault, item, status, updatedText);
    };

    const checked = item.status !== " ";
    return (
        <li
            class={"dataview task-list-item" + (checked ? " is-checked" : "")}
            onClick={onClicked}
            data-task={item.status}
        >
            <input class="dataview task-list-item-checkbox" type="checkbox" checked={checked} onClick={onChecked} />
            <Markdown inline={true} content={item.visual ?? item.text} sourcePath={item.path} />
            {item.children.length > 0 && <TaskList items={item.children} />}
        </li>
    );
}

/** JSX component which renders a plain list item recursively. */
function ListItem({ item }: { item: SListEntry }) {
    return (
        <li class="dataview task-list-basic-item">
            <Markdown inline={true} content={item.visual ?? item.text} sourcePath={item.path} />
            {item.children.length > 0 && <TaskList items={item.children} />}
        </li>
    );
}

/** JSX component which renders a list of task items recursively. */
function TaskList({ items }: { items: SListItem[] }) {
    const settings = useContext(DataviewContext).settings;
    if (items.length == 0 && settings.warnOnEmptyResult)
        return <ErrorMessage message="Dataview: No results to show for task query." />;

    let [nest, _mask] = nestItems(items);
    return (
        <ul class="contains-task-list">
            {nest.map(item =>
                item.task ? <TaskItem key={listId(item)} item={item} /> : <ListItem key={listId(item)} item={item} />
            )}
        </ul>
    );
}

/** JSX component which recursively renders grouped tasks. */
function TaskGrouping({ items, sourcePath }: { items: Grouping<SListItem>; sourcePath: string }) {
    const isGrouping = items.length > 0 && Groupings.isGrouping(items);

    return (
        <Fragment>
            {isGrouping &&
                items.map(item => (
                    <Fragment key={item.key}>
                        <h4>
                            <Lit value={item.key} sourcePath={sourcePath} />
                            <span class="dataview small-text">{Groupings.count(item.rows)}</span>
                        </h4>
                        <div class="dataview result-group">
                            <TaskGrouping items={item.rows} sourcePath={sourcePath} />
                        </div>
                    </Fragment>
                ))}
            {!isGrouping && <TaskList items={items as SListItem[]} />}
        </Fragment>
    );
}

export type TaskViewState =
    | { state: "loading" }
    | { state: "error"; error: string }
    | { state: "ready"; items: Grouping<SListItem> };

/**
 * Pure view over (potentially grouped) tasks and list items which allows for checking/unchecking tasks and manipulating
 * the task view.
 */
export function TaskView({ query, sourcePath }: { query: Query; sourcePath: string }) {
    let context = useContext(DataviewContext);

    let items = useIndexBackedState<TaskViewState>(
        context.container,
        context.app,
        context.settings,
        context.index,
        { state: "loading" },
        async () => {
            let result = await asyncTryOrPropogate(() =>
                executeTask(query, sourcePath, context.index, context.settings)
            );
            if (!result.successful) return { state: "error", error: result.error, sourcePath };
            else return { state: "ready", items: result.value.tasks };
        }
    );

    if (items.state == "loading")
        return (
            <Fragment>
                <ErrorPre>Loading</ErrorPre>
            </Fragment>
        );
    else if (items.state == "error")
        return (
            <Fragment>
                <ErrorPre>Dataview: {items.error}</ErrorPre>
            </Fragment>
        );

    return (
        <div class="dataview dataview-container">
            <TaskGrouping items={items.items} sourcePath={sourcePath} />
        </div>
    );
}

export function createTaskView(init: DataviewInit, query: Query, sourcePath: string): MarkdownRenderChild {
    return new ReactRenderer(init, <TaskView query={query} sourcePath={sourcePath} />);
}

export function createFixedTaskView(
    init: DataviewInit,
    items: Grouping<SListItem>,
    sourcePath: string
): MarkdownRenderChild {
    return new ReactRenderer(init, <TaskGrouping items={items} sourcePath={sourcePath} />);
}

/////////////////////////
// Task De-Duplication //
/////////////////////////

function listId(item: SListItem): string {
    return item.path + ":" + item.line;
}

function parentListId(item: SListItem): string {
    return item.path + ":" + item.parent;
}

/** Compute a map of all task IDs -> tasks. */
function enumerateChildren(item: SListItem, output: Map<string, SListItem>): Map<string, SListItem> {
    if (!output.has(listId(item))) output.set(listId(item), item);
    for (let child of item.children) enumerateChildren(child, output);

    return output;
}

/** Replace basic tasks with tasks from a lookup map. Retains the original order of the list. */
function replaceChildren(elements: SListItem[], lookup: Map<string, SListItem>): SListItem[] {
    return elements.map(element => {
        element.children = replaceChildren(element.children, lookup);

        const id = listId(element);
        const map = lookup.get(id);

        if (map) return map;
        else return element;
    });
}

/**
 * Removes tasks from a list if they are already present by being a child of another task. Fixes child pointers.
 * Retains original order of input list.
 */
export function nestItems(raw: SListItem[]): [SListItem[], Set<string>] {
    let elements: Map<string, SListItem> = new Map();
    let mask: Set<string> = new Set();

    for (let elem of raw) {
        let id = listId(elem);
        elements.set(id, elem);
        mask.add(id);
    }

    // List all elements & their children in the lookup map.
    for (let elem of raw) enumerateChildren(elem, elements);

    let roots = raw.filter(
        elem => elem.parent == undefined || elem.parent == null || !elements.has(parentListId(elem))
    );
    return [replaceChildren(roots, elements), mask];
}

/**
 * Recursively removes tasks from each subgroup if they are already present by being a child of another task.
 * Fixes child pointers. Retains original order of input list.
 */
export function nestGroups(raw: Grouping<SListItem>): Grouping<SListItem> {
    if (Groupings.isGrouping(raw)) {
        return raw.map(g => {
            return { key: g.key, rows: nestGroups(g.rows) };
        });
    } else {
        return nestItems(raw)[0];
    }
}

///////////////////////
// Task Manipulation //
///////////////////////

/** Trim empty ending lines. */
function trimEndingLines(text: string): string {
    let parts = text.split(/\r?\n/u);
    let trim = parts.length - 1;
    while (trim > 0 && parts[trim].trim() == "") trim--;

    return parts.join("\n");
}

/** Set the task completion key on check. */
export function setTaskCompletion(
    originalText: string,
    useEmojiShorthand: boolean,
    completionKey: string,
    completionDateFormat: string,
    complete: boolean
): string {
    if (!complete && !useEmojiShorthand) return trimEndingLines(setInlineField(originalText, completionKey));

    let parts = originalText.split(/\r?\n/u);

    if (useEmojiShorthand) {
        parts[parts.length - 1] = setEmojiShorthandCompletionField(
            parts[parts.length - 1],
            complete ? DateTime.now().toFormat("yyyy-MM-dd") : ""
        );
    } else {
        parts[parts.length - 1] = setInlineField(
            parts[parts.length - 1],
            completionKey,
            DateTime.now().toFormat(completionDateFormat)
        );
    }
    return parts.join("\n");
}

/** Rewrite a task with the given completion status and new text. */
export async function rewriteTask(vault: Vault, task: STask, desiredStatus: string, desiredText?: string) {
    if (desiredStatus == task.status && (desiredText == undefined || desiredText == task.text)) return;
    desiredStatus = desiredStatus == "" ? " " : desiredStatus;

    let rawFiletext = await vault.adapter.read(task.path);
    let hasRN = rawFiletext.contains("\r");
    let filetext = rawFiletext.split(/\r?\n/u);

    if (filetext.length < task.line) return;
    let match = LIST_ITEM_REGEX.exec(filetext[task.line]);
    if (!match || match[2].length == 0) return;

    let taskTextParts = task.text.split("\n");
    if (taskTextParts[0].trim() != match[3].trim()) return;

    // We have a positive match here at this point, so go ahead and do the rewrite of the status.
    let initialSpacing = /^[\s>]*/u.exec(filetext[task.line])!![0];
    if (desiredText) {
        let desiredParts = desiredText.split("\n");

        let newTextLines: string[] = [`${initialSpacing}${task.symbol} [${desiredStatus}] ${desiredParts[0]}`].concat(
            desiredParts.slice(1).map(l => initialSpacing + "\t" + l)
        );

        filetext.splice(task.line, task.lineCount, ...newTextLines);
    } else {
        filetext[task.line] = `${initialSpacing}${task.symbol} [${desiredStatus}] ${taskTextParts[0].trim()}`;
    }

    let newText = filetext.join(hasRN ? "\r\n" : "\n");
    await vault.adapter.write(task.path, newText);
}
