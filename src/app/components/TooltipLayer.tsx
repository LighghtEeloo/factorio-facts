import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface TooltipState {
  rect: DOMRect;
  text: string;
}

interface TooltipPosition {
  left: number;
  placement: "top" | "bottom";
  top: number;
}

const tooltipSelector = "[data-tooltip]";
const viewportPadding = 8;
const tooltipGap = 8;

export function TooltipLayer() {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const activeTarget = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function showForTarget(target: HTMLElement | null) {
      const text = target?.dataset.tooltip?.trim();

      if (!target || !text) {
        return;
      }

      activeTarget.current = target;
      setPosition(null);
      setTooltip({ rect: target.getBoundingClientRect(), text });
    }

    function hideForTarget(target: HTMLElement | null, nextTarget: EventTarget | null) {
      if (!target || (nextTarget instanceof Node && target.contains(nextTarget))) {
        return;
      }

      if (activeTarget.current === target) {
        activeTarget.current = null;
        setTooltip(null);
        setPosition(null);
      }
    }

    function handlePointerOver(event: PointerEvent) {
      showForTarget(findTooltipTarget(event.target));
    }

    function handlePointerOut(event: PointerEvent) {
      hideForTarget(findTooltipTarget(event.target), event.relatedTarget);
    }

    function handleFocusIn(event: FocusEvent) {
      showForTarget(findTooltipTarget(event.target));
    }

    function handleFocusOut(event: FocusEvent) {
      hideForTarget(findTooltipTarget(event.target), event.relatedTarget);
    }

    function syncPosition() {
      const target = activeTarget.current;

      if (!target?.isConnected) {
        activeTarget.current = null;
        setTooltip(null);
        setPosition(null);
        return;
      }

      setTooltip((current) =>
        current ? { ...current, rect: target.getBoundingClientRect() } : current,
      );
    }

    document.addEventListener("pointerover", handlePointerOver);
    document.addEventListener("pointerout", handlePointerOut);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);
    document.addEventListener("click", syncPosition);
    window.addEventListener("resize", syncPosition);
    window.addEventListener("scroll", syncPosition, true);

    return () => {
      document.removeEventListener("pointerover", handlePointerOver);
      document.removeEventListener("pointerout", handlePointerOut);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
      document.removeEventListener("click", syncPosition);
      window.removeEventListener("resize", syncPosition);
      window.removeEventListener("scroll", syncPosition, true);
    };
  }, []);

  useLayoutEffect(() => {
    if (!tooltip || !tooltipRef.current) {
      return;
    }

    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const anchorCenter = tooltip.rect.left + tooltip.rect.width / 2;
    const preferredTop = tooltip.rect.top - tooltipRect.height - tooltipGap;
    const placement = preferredTop >= viewportPadding ? "top" : "bottom";
    const unclampedTop =
      placement === "top" ? preferredTop : tooltip.rect.bottom + tooltipGap;
    const maxLeft = window.innerWidth - tooltipRect.width - viewportPadding;
    const maxTop = window.innerHeight - tooltipRect.height - viewportPadding;
    const nextPosition: TooltipPosition = {
      left: clamp(
        anchorCenter - tooltipRect.width / 2,
        viewportPadding,
        Math.max(viewportPadding, maxLeft),
      ),
      placement,
      top: clamp(
        unclampedTop,
        viewportPadding,
        Math.max(viewportPadding, maxTop),
      ),
    };

    setPosition((current) =>
      current &&
      current.left === nextPosition.left &&
      current.top === nextPosition.top &&
      current.placement === nextPosition.placement
        ? current
        : nextPosition,
    );
  }, [tooltip]);

  if (!tooltip) {
    return null;
  }

  return createPortal(
    <div
      className={`tooltip-layer tooltip-layer--${position?.placement ?? "top"}`}
      ref={tooltipRef}
      role="tooltip"
      style={{
        left: position?.left ?? 0,
        top: position?.top ?? 0,
        visibility: position ? "visible" : "hidden",
      }}
    >
      {tooltip.text}
    </div>,
    document.body,
  );
}

function findTooltipTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) {
    return null;
  }

  return target.closest<HTMLElement>(tooltipSelector);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
