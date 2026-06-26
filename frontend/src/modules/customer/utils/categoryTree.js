/**
 * Customer category tree helpers.
 * Backend: `type` = category (root parent) | subcategory; `parentId` + virtual `children`.
 * APIs: `GET /categories?roots=true` (home tiles) or `?tree=true` (parent + subcategories).
 */

function isActive(doc) {
  return doc?.status !== 'inactive';
}

function isRootParent(node) {
  if (!node || node.type !== 'category') return false;
  const pid = node.parentId?._id ?? node.parentId;
  return pid == null || pid === '';
}

/**
 * Flatten a category tree into one array for map building.
 */
export function flattenCategoryTree(tree) {
  const out = [];
  const walk = (nodes) => {
    if (!Array.isArray(nodes)) return;
    for (const n of nodes) {
      if (!n) continue;
      out.push(n);
      if (Array.isArray(n.children) && n.children.length) walk(n.children);
    }
  };
  walk(tree);
  return out;
}

function sortItemsByPreferredIds(items, preferredIds) {
  if (!preferredIds?.length || !items?.length) return items;
  const preferred = new Set(preferredIds.map((id) => String(id)));
  return [...items].sort((a, b) => {
    const pa = preferred.has(String(a.id)) || preferred.has(String(a.subcategoryId));
    const pb = preferred.has(String(b.id)) || preferred.has(String(b.subcategoryId));
    if (pa && !pb) return -1;
    if (!pa && pb) return 1;
    return 0;
  });
}

/**
 * Build home / browse tiles from **parent categories** (name + image).
 * Each tile navigates to `/category/:parentId`.
 *
 * @param {object[]} rootsOrTree - `GET /categories?roots=true` or `?tree=true`
 * @param {string[]} preferredCategoryIds - hero category ids for ordering
 */
export function buildHomeCategorySections(rootsOrTree, preferredCategoryIds = []) {
  if (!Array.isArray(rootsOrTree) || !rootsOrTree.length) return [];

  const parents = rootsOrTree
    .filter((node) => node && isRootParent(node) && isActive(node))
    .filter((node) => (node.name || '').trim().toLowerCase() !== 'all');

  let items = parents.map((parent) => ({
    id: parent._id,
    name: parent.name,
    image: parent.image || '',
  }));

  items = sortItemsByPreferredIds(items, preferredCategoryIds);
  if (!items.length) return [];

  return [
    {
      id: 'shop-by-category',
      title: 'Shop by category',
      items,
    },
  ];
}
