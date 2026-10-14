import { useCallback, useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { SiteHeader } from "./SiteHeader";
import { useLanguage } from "./i18n/Language";
import { SourceMessage } from "./CommunityArticlePage";
import { CommunityAvatar, CommunityAuthorInfo } from "./CommunityIdentity";
import { useCommunityResource } from "./useCommunityResource";
import { AdminRequestError, verifyAdminToken, createArticle, addArticleResponses, refreshArticleSource, normalizeArticleLink, responseLinks, getAdminCards, getAdminDetail, manageDiscussion, type AdminDiscussionCard, type DiscussionAction, type WriteOutcome } from "./data/communityAdmin";
import { AdminDiscussionDialog } from "./admin/AdminDiscussionDialog";
import { CommunityReadError } from "./data/communityDiscussion";

const base = "/admin/community-discussions";
const errorCopy: Record<AdminRequestError["kind"], string> = {
  unauthorized: "管理令牌无效或已失效，请重新验证。", invalid_links: "请使用 X 或 Twitter 的 status 链接。",
  invalid_input: "请检查表单。回应每次限 1–50 条，地址标识只能包含小写字母、数字和连字符。",
  missing: "未找到对应讨论或来源，请刷新列表。", unavailable: "服务暂时不可用，请检查部署配置后重试。",
  uncertain: "请求未能确认完成，请先检查讨论页，再决定是否重试。",
};
export default function CommunityAdminPage({ route = base }: { route?: string }) {
  const { t, href, language } = useLanguage();
  const [token, setToken] = useState(""); const [enteredToken, setEnteredToken] = useState("");
  const [primaryUrl, setPrimaryUrl] = useState(""); const [title, setTitle] = useState("");
  const [description, setDescription] = useState(""); const [customSlug, setCustomSlug] = useState("");
  const [responseInput, setResponseInput] = useState(""); const [filter, setFilter] = useState<"published" | "draft">("published");
  const [outcomes, setOutcomes] = useState<{ slug: string; items: Array<Omit<WriteOutcome, "outcome"> & { outcome: WriteOutcome["outcome"] | "refreshed" }> } | null>(null);
  const [busy, setBusy] = useState<string | null>(null); const busyRef = useRef(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [dialog, setDialog] = useState<{ card: AdminDiscussionCard; action: DiscussionAction } | null>(null);
  const generation = useRef(0); useEffect(() => () => { generation.current++; }, []);
  const normalizedRoute = route.replace(/\/$/, "");
  const creating = normalizedRoute === `${base}/new`;
  const slug = normalizedRoute.startsWith(`${base}/`) && !creating ? normalizedRoute.slice(base.length + 1) : "";
  const routeRef = useRef(normalizedRoute); routeRef.current = normalizedRoute;
  const preserveNextRoute = useRef(false);
  useEffect(() => {
    if (preserveNextRoute.current) preserveNextRoute.current = false;
    else { setResponseInput(""); setOutcomes(null); }
  }, [normalizedRoute]);
  function navigate(path: string) { window.history.pushState({}, "", href(path)); window.dispatchEvent(new PopStateEvent("popstate")); }
  function follow(event: MouseEvent<HTMLAnchorElement>, path: string) {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); if (!busyRef.current) navigate(path);
  }
  function logout() {
    generation.current++; busyRef.current = false; setBusy(null); setToken(""); setEnteredToken(""); setNotice(null); setDialog(null);
    setPrimaryUrl(""); setTitle(""); setDescription(""); setCustomSlug(""); setResponseInput(""); setOutcomes(null);
  }
  const showError = useCallback((error: unknown) => {
    const kind = error instanceof AdminRequestError ? error.kind : "uncertain";
    if (kind === "unauthorized") logout();
    setNotice({ text: errorCopy[kind], error: true });
  }, []);
  const listLoader = useCallback(async (signal: AbortSignal) => {
    if (!token) return [];
    const current = generation.current;
    try { return await getAdminCards(token, signal); } catch (error) { if (current === generation.current && !signal.aborted && error instanceof AdminRequestError && error.kind === "unauthorized") showError(error); throw error; }
  }, [token, showError]);
  const cards = useCommunityResource(listLoader);
  const detailLoader = useCallback(async (signal: AbortSignal) => {
    if (!token || !slug) return null;
    const current = generation.current;
    try { return await getAdminDetail(token, slug, signal); } catch (error) { if (current === generation.current && !signal.aborted && error instanceof AdminRequestError && error.kind === "unauthorized") showError(error); if (error instanceof AdminRequestError && error.kind === "missing") throw new CommunityReadError("missing"); throw error; }
  }, [token, slug, showError]);
  const resource = useCommunityResource(detailLoader);
  const selected = resource.data?.slug === slug ? resource.data : null;
  const locked = !token || busy !== null;
  async function authenticate(event: FormEvent) {
    event.preventDefault(); if (busyRef.current) return;
    const candidate = enteredToken.trim(); if (!candidate) { showError(new AdminRequestError("unauthorized")); return; }
    const current = ++generation.current; busyRef.current = true; setBusy("auth"); setNotice(null);
    try { await verifyAdminToken(candidate); if (current === generation.current) { setToken(candidate); setEnteredToken(""); } }
    catch (error) { if (current === generation.current) showError(error); }
    finally { if (current === generation.current) { busyRef.current = false; setBusy(null); } }
  }
  async function run<T>(operation: string, execute: (credential: string) => Promise<T>, success: (result: T) => void) {
    if (!token || busyRef.current) return;
    const current = generation.current; const startingRoute = routeRef.current; busyRef.current = true; setBusy(operation); setNotice(null);
    try { const result = await execute(token); if (current === generation.current && startingRoute === routeRef.current) success(result); }
    catch (error) { if (current === generation.current && startingRoute === routeRef.current) showError(error); }
    finally { if (current === generation.current) { busyRef.current = false; setBusy(null); } }
  }
  function submitArticle(event: FormEvent) {
    event.preventDefault();
    try {
      const url = normalizeArticleLink(primaryUrl); const address = customSlug.trim();
      const urls = responseInput.trim() ? responseLinks(responseInput) : [];
      if (address && (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(address) || address === "new")) throw new AdminRequestError("invalid_input");
      const input = { primaryUrl: url, ...(title.trim() ? { title: title.trim() } : {}), ...(description.trim() ? { description: description.trim() } : {}), ...(address ? { slug: address } : {}), status: "published" as const };
      const current = generation.current;
      void run("create", async credential => {
        const result = await createArticle(credential, input);
        let items: WriteOutcome[] = []; let followupError: unknown;
        if (urls.length && current === generation.current) try { items = await addArticleResponses(credential, result.discussion.slug, urls); } catch (error) { followupError = error; }
        return { result, items, followupError };
      }, ({ result, items, followupError }) => {
        setPrimaryUrl(""); setTitle(""); setDescription(""); setCustomSlug("");
        setResponseInput(followupError ? urls.join("\n") : items.filter(item => item.outcome === "failed").map(item => `https://x.com/i/status/${item.statusId}`).join("\n"));
        setOutcomes({ slug: result.discussion.slug, items }); cards.retry(); preserveNextRoute.current = true; navigate(`${base}/${result.discussion.slug}`);
        setNotice({ text: followupError ? "主题帖已保存，回应未能确认完成。请查看已有回应，再重试剩余链接。" : "讨论已创建并发布。", error: Boolean(followupError) });
        if (followupError instanceof AdminRequestError && followupError.kind === "unauthorized") showError(followupError);
      });
    } catch (error) { showError(error); }
  }
  function submitResponses(event: FormEvent) {
    event.preventDefault();
    try {
      const urls = responseLinks(responseInput); if (!selected) throw new AdminRequestError("invalid_input");
      void run("responses", credential => addArticleResponses(credential, slug, urls), items => {
        setOutcomes({ slug, items }); setResponseInput(""); cards.retry(); resource.retry();
        setNotice({ text: "回应处理完成，请查看逐条结果。", error: false });
      });
    } catch (error) { showError(error); }
  }
  function refreshSource(statusId: string) {
    void run(`refresh:${statusId}`, credential => refreshArticleSource(credential, slug, statusId), result => {
      setNotice({ text: result.fetchStatus === "success" ? "来源已成功刷新。" : "来源刷新失败，已保存正文仍保留。", error: result.fetchStatus !== "success" });
      setOutcomes(previous => previous?.slug === slug ? { ...previous, items: previous.items.map(item => item.statusId === statusId ? { ...item, outcome: result.fetchStatus === "success" ? "refreshed" : "failed" } : item) } : previous);
      resource.retry(); cards.retry();
    });
  }
  function confirmAction(confirmation?: string) {
    if (!dialog) return;
    const { card, action } = dialog;
    void run(action, credential => manageDiscussion(credential, card.slug, action, confirmation), () => {
      setDialog(null); cards.retry(); resource.retry();
      setNotice({ text: action === "delete" ? "讨论及所有来源已彻底删除。" : action === "hide" ? "讨论已隐藏，可在隐藏列表恢复。" : "讨论已恢复公开。", error: false });
      if (slug === card.slug && action === "delete") navigate(base);
    });
  }
  const outcomeLabels = { created: "已新增", duplicate: "已归档，无需重复添加", failed: "抓取失败", refreshed: "已刷新" };
  const responseField = <><label>{t("回应 X 链接")}<textarea value={responseInput} onChange={event => setResponseInput(event.target.value)} placeholder="https://x.com/author/status/123…" rows={7} required={!creating} /></label><p className="admin-help">{t("一行一个链接，每次最多 50 条。重复来源不会再次创建。")}</p></>;
  return <main className="site-shell community-admin-page"><SiteHeader /><div className="admin-wrap">
    <header className="admin-intro"><p className="eyebrow">COMMUNITY / ADMIN</p><h1>{t("社区讨论管理")}</h1><p>{t(token ? "管理主题帖、辩论和引推。" : "输入管理员密钥后进入社区讨论管理。")}</p><a href={href("/archive/community-discussion")}>{t("查看公开讨论页")} ↗</a></header>
    <section className="admin-panel"><h2>{t("管理员验证")}</h2>{token ? <div className="admin-session"><p>{t("管理令牌已验证。")}</p><button type="button" onClick={logout}>{t("退出管理")}</button></div> : <form onSubmit={authenticate} className="admin-auth-form"><label>{t("管理令牌")}<input type="password" autoComplete="off" value={enteredToken} onChange={event => setEnteredToken(event.target.value)} required disabled={busy !== null} /></label><button type="submit" disabled={busy !== null}>{t(busy === "auth" ? "正在验证…" : "验证令牌")}</button></form>}<p className="admin-help">{t("输入统一管理员密钥。退出或刷新后需要重新验证。")}</p></section>
    {notice && <div className={`admin-notice ${notice.error ? "error" : "success"}`} role={notice.error ? "alert" : "status"}>{t(notice.text)}</div>}
    {token && <>
      <nav className="admin-toolbar" aria-label={t("讨论管理导航")}>
        {(creating || slug) ? <a href={href(base)} onClick={event => follow(event, base)}>{t("返回讨论列表")} <span aria-hidden="true">←</span></a> : <div className="admin-filters"><button type="button" aria-pressed={filter === "published"} onClick={() => setFilter("published")}>{t("公开讨论")}</button><button type="button" aria-pressed={filter === "draft"} onClick={() => setFilter("draft")}>{t("已隐藏")}</button></div>}
        <a className="admin-new-link" aria-label={t("新建讨论")} href={href(`${base}/new`)} onClick={event => follow(event, `${base}/new`)}><span aria-hidden="true">＋</span>{t("新建讨论")}</a>
      </nav>
      {!creating && !slug && <>
        {cards.loading && <p role="status">{t("正在读取讨论…")}</p>}
        {cards.error && <div role="alert"><p>{t("无法读取讨论列表，请确认数据库配置。")}</p><button onClick={cards.retry}>{t("重试")}</button></div>}
        {!cards.loading && !cards.error && !(cards.data ?? []).some(card => card.status === filter) && <section className="admin-panel"><p>{t(filter === "draft" ? "暂无隐藏讨论。" : "暂无讨论，点击加号创建。")}</p></section>}
        <section className="admin-discussion-grid" aria-label={t("讨论卡片")}>{(cards.data ?? []).filter(card => card.status === filter).map(card => <article className="admin-panel admin-discussion-card" key={card.slug}>
          <div className="admin-card-identity"><CommunityAvatar source={card.primary} /><CommunityAuthorInfo source={card.primary} /></div>
          <h2><a href={href(`${base}/${card.slug}`)} onClick={event => follow(event, `${base}/${card.slug}`)}>{card.title}</a></h2>
          <p className="admin-card-summary">{language === "zh" ? card.summaryZh ?? card.summary : card.summary}</p><p className="admin-help">{t("已添加回应")} · {card.responseCount}</p>
          <div className="admin-card-actions"><button disabled={locked} onClick={() => setDialog({ card, action: card.status === "draft" ? "restore" : "hide" })}>{t(card.status === "draft" ? "恢复公开" : "隐藏讨论")}</button><button className="admin-danger" disabled={locked} onClick={() => setDialog({ card, action: "delete" })}>{t("彻底删除")}</button></div>
        </article>)}</section>
      </>}
      {creating && <form onSubmit={submitArticle}>
        <div className="admin-form-grid"><section className="admin-panel"><p className="eyebrow">01 / TOPIC</p><h2>{t("创建主文章讨论")}</h2><fieldset disabled={locked}>
          <label>{t("主文章 X 链接")}<input type="url" value={primaryUrl} onChange={event => setPrimaryUrl(event.target.value)} placeholder="https://x.com/author/status/123…" required /></label>
          <label>{t("备用标题（可选）")}<input value={title} onChange={event => setTitle(event.target.value)} maxLength={160} /></label><p className="admin-help">{t("文章原有标题优先；普通推文可以使用备用标题。")}</p>
          <label>{t("简介（可选）")}<textarea value={description} onChange={event => setDescription(event.target.value)} maxLength={600} rows={3} /></label>
          <label>{t("地址标识（可选）")}<input value={customSlug} onChange={event => setCustomSlug(event.target.value)} placeholder="pearl-debate" /></label><p className="admin-help">{t("留空会自动生成。点击创建后，讨论会直接公开发布。")}</p>
        </fieldset></section><section className="admin-panel"><p className="eyebrow">02 / RESPONSES</p><h2>{t("辩论与引推（可选）")}</h2><fieldset disabled={locked}>{responseField}</fieldset><p className="admin-help">{t("主题帖保存后自动添加这些回应，也可以稍后补充。")}</p></section></div>
        <div className="admin-panel admin-create-footer"><button disabled={locked} type="submit">{t(busy === "create" ? "正在抓取主文章…" : "创建并发布讨论")}</button></div>
      </form>}
      {slug && <>
        {resource.loading && <p role="status">{t("正在读取来源…")}</p>}
        {resource.error && <div role="alert"><p>{t("无法读取来源，请刷新后重试。")}</p><button onClick={resource.retry}>{t("重试")}</button></div>}
        {selected && <><h2 className="admin-detail-title">{selected.title}</h2><p className="admin-help">{t(selected.status === "draft" ? "此讨论已隐藏，公众无法查看。" : "此讨论已公开。")}</p>
          <p className="admin-result-link">{selected.status === "published" && <a href={href(`/archive/community-discussion/${slug}`)} target="_blank" rel="noreferrer">{t("打开已发布讨论")} <span aria-hidden="true">↗</span></a>}</p>
          <div className="admin-editor-grid"><section className="admin-topic-preview" aria-label={t("主题帖预览")}>{selected.sources.filter(source => source.role === "primary").map(source => <div key={source.xStatusId}><SourceMessage source={source} index={0} /><button disabled={locked} onClick={() => refreshSource(source.xStatusId)}>{t("刷新原文")}</button></div>)}</section>
          <section className="admin-panel"><p className="eyebrow">RESPONSES / QUOTES</p><h2>{t("添加辩论与回应")}</h2><form onSubmit={submitResponses}><fieldset disabled={locked}>{responseField}</fieldset><button type="submit" disabled={locked}>{t(busy === "responses" ? "正在抓取回应…" : "添加回应")}</button></form>
            <h3>{t("已保存的来源")}</h3>{selected.sources.filter(source => source.role === "response").map(source => <div className="admin-saved-response" key={source.xStatusId}><CommunityAuthorInfo source={source} /><p>{language === "zh" ? source.blocks[0]?.translationZh ?? source.blocks[0]?.text : source.blocks[0]?.text}</p><p className="admin-help">{source.xStatusId} · {t(source.fetchStatus === "success" ? "已保存" : "抓取失败")}</p><button disabled={locked} aria-label={`${t("刷新来源")} ${source.xStatusId}`} onClick={() => refreshSource(source.xStatusId)}>{t("刷新原文")}</button></div>)}
          </section></div>
        </>}
      </>}
      {outcomes?.slug === slug && outcomes.items.length > 0 && <section className="admin-panel"><h2>{t("本次添加结果")}</h2><div className="admin-table-scroll"><table><thead><tr><th>{t("来源 ID")}</th><th>{t("处理结果")}</th><th>{t("操作")}</th></tr></thead><tbody>{outcomes.items.map((item, index) => <tr key={`${item.statusId}:${index}`}><td>{item.statusId}</td><td>{t(outcomeLabels[item.outcome])}</td><td>{item.outcome === "failed" && <button disabled={locked} aria-label={`${t("重试来源")} ${item.statusId}`} onClick={() => refreshSource(item.statusId)}>{t("重试抓取")}</button>}</td></tr>)}</tbody></table></div></section>}
      {dialog && <AdminDiscussionDialog card={dialog.card} action={dialog.action} busy={locked} onCancel={() => setDialog(null)} onConfirm={confirmAction} />}
    </>}
  </div></main>;
}
