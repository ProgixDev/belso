import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * Testing Library only registers its own auto-cleanup when Vitest runs with
 * `globals: true`, which this project does not. Without this hook every
 * rendered tree stays in `document.body`, so `screen` queries in a later test
 * match an element from an earlier one — which surfaces as a component bug
 * that does not exist.
 */
afterEach(cleanup);
