import { useCallback, useState } from "react";
import { SiteHeader } from "./SiteHeader";
import { useLanguage } from "./i18n/Language";
import { getCommunityDiscussion, originalXUrl, type CommunitySource } from "./data/communityDiscussion";
import { useCommunityResource } from "./useCommunityResource";
import { communityDate } from "./CommunityDiscussionPage";
import { CommunityAvatar, CommunityAuthorInfo } from "./CommunityIdentity";
import { hasCompleteChineseTranslation, isEnglishBlock } from "../server/translation/content.js";

export function SourceMessage({ source, index }: { source: CommunitySource; index: number }) {
  const { t, language } = useLanguage();
  const [view, setView] = useState<"original" | "zh" | null>(null);
  const complete = hasCompleteChineseTranslation(source.blocks);
  const hasEnglish = source.blocks.some(isEnglishBlock);
  const chinese = complete && (view ?? (language === "zh" ? "zh" : "original")) === "zh";
  const side = index % 2 === 0 ? "left" : "right";
  const avatar = <CommunityAvatar source={source} />;
  const url = originalXUrl(source.url);
  return <article className={`community-dialogue-message community-dialogue-${side} ${source.role === "primary" ? "community-dialogue-primary" : ""}`} data-testid="community-dialogue-message" data-side={side}>
    {side === "left" && avatar}
    <div className="community-dialogue-bubble">
      <header><span>{source.role === "primary" ? t("原文章") : t("社区回应")}</span><CommunityAuthorInfo source={source} /></header>
      <p className="community-source-date">{t("发布时间：")} {communityDate(source.publishedAt, t("时间未提供"))}</p>
      {source.fetchStatus === "failed" && <p className="community-source-status">{source.blocks.length ? t("暂时无法更新，正在展示已保存的原文。") : t("此来源暂无正文，请查看原帖。")}</p>}
      {hasEnglish && <div className="community-translation-controls" role="group" aria-label={t("正文语言")}><button type="button" aria-pressed={!chinese} onClick={() => setView("original")}>{t("英文原文")}</button><button type="button" disabled={!complete} aria-pressed={chinese} onClick={() => setView("zh")}>{t("中文译文")}</button></div>}
      {hasEnglish && !complete && <p className="community-source-status">{t("中文译文尚未完成，暂时显示英文原文。")}</p>}
      {chinese && <p className="community-source-status">{t("机器译文，仅供阅读参考；以原文为准。")}</p>}
      <div className="community-dialogue-scroll" tabIndex={0} role="region" aria-label={chinese ? t("可滚动的中文译文") : t("可滚动的原帖正文")}>
        <div className="community-source-body">
          {/* Original source blocks deliberately bypass t(): their language and full text are preserved. */}
          {source.blocks.map(block => { const text = chinese ? block.translationZh ?? block.text : block.text; return block.kind === "heading" ? <h2 key={block.id}>{text}</h2> : block.kind === "quote" ? <blockquote key={block.id}>{text}</blockquote> : <p key={block.id}>{text}</p>; })}
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
