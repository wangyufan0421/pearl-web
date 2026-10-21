# Manual discussion threads design

Only X links explicitly saved by an administrator appear in a discussion. A saved reply can point at another saved source by X status ID; adding a reply never discovers or imports other tweets.

## Data flow

- Extract the direct `in_reply_to_status_id_str` (or equivalent numeric ID) from the exact root tweet returned by Twitter241, not a quoted/embedded tweet. Save it as `parent_x_status_id` on `discussion_sources`. Primary sources have no parent.
- Old rows retain null parents through an additive migration. A metadata-only repair action re-reads their saved URLs and fills missing parent IDs without changing body blocks, translations, author identity, or source timestamps. An administrator can select a different already-saved source in the same discussion as parent when X omits or misreports the relationship.
- The public API exposes `parentStatusId` and the already-persisted `authorUserId`. The tree builder attaches a source only when its parent is a different saved source in the same discussion; missing parents, self-links, and cycles remain visible at the top level.

## Presentation

- The main post is always on the left. A response by the same X user ID is left; another author is right. When IDs are missing, compare normalized handles; unknown authors default right.
- Top-level replies appear in the existing saved order. A reply with saved children shows a count and an accessible expand/collapse button. Expanding shows its immediate children, recursively; descendants preserve their own author side. Expanded state stays local to the page.
- Preserve existing original/Chinese text controls, avatars, links, source status, and cards. Add only the relationship controls and compact nested spacing.

## Failure and deployment behavior

- Failed X reads leave existing content and parent assignments intact. Replies without a known saved parent remain top-level, never disappear.
- SQL migration is additive and must be applied before deploying the updated code. No production Supabase or GitHub operation is part of this local task.
- Tests cover extraction, storage/API mapping, old-row repair and manual override, cycle-safe tree construction, author-side placement, and keyboard-operable expansion.
