import { useEffect, useRef, type RefObject } from "react";
import { distance, type Point } from "@/lib/math";
import { toStagePoint } from "@/game/machines/shared";

export interface DragSession {
  active: boolean;
  pointerId: number | null;
  start: Point | null;
  current: Point | null;
  points: Point[];
  startedAt: number;
}

interface TraceDragOptions {
  enabled: boolean;
  /** Return false to ignore a press (e.g. it did not land on the handle). */
  canStart?: (point: Point) => boolean;
  onStart?: (session: DragSession) => void;
  /**
   * Called at most once per animation frame while the pointer moves.
   * Return true to end the drag right there, as if the pointer had been released.
   */
  onFrame?: (session: DragSession) => boolean | void;
  /** The pointer was released. */
  onEnd?: (session: DragSession) => void;
  /** The drag was interrupted (pointercancel, lost capture, tab hidden). */
  onCancel?: (session: DragSession) => void;
  /** Minimum travel, in stage units, before a new point is recorded. */
  minStep?: number;
}

const emptySession = (): DragSession => ({
  active: false,
  pointerId: null,
  start: null,
  current: null,
  points: [],
  startedAt: 0,
});

/**
 * One drag implementation for mouse, pen and touch (Pointer Events), attached
 * to `elementRef`. Points live outside React and rendering is driven by
 * requestAnimationFrame, so a drag never causes a render per pointer move.
 */
export function useTraceDrag(elementRef: RefObject<Element | null>, options: TraceDragOptions): void {
  const latest = useRef(options);

  useEffect(() => {
    latest.current = options;
  });

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    let session = emptySession();
    let frame: number | null = null;

    /** Ends the current drag without reporting it. */
    const reset = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      const { pointerId } = session;
      session = emptySession();
      if (pointerId !== null && element.hasPointerCapture?.(pointerId)) {
        try {
          element.releasePointerCapture(pointerId);
        } catch {
          // The pointer is already gone.
        }
      }
    };

    const interrupt = () => {
      if (!session.active) return;
      const snapshot = session;
      reset();
      latest.current.onCancel?.(snapshot);
    };

    const onPointerDown = (event: PointerEvent) => {
      const opts = latest.current;
      if (!opts.enabled || session.active) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;

      const point = toStagePoint(event, element);
      if (!point || (opts.canStart && !opts.canStart(point))) return;

      event.preventDefault();
      try {
        element.setPointerCapture(event.pointerId);
      } catch {
        // Capture is a nicety; the drag still works without it.
      }

      session = {
        active: true,
        pointerId: event.pointerId,
        start: point,
        current: point,
        points: [point],
        startedAt: performance.now(),
      };
      opts.onStart?.(session);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!session.active || event.pointerId !== session.pointerId) return;
      const point = toStagePoint(event, element);
      if (!point) return;

      session.current = point;
      const last = session.points[session.points.length - 1];
      if (distance(last, point) >= (latest.current.minStep ?? 1.5)) session.points.push(point);

      if (frame === null) {
        frame = requestAnimationFrame(() => {
          frame = null;
          const snapshot = session;
          if (!snapshot.active) return;
          if (latest.current.onFrame?.(snapshot) === true) {
            reset();
            latest.current.onEnd?.(snapshot);
          }
        });
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!session.active || event.pointerId !== session.pointerId) return;
      const snapshot = session;
      reset();
      latest.current.onEnd?.(snapshot);
    };

    const onPointerCancel = (event: PointerEvent) => {
      if (event.pointerId === session.pointerId) interrupt();
    };

    // A drag is never left dangling when the tab is hidden or focus is lost.
    const onVisibility = () => {
      if (document.hidden) interrupt();
    };

    const listen = element as HTMLElement;
    listen.addEventListener("pointerdown", onPointerDown);
    listen.addEventListener("pointermove", onPointerMove);
    listen.addEventListener("pointerup", onPointerUp);
    listen.addEventListener("pointercancel", onPointerCancel);
    listen.addEventListener("lostpointercapture", onPointerCancel);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", interrupt);

    return () => {
      listen.removeEventListener("pointerdown", onPointerDown);
      listen.removeEventListener("pointermove", onPointerMove);
      listen.removeEventListener("pointerup", onPointerUp);
      listen.removeEventListener("pointercancel", onPointerCancel);
      listen.removeEventListener("lostpointercapture", onPointerCancel);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", interrupt);
      reset();
    };
  }, [elementRef]);
}
