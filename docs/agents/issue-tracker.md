# Issue tracker: Linear

Issues and specs for this repo live in Linear. Use the Linear MCP for all operations. Do not use GitHub Issues.

- **Workspace**: [bobbylin](https://linear.app/bobbylin)
- **Team**: Chestnut Studio (issue identifiers `CNS-N`)
- **Project**: [LongPlay](https://linear.app/bobbylin/project/longplay-8c1ccec33c16) — new issues go on this project, team Chestnut Studio

## Conventions

- **Create an issue**: `save_issue` with `title`, `team: "Chestnut Studio"`, `project: "LongPlay"`, and `description` as markdown (literal newlines, not escaped).
- **Read an issue**: `get_issue` with the identifier (`CNS-541`) or UUID. Use `list_comments` with `issueId` for the thread.
- **List issues**: `list_issues` with `team: "Chestnut Studio"`, plus `state` / `label` / `assignee` filters as needed.
- **Comment**: `save_comment` with `issueId` and markdown `body`.
- **Apply / remove labels**: `save_issue` `labels` **replaces the full set**. `get_issue` first, then pass the complete desired list. Omit `labels` to leave them unchanged.
- **Close**: `save_issue` with `id` and `state: "Done"`. Cancel with `state: "Canceled"`.

Statuses on this team: Backlog, Todo, In Progress, In Review, Done, Canceled, Duplicate.

## When a skill says "publish to the issue tracker"

Create a Linear issue on Chestnut Studio in project LongPlay via `save_issue`.

## When a skill says "fetch the relevant ticket"

`get_issue` for the `CNS-N` identifier (or URL), then `list_comments` if the skill needs the thread.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `save_issue` with `team: "Chestnut Studio"` and `labels: ["wayfinder:map"]`.
- **Child ticket**: `save_issue` with `parentId` set to the map's identifier. Labels: `wayfinder:<type>` (`research` / `prototype` / `grilling` / `task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: Linear's native `blockedBy` / `blocks` on `save_issue` (append-only; use `removeBlockedBy` / `removeBlocks` to drop an edge). A ticket is unblocked when every blocker is Done or Canceled.
- **Frontier query**: `list_issues` with `parentId` of the map, drop any with an open blocker or an assignee; first in map order wins.
- **Claim**: `save_issue` with `id` and `assignee: "me"`, the session's first write.
- **Resolve**: `save_comment` with the answer, then `save_issue` with `state: "Done"`, then append a context pointer (gist + link) to the map's Decisions-so-far.
