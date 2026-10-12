import { useLanguage } from "./i18n/Language";
const archiveEntries = [
  ["Pearl 核心机制", "/archive/core-mechanism"],
  ["Pearl社区讨论", "/archive/community-discussion"],
  ["Pearl白皮书", "/archive/whitepaper"],
  ["Pearl相关文章", "/archive/articles"],
  ["Pearl人物与关系", "/archive/people"],
] as const;

export function ArchiveNavigation({ current = false }: { current?: boolean }) {
  const { t, href: localizeHref, language } = useLanguage();
  return <div className="archive-nav-item">
    <a className="archive-nav-trigger" href={localizeHref("/archive")} aria-current={current ? "page" : undefined}>{t("Pearl档案")}</a>
    <div className="archive-subnav" aria-label={t("Pearl档案目录")}>
      {archiveEntries.map(([label, href]) => <a key={href} href={localizeHref(href)}>{t(label)}<span aria-hidden="true">↗</span></a>)}
    </div>
  </div>;
}
