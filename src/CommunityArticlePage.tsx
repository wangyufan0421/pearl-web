import { useCallback } from "react";
import { SiteHeader } from "./SiteHeader";
import { useLanguage } from "./i18n/Language";
import { getCommunityDiscussion, originalXUrl, type CommunitySource } from "./data/communityDiscussion";
import { useCommunityResource } from "./useCommunityResource";
import { communityDate } from "./CommunityDiscussionPage";

function SourceMessage({ source, index }: { source: CommunitySource; index: number }) {
  const { t } = useLanguage();
  const side = index % 2 === 0 ? "left" : "right";
  const author = source.author ?? source.handle ?? t("作者未提供");
  const avatar = source.avatarUrl?.startsWith("https://") ? <img className="community-dialogue-avatar" src={source.avatarUrl} alt={author} /> : <span className="community-avatar-placeholder" aria-hidden="true">{author.slice(0, 1)}</span>;
  const url = originalXUrl(source.url);
  return <article className={`community-dialogue-message community-dialogue-${side} ${source.role === "primary" ? "community-dialogue-primary" : ""}`} data-testid="community-dialogue-message" data-side={side}>
    {side === "left" && avatar}
    <div className="community-dialogue-bubble">
      <header><span>{source.role === "primary" ? t("原文章") : t("社区回应")}</span><strong>{author}</strong><small>{source.handle}</small></header>
      <p className="community-source-date">{t("发布时间：")} {communityDate(source.publishedAt, t("时间未提供"))}</p>
      {source.fetchStatus === "failed" && <p className="community-source-status">{source.blocks.length ? t("暂时无法更新，正在展示已保存的原文。") : t("此来源暂无正文，请查看原帖。")}</p>}
      <div className="community-dialogue-scroll" tabIndex={0} role="region" aria-label={t("可滚动的原帖正文")}>
        <div className="community-source-body">
          {/* Original source blocks deliberately bypass t(): their language and full text are preserved. */}
          {source.blocks.map(block => block.kind === "heading" ? <h2 key={block.id}>{block.text}</h2> : block.kind === "quote" ? <blockquote key={block.id}>{block.text}</blockquote> : <p key={block.id}>{block.text}</p>)}
          {!source.blocks.length && source.fetchStatus !== "failed" && <p>{t("此来源暂无正文，请查看原帖。")}</p>}
        </div>
      </div>
      {url && <a href={url} target="_blank" rel="noreferrer">{t("在 X 查看原文")} ↗</a>}
    </div>
    {side === "right" && avatar}
  </article>;
}

export default function CommunityArticlePage({ slug }: { slug: string }) {
  const { t, href } = useLanguage();
  const loader = useCallback((signal: AbortSignal) => getCommunityDiscussion(slug, signal), [slug]);
  const state = useCommunityResource(loader);
  const sources = state.data ? [...state.data.sources.filter(source => source.role === "primary"), ...state.data.sources.filter(source => source.role === "response")] : [];
  return <main className="site-shell community-article-page" data-testid="community-article-page">
    <SiteHeader />
    <section className="community-article-hero">
      <p className="eyebrow">COMMUNITY / SOURCE ARCHIVE</p>
      <h1>{state.data?.title ?? t("Pearl社区讨论")}</h1>
      <p>{state.data?.description ?? t("原文章与社区回应按归档顺序展示，正文保留原文，可在框内滚动阅读。")}</p>
      <div><a href={href("/archive/community-discussion")}>{t("返回社区讨论")} ←</a></div>
    </section>
    <section className="community-dialogue" aria-label={t("原文章与社区回应")} aria-busy={state.refreshing}>
      {state.loading && <p className="community-status" role="status">{t("正在读取完整讨论…")}</p>}
      {state.error && <div className="community-status" role="alert"><p>{state.error === "missing" ? t("这篇讨论不存在或尚未发布。") : t("社区讨论暂时无法读取，请稍后重试。")}</p><button type="button" disabled={state.refreshing} onClick={state.retry}>{t("重试")}</button></div>}
      {sources.map((source, index) => <SourceMessage source={source} index={index} key={source.xStatusId} />)}
    </section>
  </main>;
}
