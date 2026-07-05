export interface FlatNode {
  id: string;
  parentId: string | null;
  sortOrder: number;
}

export type TreeNode<T> = T & { children: TreeNode<T>[] };

/**
 * Nest a flat category list into a sorted tree. Orphans (parentId pointing at a
 * missing/soft-deleted parent) are promoted to roots so nothing is ever hidden.
 */
export function buildCategoryTree<T extends FlatNode>(flat: T[]): TreeNode<T>[] {
  const byId = new Map<string, TreeNode<T>>();
  for (const c of flat) byId.set(c.id, { ...c, children: [] });

  const roots: TreeNode<T>[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const sortRec = (nodes: TreeNode<T>[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

/**
 * Would setting `parentId` as the parent of `id` create a cycle (parent is the
 * node itself or one of its descendants)? Used to guard category re-parenting.
 */
export function wouldCycle(flat: FlatNode[], id: string, parentId: string): boolean {
  if (id === parentId) return true;
  const childrenOf = new Map<string, string[]>();
  for (const c of flat) {
    if (c.parentId) {
      const arr = childrenOf.get(c.parentId) ?? [];
      arr.push(c.id);
      childrenOf.set(c.parentId, arr);
    }
  }
  // Walk the subtree under `id`; a cycle exists if `parentId` is a descendant.
  const stack = [...(childrenOf.get(id) ?? [])];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === parentId) return true;
    stack.push(...(childrenOf.get(cur) ?? []));
  }
  return false;
}
