const archiveEntries = [
  ["Pearl 核心机制", "/archive/core-mechanism"],
  ["Pearl社区讨论", "/archive#community-discussion"],
  ["Pearl白皮书", "/archive/whitepaper"],
  ["Pearl相关文章", "/archive/articles"],
  ["Pearl人物与关系", "/archive/people"],
] as const;

export function ArchiveNavigation({ current = false }: { current?: boolean }) {
  return <div className="archive-nav-item">
    <a className="archive-nav-trigger" href="/archive" aria-current={current ? "page" : undefined}>Pearl档案</a>
    <div className="archive-subnav" aria-label="Pearl档案目录">
      {archiveEntries.map(([label, href]) => <a key={href} href={href}>{label}<span aria-hidden="true">↗</span></a>)}
    </div>
  </div>;
}
