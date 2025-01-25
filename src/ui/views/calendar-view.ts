import { FullIndex } from "data-index";
import { Link } from "index";
import { App } from "obsidian";
import { Calendar, ICalendarSource, IDayMetadata, IDot } from "obsidian-calendar-ui";
import { executeCalendar } from "query/engine";
import { Query } from "query/query";
import { DataviewSettings } from "settings";
import { renderErrorPre } from "ui/render";
import { DataviewRefreshableRenderer } from "ui/refreshable-view";
import { asyncTryOrPropagate } from "util/normalize";
import type { Moment } from "moment";

// CalendarFile is a representation of a particular file, displayed in the calendar view.
// It'll be represented in the calendar as a dot.
interface CalendarFile extends IDot {
    link: Link;
}

export class DataviewCalendarRenderer extends DataviewRefreshableRenderer {
    private calendar: Calendar;
    constructor(
        public query: Query,
        public container: HTMLElement,
        public index: FullIndex,
        public origin: string,
        public settings: DataviewSettings,
        public app: App
    ) {
        super(container, index, app, settings);
    }

    async render() {
        this.container.innerHTML = "";
        let maybeResult = await asyncTryOrPropagate(() =>
            executeCalendar(this.query, this.index, this.origin, this.settings)
        );
        if (!maybeResult.successful) {
            renderErrorPre(this.container, "Dataview: " + maybeResult.error);
            return;
        } else if (maybeResult.value.data.length == 0 && this.settings.warnOnEmptyResult) {
            renderErrorPre(this.container, "Dataview: Query returned 0 results.");
            return;
        }
        let dateMap = new Map<string, CalendarFile[]>();
        for (let data of maybeResult.value.data) {
            const dot = {
                color: "default",
                className: "note",
                isFilled: true,
                link: data.link,
            };
            const d = data.date.toFormat("yyyyLLdd");
            if (!dateMap.has(d)) {
                dateMap.set(d, [dot]);
            } else {
                dateMap.get(d)?.push(dot);
            }
        }

        const querySource: ICalendarSource = {
            getDailyMetadata: async (date: Moment): Promise<IDayMetadata> => {
                return {
                    dots: dateMap.get(date.format("YYYYMMDD")) || [],
                };
            },
        };

        const sources: ICalendarSource[] = [querySource];
        const renderer = this;

        const debounce = (func: (...args: any[]) => void, wait: number) => {
            let timeout: NodeJS.Timeout;
            return (...args: any[]) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), wait);
            };
        };

        this.calendar = new Calendar({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            target: (this as any).container,
            props: {
                onHoverDay(date: Moment, targetEl: EventTarget): void {
                    const vals = dateMap.get(date.format("YYYYMMDD"));
                    if (!vals || vals.length == 0) {
                        return;
                    }
                    if (vals?.length == 0) {
                        return;
                    }
                    let currentHoverIndex = 0;

                    const showHoverElement = () => {
                        // Get the current value in prep for display on hover
                        const val = vals[currentHoverIndex];
                        if (!val) {
                            return;
                        }

                        // Trigger the "link-hover" event
                        renderer.app.workspace.trigger("link-hover", {}, targetEl, val.link.path, val.link.path);

                        // Move to the next note in the vals array
                        currentHoverIndex = (currentHoverIndex + 1) % vals.length;
                    };

                    // Debounced version of showHoverElement
                    const debouncedShowHoverElement = debounce(showHoverElement, 100); // 100ms

                    // Show the initial hover element
                    showHoverElement();

                    // Add event listener for mouse movement to loop through vals
                    targetEl.addEventListener('mousemove', debouncedShowHoverElement);
                },
                onClickDay: async date => {
                    const vals = dateMap.get(date.format("YYYYMMDD"));
                    if (!vals || vals.length == 0) {
                        return;
                    }
                    if (vals?.length == 0) {
                        return;
                    }
                    const file = renderer.app.metadataCache.getFirstLinkpathDest(vals[0].link.path, "");
                    if (file == null) {
                        return;
                    }
                    const leaf = renderer.app.workspace.getUnpinnedLeaf();
                    await leaf.openFile(file, { active: true });
                },
                showWeekNums: false,
                sources,
            },
        });
    }

    onClose(): Promise<void> {
        if (this.calendar) {
            this.calendar.$destroy();
        }
        return Promise.resolve();
    }
}
