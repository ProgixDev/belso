import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "@/components/ui/empty-state";

describe("<EmptyState />", () => {
  it("renders title, description, and an action", () => {
    render(
      <EmptyState
        title="No notes yet"
        description="Create your first note to get started."
        action={<button type="button">New note</button>}
      />,
    );
    expect(screen.getByText("No notes yet")).toBeInTheDocument();
    expect(screen.getByText("Create your first note to get started.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New note" })).toBeInTheDocument();
  });
});
