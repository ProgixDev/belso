import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Skeleton } from "@/components/ui/skeleton";

describe("<Skeleton />", () => {
  it("renders a labelled loading status", () => {
    render(<Skeleton className="h-6 w-24" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByLabelText("Loading")).toBeInTheDocument();
  });
});
