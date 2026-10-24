import type { CommunitySource } from "./communityDiscussion";

export interface DiscussionNode {
  source: CommunitySource;
  children: DiscussionNode[];
}

export interface DiscussionTree {
  primary: CommunitySource | null;
  roots: DiscussionNode[];
}

function normalizedHandle(handle: string | null): string | null {
  const normalized = handle?.trim().replace(/^@/, "").toLowerCase();
  return normalized || null;
}

export function authorSide(source: CommunitySource, primary: CommunitySource | null): "left" | "right" {
  if (source.role === "primary") return "left";
  if (!primary) return "right";
  if (source.authorUserId && primary.authorUserId) {
    return source.authorUserId === primary.authorUserId ? "left" : "right";
  }
  const sourceHandle = normalizedHandle(source.handle);
  const primaryHandle = normalizedHandle(primary.handle);
  return sourceHandle && primaryHandle && sourceHandle === primaryHandle ? "left" : "right";
}

export function buildDiscussionTree(sources: CommunitySource[]): DiscussionTree {
  const primary = sources.find(source => source.role === "primary") ?? null;
  const replies = sources.filter(source => source.role === "response");
  const nodes = replies.map(source => ({ source, children: [] as DiscussionNode[] }));
  const byStatusId = new Map(nodes.map(node => [node.source.xStatusId, node]));
  const roots: DiscussionNode[] = [];

  for (const node of nodes) {
    const parentId = node.source.parentStatusId;
    const parent = parentId ? byStatusId.get(parentId) : undefined;
    if (!parent) {
      roots.push(node);
      continue;
    }

    // A stale or manually edited relationship must never hide a saved reply.
    const visited = new Set([node.source.xStatusId]);
    let ancestor: DiscussionNode | undefined = parent;
    let cyclic = false;
    while (ancestor) {
      if (visited.has(ancestor.source.xStatusId)) {
        cyclic = true;
        break;
      }
      visited.add(ancestor.source.xStatusId);
      ancestor = ancestor.source.parentStatusId
        ? byStatusId.get(ancestor.source.parentStatusId)
        : undefined;
    }
    if (cyclic) roots.push(node);
    else parent.children.push(node);
  }

  return { primary, roots };
}
