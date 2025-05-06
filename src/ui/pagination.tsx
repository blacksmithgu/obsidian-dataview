import { Fragment, h, JSX } from "preact";
import { useState } from "preact/hooks";
import { useContext } from "preact/hooks";
import { DataviewContext } from "./markdown";

export function withPagination<T>(items: T[], render: (pageItems: T[]) => JSX.Element) {
    const context = useContext(DataviewContext);
    if (!context.settings.enablePagination) {
        return render(items);
    }

    const defaultItemsPerPageCount = context.settings.itemPerPageOptions[0] ?? Number.MAX_SAFE_INTEGER;
    const [itemsPerPageCount, setItemsPerPageCount] = useState(defaultItemsPerPageCount);
    const totalPagesCount = Math.ceil(items.length / itemsPerPageCount);

    if (
        totalPagesCount <= 1 &&
        itemsPerPageCount === defaultItemsPerPageCount &&
        !context.settings.enablePaginationForShortResults
    ) {
        return render(items);
    }

    const [currentPageNumber, setCurrentPageNumber] = useState(1);

    const startIndex = (currentPageNumber - 1) * itemsPerPageCount;
    const endIndex = startIndex + itemsPerPageCount;
    const currentPageItems = items.slice(startIndex, endIndex);

    const minMiddlePageNumber = Math.max(1, currentPageNumber - 2);
    const maxMiddlePageNumber = Math.min(totalPagesCount, currentPageNumber + 2);
    const middlePageNumbers =
        minMiddlePageNumber > maxMiddlePageNumber
            ? []
            : Array.from({ length: maxMiddlePageNumber - minMiddlePageNumber + 1 }, (_, i) => minMiddlePageNumber + i);

    return (
        <Fragment>
            {render(currentPageItems)}
            <div className="pagination">
                <div>
                    {createPageLink("First", 1, currentPageNumber == 1)}
                    {createPageLink("Previous", currentPageNumber - 1, currentPageNumber == 1)}
                    {currentPageNumber > 3 && <span>...</span>}
                    {middlePageNumbers.map(middlePageNumber =>
                        createPageLink(
                            middlePageNumber.toString(),
                            middlePageNumber,
                            middlePageNumber == currentPageNumber
                        )
                    )}
                    {currentPageNumber < totalPagesCount - 2 && <span>...</span>}
                    {createPageLink("Next", currentPageNumber + 1, currentPageNumber == totalPagesCount)}
                    {createPageLink("Last", totalPagesCount, currentPageNumber == totalPagesCount)}
                </div>
                <div>
                    <span>Items per page: </span>
                    <select className="dropdown" onChange={handleItemsPerPageChanged}>
                        {context.settings.itemPerPageOptions.map(value => (
                            <option value={value}>{value}</option>
                        ))}
                    </select>
                    <span>Jump to page: </span>
                    <input type="number" onKeyDown={handleJumpToPage} min="1" max={totalPagesCount} />
                </div>
                <div>
                    <span>
                        Page {currentPageNumber} of {totalPagesCount}, Total items: {items.length}
                    </span>
                </div>
            </div>
        </Fragment>
    );

    function createPageLink(text: string, pageNumber: number, isDisabled = false) {
        const classList = ["page-link"];
        if (isDisabled) {
            classList.push("disabled");
        }
        if (pageNumber === currentPageNumber) {
            classList.push("current");
        }

        return (
            <a className={classList.join(" ")} onClick={evt => handleClick(evt, pageNumber, isDisabled)}>
                {text}
            </a>
        );
    }

    function handleClick(evt: MouseEvent, pageNumber: number, isDisabled: boolean) {
        evt.preventDefault();
        if (isDisabled) {
            return;
        }

        setCurrentPageNumber(pageNumber);
    }

    function handleJumpToPage(evt: KeyboardEvent) {
        if (evt.key !== "Enter") {
            return;
        }
        const input = evt.target as HTMLInputElement;
        if (!input.reportValidity()) {
            return;
        }
        setCurrentPageNumber(Number(input.value));
    }

    function handleItemsPerPageChanged(evt: Event) {
        const select = evt.target as HTMLSelectElement;
        setItemsPerPageCount(Number(select.value));
        setCurrentPageNumber(1);
    }
}
