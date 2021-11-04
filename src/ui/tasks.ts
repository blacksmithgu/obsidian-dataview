import { Vault, MarkdownRenderer, Component } from "obsidian";
import { TASK_REGEX } from "data/parse/markdown";
import { Grouping, Task } from "data/value";
import { renderValue } from "ui/render";
import { QuerySettings } from "settings";
import { DateTime } from "luxon";
import { setInlineField } from "data/parse/inline-field";

/**
 * Render a task grouping (indenting nested groupings for clarity). This will automatically bind the tasks to be checkable,
 * which requires access to a vault.
 */
export async function renderTasks(
    container: HTMLElement,
    tasks: Grouping<Task[]>,
    originFile: string,
    component: Component,
    vault: Vault,
    settings: QuerySettings
) {
    switch (tasks.type) {
        case "base":
            await renderTaskList(container, tasks.value, component, vault, settings);
            break;
        case "grouped":
            for (let { key, value } of tasks.groups) {
                let header = container.createEl("h4");
                await renderValue(key, header, originFile, component, settings);
                let div = container.createDiv({ cls: ["dataview", "result-group"] });
                await renderTasks(div, value, originFile, component, vault, settings);
            }
            break;
    }
}

/** Render a list of tasks as a single list. */
export async function renderTaskList(
    container: HTMLElement,
    tasks: Task[],
    component: Component,
    vault: Vault,
    settings: QuerySettings
) {
    let ul = container.createEl("ul", { cls: "contains-task-list" });
    for (let task of tasks) {
        let li = ul.createEl("li");

        if (task.real) {
            li.addClass("task-list-item");
            if (task.completed) li.addClass("is-checked");
        }

        // Append the task link if it is present.
        let text = task.text;
        switch (settings.taskLinkLocation) {
            case "start":
                if (!settings.taskLinkText) break;
                text = task.link.withDisplay(settings.taskLinkText).markdown() + " " + text;
                break;
            case "end":
                if (!settings.taskLinkText) break;
                text += " " + task.link.withDisplay(settings.taskLinkText).markdown();
                break;
            default:
                break;
        }

        // Render the text as markdown so that bolds, links, and other things work properly.
        await MarkdownRenderer.renderMarkdown(text, li, task.path, new Component());

        // Unwrap the paragraph element that is created.
        let paragraph = li.querySelector("p");
        if (paragraph) {
            li.innerHTML = paragraph.innerHTML;
            paragraph.remove();
        }

        if (task.real) {
            let checkbox = createCheckbox(task.path, task.line, task.text, task.completed);
            li.prepend(checkbox);

            addCheckHandler(checkbox, vault, component, settings);
        }

        if (task.subtasks.length > 0) {
            renderTaskList(li, task.subtasks, component, vault, settings);
        }
    }
}

function createCheckbox(file: string, line: number, text: string, checked: boolean): HTMLInputElement {
    let check = document.createElement("input");
    check.addClass("task-list-item-checkbox");
    check.type = "checkbox";
    check.dataset["file"] = file;
    check.dataset["lineno"] = "" + line;

    // This field is technically optional, but is provided to double-check
    // we are editing the right line!
    check.dataset["text"] = text;

    if (checked) {
        check.setAttribute("checked", "");
    }

    return check;
}

function addCheckHandler(checkbox: HTMLElement, vault: Vault, component: Component, settings: QuerySettings) {
    component.registerDomEvent(checkbox, "click", event => {
        let file = checkbox.dataset["file"];
        let lineno = checkbox.dataset["lineno"];
        let text = checkbox.dataset["text"];
        if (!file || !lineno || !text) return;

        if (!checkbox.hasAttribute("checked")) {
            let newCheckbox = createCheckbox(file, parseInt(lineno), text, true);

            checkbox.parentElement?.addClass("is-checked");
            checkbox.parentElement?.replaceChild(newCheckbox, checkbox);

            setTaskCheckedInFile(
                vault,
                file,
                parseInt(lineno),
                text,
                false,
                true,
                settings.taskCompletionTracking ? settings.taskCompletionText : undefined
            );
            addCheckHandler(newCheckbox, vault, component, settings);
        } else {
            let newCheckbox = createCheckbox(file, parseInt(lineno), text, false);

            checkbox.parentElement?.removeClass("is-checked");
            checkbox.parentElement?.replaceChild(newCheckbox, checkbox);

            setTaskCheckedInFile(
                vault,
                file,
                parseInt(lineno),
                text,
                true,
                false,
                settings.taskCompletionTracking ? settings.taskCompletionText : undefined
            );
            addCheckHandler(newCheckbox, vault, component, settings);
        }
    });
}

/** Check a task in a file by rewriting it. */
export async function setTaskCheckedInFile(
    vault: Vault,
    path: string,
    taskLine: number,
    taskText: string,
    wasChecked: boolean,
    check: boolean,
    completionKey?: string
) {
    if (check == wasChecked) return;

    let text = await vault.adapter.read(path);
    let splitText = text.replace("\r", "").split("\n");

    if (splitText.length < taskLine) return;
    let match = TASK_REGEX.exec(splitText[taskLine]);
    if (!match) return;

    let foundText = match[3];
    let checkMarking = match[2]
        .trim()
        .substring(1, match[2].trim().length - 1)
        .trim();
    let foundCompleted = checkMarking == "X" || checkMarking == "x";

    if (taskText.trim() != foundText.trim()) return;
    if (wasChecked != foundCompleted) return;

    let completion = undefined;
    if (check) {
        splitText[taskLine] = splitText[taskLine]
            .replace("- [ ]", "- [x]")
            .replace("- []", "- [x]")
            .replace("-[]", "- [x]")
            .replace("-[ ]", "- [x]")
            .replace("* [ ]", "* [x]")
            .replace("* []", "* [x]")
            .replace("*[]", "* [x]")
            .replace("*[ ]", "* [x]");
        completion = DateTime.now().toISODate();
    } else {
        splitText[taskLine] = splitText[taskLine]
            .replace("- [X]", "- [ ]")
            .replace("-[X]", "- [ ]")
            .replace("- [x]", "- [ ]")
            .replace("-[x]", "- [ ]")
            .replace("* [X]", "* [ ]")
            .replace("*[X]", "* [ ]")
            .replace("* [x]", "* [ ]")
            .replace("*[x]", "* [ ]");
    }

    // If we should add a completion key, then do so now.
    if (completionKey) splitText[taskLine] = setInlineField(splitText[taskLine], completionKey, completion);

    // Respect '\n' or '\r\n' just to be careful (mainly relevant to avoid bad git diffs for some users).
    let final = splitText.join(text.contains("\r") ? "\r\n" : "\n");
    await vault.adapter.write(path, final, {});
}
