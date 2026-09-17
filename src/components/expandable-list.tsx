"use client";

import { Children, type ReactNode, useId, useState } from "react";

export function ExpandableList({
  children,
  initialVisible,
  className,
  moreLabel,
  lessLabel = "Pokaż mniej",
}: {
  children: ReactNode;
  initialVisible: number;
  className: string;
  moreLabel: string;
  lessLabel?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const items = Children.toArray(children);
  const hiddenItemsCount = Math.max(0, items.length - initialVisible);
  const visibleItems = expanded ? items : items.slice(0, initialVisible);

  return <>
    <ol id={listId} className={className}>{visibleItems}</ol>
    {hiddenItemsCount > 0 && <button
      type="button"
      aria-controls={listId}
      aria-expanded={expanded}
      onClick={() => setExpanded(value => !value)}
      className="mt-5 w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm font-bold transition hover:bg-zinc-50"
    >
      {expanded ? lessLabel : `${moreLabel} (${hiddenItemsCount})`}
    </button>}
  </>;
}
