import { SiteHeader } from "./SiteHeader";
import { useLanguage, formatLocale } from "./i18n/Language";
import { getCommunityDiscussionCards, originalXUrl } from "./data/communityDiscussion";
import { useCommunityResource } from "./useCommunityResource";

export function communityDate(value: string | null, unavailable: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return unavailable;
  return new Intl.DateTimeFormat(formatLocale(), { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function CommunityDiscussionPage() {
  const { t, href, language } = useLanguage();
  const state = useCommunityResource(getCommunityDiscussionCards);
  return <main className="site-shell community-page">
    <SiteHeader />
    <section className="community-hero">
      <div><p className="eyebrow">ARCHIVE / COMMUNITY DISCUSSIONS</p><h1>{t("Pearl社区讨论")}</h1><p>{t("阅读社区文章、推文及围绕它们展开的回应。原帖保留原文，网站界面随语言切换。")}</p></div>
      <aside className="community-reading-rule"><span>READING RULE</span><strong>{t("先看原帖，再看讨论。")}</strong><p>{t("这里展示已归档的社区观点及来源，不将作者判断写成协议事实。")}</p><a className="community-admin-entry" href={href("/admin/community-discussions")}>{t("管理讨论")} ↗</a></aside>
    </section>
    <section className="community-debate" aria-label={t("讨论列表")} aria-busy={state.refreshing}>
      {state.loading && <p className="community-status" role="status">{t("正在读取社区讨论…")}</p>}
      {state.error && <div className="community-status" role="alert"><p>{t("社区讨论暂时无法读取，请稍后重试。")}</p><button type="button" disabled={state.refreshing} onClick={state.retry}>{t("重试")}</button></div>}
      {state.data?.length === 0 && <p className="community-status">{t("目前还没有已发布的讨论。")}</p>}
      <div className="x-source-grid">
        {state.data?.map(card => <article className="x-source-card" key={card.slug}>
          <header className="x-source-head">{card.primary.avatarUrl?.startsWith("https://") && <img src={card.primary.avatarUrl} alt="" />}<div><strong>{card.primary.author ?? card.primary.handle ?? t("作者未提供")}</strong><span>{card.primary.handle}</span></div></header>
          <span className="x-source-kind">COMMUNITY ARCHIVE</span>
          <h2><a href={href(`/archive/community-discussion/${card.slug}`)}>{card.title}</a></h2>
          <p>{card.description ?? card.summary}</p>
          <div className="x-source-actions"><span>{card.responseCount} {language === "en" && card.responseCount === 1 ? "response" : t("条回应")}</span><span>{t("最新收录：")} {communityDate(card.latestRecordedAt, t("时间未提供"))}</span></div>
          {originalXUrl(card.primary.url) && <a href={originalXUrl(card.primary.url)} target="_blank" rel="noreferrer">{t("在 X 查看原文")} ↗</a>}
        </article>)}
      </div>
    </section>
  </main>;
}
