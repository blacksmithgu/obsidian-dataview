/** Utilities for preserving the user's scroll position across async Dataview re-renders. */

/** A captured scroll position, together with the element that owns the scroll. */
export type CapturedScroll = {
    el: HTMLElement;
    top: number;
};

/**
 * Finds the nearest ancestor of `container` that is actually scrolled, and records its position.
 * The scroll owner is the leaf view's scrollable content (`.view-content`), not the Dataview
 * container itself. Returns null when the view was not scrolled (nothing to restore).
 */
export function captureViewScroll(container: HTMLElement): CapturedScroll | null {
    let owner: HTMLElement | null = container.parentElement;
    while (owner != null && owner.scrollTop <= 0) owner = owner.parentElement;

    // Defensive fallback: if the walk finds nothing, try the leaf view's content element directly.
    if (owner == null) {
        let fallback = container.closest(".view-content") as HTMLElement | null;
        owner = fallback != null && fallback.scrollTop > 0 ? fallback : null;
    }

    return owner == null || owner.scrollTop <= 0 ? null : { el: owner, top: owner.scrollTop };
}

/** A guard holding a container's height while an async re-render clears and rebuilds it. */
export type HeightGuard = {
    /** The container's height when the guard was applied. */
    height: number;
    /** Releases this guard; the min-height is cleared only when the last guard on the element releases. */
    release(): void;
};

/** Per-element guard refcounts, so overlapping refreshes don't clear the guard early. */
const guardCounts = new WeakMap<HTMLElement, number>();
/** The min-height style value in force before the first guard was applied to each element. */
const guardPrevious = new WeakMap<HTMLElement, string>();

/**
 * Holds the container's height while an async re-render runs. Sets `min-height` synchronously,
 * so it must be called BEFORE the renderer clears the container's content: with the height
 * held, the browser cannot clamp the leaf view's scroll position while the content is
 * collapsed. Refcounted per element; a no-op guard when the container has no height.
 *
 * The returned guard is paired EXPLICITLY with this refresh's `scheduleSettledRestore` call
 * (the caller holds it and passes it in as the third argument): its height feeds the T1
 * write-time check and its release commits the rebuild, so it must belong to this refresh —
 * there is deliberately no per-element queue for a schedule to claim from.
 */
export function beginHeightPreserve(container: HTMLElement): HeightGuard {
    let height = container.offsetHeight;
    let release = (): void => {
        if (height <= 0) return;
        let remaining = (guardCounts.get(container) ?? 1) - 1;
        if (remaining > 0) {
            guardCounts.set(container, remaining);
            return;
        }
        guardCounts.delete(container);
        container.style.minHeight = guardPrevious.get(container) ?? "";
        guardPrevious.delete(container);
    };
    if (height > 0) {
        let count = (guardCounts.get(container) ?? 0) + 1;
        guardCounts.set(container, count);
        if (count === 1) {
            guardPrevious.set(container, container.style.minHeight);
            container.style.minHeight = height + "px";
        }
    }
    return { height, release };
}

/**
 * Writes a captured scroll position immediately. Skips the write when both container heights
 * are given and they differ by at least 4px: with the height guard in place, the content is
 * already anchored at the user's scroll position, and a stale pixel write would jump the view
 * by the height delta. No-op when there is nothing to restore.
 *
 * `heightAfter` must be measured at write time (post-release, post-layout); see `restoreViewScroll`.
 */
export function restoreViewScrollNow(
    captured: CapturedScroll | null,
    heightBefore?: number,
    heightAfter?: number
): void {
    if (captured == null || captured.top === 0) return;
    if (heightBefore != null && heightAfter != null && Math.abs(heightAfter - heightBefore) >= 4) return;
    captured.el.scrollTop = captured.top;
}

/**
 * Restores a captured scroll position. The write is deferred with `requestAnimationFrame` so it
 * happens after the re-rendered content is laid out; if the content shrank, the browser clamps
 * to the new maximum. No-op when there is nothing to restore.
 *
 * Pass the CONTAINER (not a pre-read height): the post-rebuild height is measured at WRITE TIME,
 * inside the rAF, i.e. after the height guard has been released and the new content has been
 * committed and laid out. Reading it at promise resolution (.then() microtask) races the content
 * insert and mis-fires the delta-skip (the 77px read; #2208, commit 3).
 * See `restoreViewScrollNow`.
 */
export function restoreViewScroll(
    captured: CapturedScroll | null,
    heightBefore?: number,
    container?: HTMLElement
): void {
    requestAnimationFrame(() =>
        restoreViewScrollNow(captured, heightBefore, container ? container.offsetHeight : undefined)
    );
}

/** Re-assert window: 2 s from the primary write, 3 re-asserts max, 4 px tolerance. */
const REASSERT_WINDOW_MS = 2000;
const REASSERT_MAX = 3;
const REASSERT_TOLERANCE_PX = 4;

/** Per-container in-flight window, so a newer refresh can supersede it. */
const pendingRestores = new WeakMap<HTMLElement, () => void>();

/**
 * Restores a captured scroll position after the rebuild settles (double rAF = T1), then
 * defends it against late programmatic overwrites (Obsidian's keep-caret-visible on the
 * re-render update; field: +59ms, #2208).
 *
 * DOM-only by design (#2208 field evidence): the working pipeline is
 * capture -> height guard -> write-time height check -> pixel write -> 2 s re-assert window.
 * No CodeMirror API is involved; the view is restored by writing `captured.top` back to the
 * scroll owner, exactly as in reading view (the legacy pixel path).
 *
 * `container` (optional) is the Dataview block container: it carries the write-time height
 * check, the detach cancel, and the per-container supersede. It must be held from BEFORE the
 * render clears the content.
 *
 * `guard` (optional) is the guard BEGUN BY THIS REFRESH — the object the matching
 * `beginHeightPreserve` call returned. The pairing is explicit: a schedule can never check or
 * release a foreign refresh's guard, even under overlapping refreshes with out-of-order
 * render resolution. Pass the no-op guard `beginHeightPreserve` returns when the container
 * has no height (the pairing stays honest, and everything degrades to the no-op path); pass
 * nothing (undefined/null) only when this refresh began no guard at all — then the release is
 * a no-op and the T1 write-time check has no pre-render height to compare against, so it
 * takes the pixel write (the legacy no-guard behavior).
 *
 * T1 = double rAF after the render/compute resolves: release the guard (commit-3 order:
 * BEFORE the height read), skip the write when the write-time container height differs from
 * the guard's height by >= 4px (with the guard the content is already anchored; a stale
 * pixel write would jump the view by the height delta), otherwise write `captured.top` to
 * `captured.el`. target := owner.scrollTop measured immediately after the write (the browser
 * clamps to the new maximum).
 *
 * Re-assert window (2 s, from T1). The ONLY trigger is the 'scroll' event on the owner —
 * the browser fires it for every programmatic scrollTop write as well, so no secondary
 * MutationObserver is needed (that path was CM-era scaffolding):
 *   - e.isTrusted === true  -> user scrolled -> CANCEL (never fight the user).
 *   - container detached (isConnected) -> CANCEL.
 *   - e.isTrusted === false and |owner.scrollTop - target| > 4px -> re-write captured.top,
 *     target := re-measured owner.scrollTop after the write, count++.
 *     > 3 re-asserts -> give up (the 4th event is ignored): bounded, no thrash.
 * Cancel additionally: a newer schedule on the same container (supersede, newest wins),
 * and the 2 s expiry. There is deliberately no doc-change cancel: with the CM layer gone
 * there is no doc signal to watch, and the window stays bounded by the 3-assert cap, the
 * 2 s expiry, and the user-scroll cancel.
 * Returns cancel(), used by the supersede path.
 */
export function scheduleSettledRestore(
    captured: CapturedScroll | null,
    container?: HTMLElement,
    guard?: HeightGuard | null
): () => void {
    // A newer refresh on the same container supersedes the in-flight window. The superseded
    // window's cancel() releases ITS OWN guard (the refcount keeps the newest guard's
    // min-height in force) — the pre-T1 supersede must not leak it.
    if (container != null) {
        let superseded = pendingRestores.get(container);
        pendingRestores.delete(container);
        if (superseded != null) superseded();
    }

    let cancelled = false;
    let guardReleased = false;
    let count = 0;
    let target: number | null = null;
    let onScroll: EventListener | null = null;
    let expiryTimer: ReturnType<typeof setTimeout> | null = null;

    const owner = captured?.el;

    // The guard is held until T1 (commit-3 order: released before the write) — or released
    // early when a newer refresh supersedes this window before T1: the superseding window's
    // guard (refcounted per element) is already applied, so min-height stays held. Idempotent.
    const releaseGuard = (): void => {
        if (!guardReleased) {
            guardReleased = true;
            guard?.release();
        }
    };

    const cancel = (): void => {
        if (cancelled) return;
        cancelled = true;
        releaseGuard();
        if (owner != null && onScroll != null) owner.removeEventListener("scroll", onScroll);
        if (expiryTimer != null) clearTimeout(expiryTimer);
        if (container != null && pendingRestores.get(container) === cancel) pendingRestores.delete(container);
    };
    if (container != null) pendingRestores.set(container, cancel);

    const offTarget = (): boolean =>
        owner != null && target != null && Math.abs(owner.scrollTop - target) > REASSERT_TOLERANCE_PX;

    const openWindow = (): void => {
        if (owner == null || captured == null) return;
        onScroll = (e: Event): void => {
            if (cancelled) return;
            if (e.isTrusted) {
                cancel(); // user scrolled: never fight the user
                return;
            }
            if (container != null && container.isConnected === false) {
                cancel();
                return;
            }
            if (offTarget() && count < REASSERT_MAX) {
                owner.scrollTop = captured.top;
                target = owner.scrollTop; // re-measured after the write (browser clamp)
                count++;
            }
        };
        owner.addEventListener("scroll", onScroll);
        expiryTimer = setTimeout(cancel, REASSERT_WINDOW_MS);
    };

    const t1 = (): void => {
        if (cancelled) return; // superseded before T1 (the guard was released at supersede)
        if (captured == null || captured.top === 0 || (container != null && container.isConnected === false)) {
            cancel(); // releases the guard; nothing to restore
            return;
        }
        releaseGuard(); // commit-3 order: release BEFORE the height read, i.e. before the write
        // Write-time height check (commit-2/3 heuristic): if the rebuilt content is a
        // genuinely different size, the content anchoring is authoritative.
        let heightBefore = guard?.height;
        let heightAfter = container?.offsetHeight;
        if (heightBefore != null && heightAfter != null && Math.abs(heightAfter - heightBefore) >= 4) {
            cancel();
            return;
        }
        captured.el.scrollTop = captured.top;
        target = captured.el.scrollTop; // browser clamps to the new maximum
        openWindow();
    };

    requestAnimationFrame(() => requestAnimationFrame(t1));
    return cancel;
}
