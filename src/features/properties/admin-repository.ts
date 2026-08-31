import "server-only";
import { editorQuery } from "@/core/db";
import { SELECT_LISTING, type PropertyRow, toProperty } from "./row";
import type { Property } from "./types";

/**
 * Reading the catalogue as the back-office sees it: **drafts and archived
 * listings included**.
 *
 * A separate file from `repository.ts`, and separate from `row.ts`'s public
 * reads, for one reason worth stating plainly: these queries have no
 * `publication` filter. That is correct here and catastrophic anywhere else, so
 * the two live apart and this one goes through `editorQuery` — a different pool
 * and a different database role. Anything importing from here is, by
 * construction, back-office code.
 *
 * It reuses `SELECT_LISTING`, the joins `row.ts` defines, rather than repeating
 * them. A second copy would drift, and the shape it produces is what
 * `toProperty` — and therefore the golden snapshot — expects.
 */

/** A listing, plus the two things only the back-office cares about. */
export type EditorListing = Property & {
  publication: "draft" | "published" | "archived";
  /** Carried into the form and back, so a save can tell it apart (AC-10). */
  version: number;
};

type EditorRow = PropertyRow & {
  publication: EditorListing["publication"];
  version: number;
};

function toEditorListing(row: EditorRow): EditorListing {
  return { ...toProperty(row), publication: row.publication, version: row.version };
}

/**
 * Every listing, newest first, whatever its state.
 *
 * Ordered by `updated_at` rather than `listed_at`: this is a work queue, not a
 * catalogue. What she wants at the top is what she was last working on, which
 * is rarely the most recently listed property.
 */
export async function listListingsForEditor(): Promise<EditorListing[]> {
  const rows = await editorQuery<EditorRow>(`${SELECT_LISTING} order by p.updated_at desc`);
  return rows.map(toEditorListing);
}

/** One listing by id, for the editor. Null when it does not exist. */
export async function getListingForEditor(id: string): Promise<EditorListing | null> {
  const rows = await editorQuery<EditorRow>(`${SELECT_LISTING} where p.id = $1`, [id]);
  return rows[0] ? toEditorListing(rows[0]) : null;
}
