import { ArchiveNavigation } from "./ArchiveNavigation";
import { stripLanguage, useLanguage } from "./i18n/Language";

export function SiteHeader() {
  const { language, t, href, switchLanguage } = useLanguage();
  const route = stripLanguage(window.location.pathname);
  const pathname = route === "/" && window.location.hash === "#overview" ? "/overview" : route;
  return <header className="topbar">
    <a className="brand" href={href("/")}>Pearl <span>{t("中文社区")}</span></a>
    <nav aria-label={t("主导航")}>
      <a href={href("/overview")} aria-current={pathname === "/overview" ? "page" : undefined}>{t("数据概览")}</a>
      <a href={href("/chain")} aria-current={pathname === "/chain" ? "page" : undefined}>{t("链上数据")}</a>
      <a href={href("/valuation")} aria-current={pathname === "/valuation" ? "page" : undefined}>{t("数据汇总")}</a>
      <ArchiveNavigation current={pathname === "/" || pathname.startsWith("/archive")} />
    </nav>
    <div className="language-switch" role="group" aria-label={t("切换语言")}>
      <button type="button" lang="en" aria-label="English" aria-pressed={language === "en"} onClick={() => switchLanguage("en")}>EN</button>
      <span aria-hidden="true">/</span>
      <button type="button" lang="zh-CN" aria-label="中文" aria-pressed={language === "zh"} onClick={() => switchLanguage("zh")}>ZH</button>
    </div>
  </header>;
}
