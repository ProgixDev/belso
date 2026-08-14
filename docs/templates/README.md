# Templates — the artifacts `/progix` and the workflow instantiate

These are the canonical sources for the human-facing artifacts of a project. Skills fill them in; humans read them. Keeping the master here (versioned, gated) means every project starts identical and improvements compound.

| Template                                                 | Filled by                                                      | Lives (when filled)                                                           |
| -------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [prd.md](prd.md)                                         | `/write-prd`                                                   | Notion → project → PRD (human original) + `docs/product/prd.md` (repo mirror) |
| [claude-design-prompt.md](claude-design-prompt.md)       | `/progix` / `/design-prompt`                                   | Exported `.md`, pasted into Claude Design                                     |
| [daily-report.md](daily-report.md)                       | `/daily-report`                                                | Notion → project → GitHub + `docs/reports/daily/`                             |

Rule for all of them: human-readable first (the PM, Ilyes, and the client read these), short, honest, and dated. See `docs/process/notion-workspace.md`.
