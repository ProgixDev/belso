# References — vendored docs for agents

Agents work best when authoritative documentation is greppable inside the repo instead of fetched (or hallucinated). This folder holds **`llms.txt`-style plain-text docs** for the dependencies that matter most, checked in and versioned with the code.

## Rules

- One file per dependency: `<package>.llms.txt` (or `.md`). Record the source URL and the dependency version at the top.
- Refresh when the dependency's major version bumps (the upgrade PR includes the refreshed file).
- Keep only what we use: trim to the sections relevant to this codebase — context is a budget.
- Agents: before using an unfamiliar API from a core dependency, grep here first; if missing, fetch the official `llms.txt` and ADD it in your PR.

## Wanted list (add when first needed)

| Dependency      | Source                                  |
| --------------- | --------------------------------------- |
| Next.js         | https://nextjs.org/docs/llms.txt        |
| Tailwind CSS v4 | https://tailwindcss.com/docs (llms.txt) |
| shadcn/ui       | https://ui.shadcn.com/llms.txt          |
| Zustand         | https://zustand.docs.pmnd.rs (llms.txt) |
| Motion          | https://motion.dev/llms.txt             |
| Playwright      | https://playwright.dev (llms.txt)       |

(Not vendored by default to keep the skeleton light — the first agent to need one adds it.)
