"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { propertySorts, type PropertySort } from "../types";

/**
 * Reorders the results (AC-3).
 *
 * Sort lives in `searchParams`, not a store (`.claude/rules/app-router.md`), so
 * this only has to rewrite the URL and let the server re-render.
 *
 * It is a `<form>` around a `<select>` with a real submit button, and JS only
 * removes the need to press it. Without that fallback the control is dead for
 * anyone whose JS has not arrived — and the submit button is hidden with
 * `sr-only` rather than `display:none`, so keyboard and screen-reader users
 * keep a way to commit the change.
 */
export function SortControl({
  value,
  label,
  applyLabel,
  optionLabels,
}: {
  value: PropertySort;
  label: string;
  applyLabel: string;
  optionLabels: Record<PropertySort, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const hrefFor = (sort: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("sort", sort);
    return `${pathname}?${params.toString()}`;
  };

  return (
    <form
      method="get"
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const sort = new FormData(event.currentTarget).get("sort");
        router.push(hrefFor(String(sort)));
      }}
    >
      {/* Carry the query across, or changing the sort silently clears the search. */}
      {searchParams?.get("q") ? (
        <input type="hidden" name="q" value={searchParams.get("q") ?? ""} />
      ) : null}

      <label htmlFor="sort" className="text-muted-foreground text-xs whitespace-nowrap">
        {label}
      </label>
      <select
        id="sort"
        name="sort"
        defaultValue={value}
        onChange={(event) => router.push(hrefFor(event.target.value))}
        className="border-input bg-background focus-visible:ring-ring h-9 rounded-md border px-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2"
      >
        {propertySorts.map((sort) => (
          <option key={sort} value={sort}>
            {optionLabels[sort]}
          </option>
        ))}
      </select>
      <button type="submit" className="sr-only focus-visible:not-sr-only">
        {applyLabel}
      </button>
    </form>
  );
}
