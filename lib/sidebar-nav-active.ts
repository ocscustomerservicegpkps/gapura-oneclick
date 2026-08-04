interface NavItemLike {
  href: string;
}

interface SidebarNavActiveInput {
  href: string;
  pathname: string;
  reportsViewSelected: boolean;
  siblingItems: readonly NavItemLike[];
}

// Strip a trailing slash (except for root "/") so "/section" and "/section/"
// both normalize to the same pathname when building/comparing sibling routes.
function normalizePathname(path: string): string {
  if (path === '/') return path;
  return path.replace(/\/+$/, '') || '/';
}

function pathnameFromHref(href: string): string {
  return normalizePathname(href.split(/[?#]/, 1)[0]);
}

export function isSidebarNavItemActive({
  href,
  pathname,
  reportsViewSelected,
  siblingItems,
}: SidebarNavActiveInput): boolean {
  const itemPathname = pathnameFromHref(href);
  const normalizedPathname = normalizePathname(pathname);
  const reportsPathname = normalizedPathname === '/' ? '/reports' : `${normalizedPathname}/reports`;
  const hasReportsSibling = reportsViewSelected
    && siblingItems.some((item) => pathnameFromHref(item.href) === reportsPathname);

  if (hasReportsSibling) {
    return itemPathname === reportsPathname;
  }

  return itemPathname === normalizedPathname;
}
