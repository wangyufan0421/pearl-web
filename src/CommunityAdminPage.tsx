import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { SiteHeader } from "./SiteHeader";
import { useLanguage } from "./i18n/Language";
import { getCommunityDiscussionCards, getCommunityDiscussion, originalXUrl } from "./data/communityDiscussion";
import { AdminRequestError, verifyAdminToken, createArticle, addArticleResponses, refreshArticleSource, normalizeArticleLink, responseLinks, type CreatedDiscussion, type WriteOutcome } from "./data/communityAdmin";
import { useCommunityResource } from "./useCommunityResource";

type Outcome = { slug: string; items: Array<Omit<WriteOutcome, "outcome"> & { outcome: WriteOutcome["outcome"] | "refreshed" }> };
const errorCopy: Record<AdminRequestError["kind"], string> = {
  unauthorized: "管理令牌无效或已失效，请重新验证。", invalid_links: "请使用 X 或 Twitter 的 status 链接。",
  invalid_input: "请检查表单。回应每次限 1–50 条，地址标识只能包含小写字母、数字和连字符。",
  missing: "未找到对应讨论或来源，请刷新列表。", unavailable: "服务暂时不可用，请检查部署配置后重试。",
  uncertain: "请求未能确认完成，请先检查讨论页，再决定是否重试。",
};

export default function CommunityAdminPage() {
  const { t, href } = useLanguage();
  // Credentials deliberately stay in component memory, never browser storage.
  const [token, setToken] = useState("");
  const [enteredToken, setEnteredToken] = useState("");
  const [primaryUrl, setPrimaryUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const [selectedSlug, setSelectedSlug] = useState("");
  const [responseInput, setResponseInput] = useState("");
  const [created, setCreated] = useState<CreatedDiscussion | null>(null);
  const [outcomes, setOutcomes] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const generation = useRef(0);
  useEffect(() => () => { generation.current += 1; }, []);
  const listLoader = useCallback((signal: AbortSignal) => token ? getCommunityDiscussionCards(signal) : Promise.resolve([]), [token]);
  const cards = useCommunityResource(listLoader);
  const detailLoader = useCallback((signal: AbortSignal) => token && selectedSlug ? getCommunityDiscussion(selectedSlug, signal) : Promise.resolve(null), [token, selectedSlug]);
  const resource = useCommunityResource(detailLoader);
  const selected = resource.data?.slug === selectedSlug ? resource.data : null;
  const options: Array<{ slug: string; title: string }> = (token ? cards.data ?? [] : []).map(card => ({ slug: card.slug, title: card.title }));
  if (token && created && !options.some(card => card.slug === created.slug)) options.push({ slug: created.slug, title: created.title });

  function logout() {
    generation.current += 1;
    setToken(""); setEnteredToken(""); setBusy(null); setNotice(null); setSelectedSlug(""); setCreated(null); setOutcomes(null); setResponseInput("");
  }
  function showError(error: unknown) {
    const kind = error instanceof AdminRequestError ? error.kind : "uncertain";
    if (kind === "unauthorized") logout();
    setNotice({ text: errorCopy[kind], error: true });
  }
  async function authenticate(event: FormEvent) {
    event.preventDefault();
    const candidate = enteredToken.trim();
    if (!candidate) { showError(new AdminRequestError("unauthorized")); return; }
    const current = ++generation.current;
    setBusy("auth"); setNotice(null);
    try {
      await verifyAdminToken(candidate);
      if (current === generation.current) { setToken(candidate); setEnteredToken(""); }
    } catch (error) { if (current === generation.current) showError(error); }
    finally { if (current === generation.current) setBusy(null); }
  }
  async function run<T>(operation: string, execute: (credential: string) => Promise<T>, success: (result: T) => void) {
    if (!token || busy) return;
    const current = generation.current;
    setBusy(operation); setNotice(null);
    try {
      const result = await execute(token);
      if (current === generation.current) success(result);
    } catch (error) { if (current === generation.current) showError(error); }
    finally { if (current === generation.current) setBusy(null); }
  }
  function submitArticle(event: FormEvent) {
    event.preventDefault();
    try {
      const url = normalizeArticleLink(primaryUrl);
      const slug = customSlug.trim();
      if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new AdminRequestError("invalid_input");
      const input = { primaryUrl: url, ...(title.trim() ? { title: title.trim() } : {}), ...(description.trim() ? { description: description.trim() } : {}), ...(slug ? { slug } : {}), status: "published" as const };
      void run("create", credential => createArticle(credential, input), result => {
        setCreated(result.discussion); setSelectedSlug(result.discussion.slug); setPrimaryUrl(""); setTitle(""); setDescription(""); setCustomSlug(""); setOutcomes(null);
        setNotice({ text: "讨论已创建并发布。", error: false }); cards.retry();
      });
    } catch (error) { showError(error); }
  }
  function submitResponses(event: FormEvent) {
    event.preventDefault();
    try {
      const urls = responseLinks(responseInput);
      if (!selectedSlug) throw new AdminRequestError("invalid_input");
      const slug = selectedSlug;
      void run("responses", credential => addArticleResponses(credential, slug, urls), result => {
        setOutcomes({ slug, items: result }); setResponseInput(""); setNotice({ text: "回应处理完成，请查看逐条结果。", error: false }); cards.retry(); resource.retry();
      });
    } catch (error) { showError(error); }
  }
  function refreshSource(statusId: string) {
    const slug = selectedSlug;
    void run(`refresh:${statusId}`, credential => refreshArticleSource(credential, slug, statusId), result => {
      setNotice({ text: result.fetchStatus === "success" ? "来源已成功刷新。" : "来源刷新失败，已保存正文仍保留。", error: result.fetchStatus !== "success" });
      setOutcomes(previous => previous?.slug === slug ? { ...previous, items: previous.items.map(item => item.statusId === statusId ? { ...item, outcome: result.fetchStatus === "success" ? "refreshed" : "failed" } : item) } : previous);
      resource.retry(); cards.retry();
    });
  }
  const locked = !token || busy !== null;
  const outcomeLabels = { created: "已新增", duplicate: "已归档，无需重复添加", failed: "抓取失败", refreshed: "已刷新" };

  return <main className="site-shell community-admin-page">
    <SiteHeader />
    <div className="admin-wrap">
      <header className="admin-intro"><p className="eyebrow">COMMUNITY / ADMIN</p><h1>{t("社区讨论管理")}</h1><p>{token ? t("粘贴主文章与回应链接，抓取并保存原文。") : t("输入管理员密钥后进入社区讨论管理。")}</p><a href={href("/archive/community-discussion")}>{t("查看公开讨论页")} ↗</a></header>
      <section className="admin-panel">
        <h2>{t("管理员验证")}</h2>
        {token ? <div className="admin-session"><p>{t("管理令牌已验证。")}</p><button type="button" onClick={logout}>{t("退出管理")}</button></div> : <form onSubmit={authenticate} className="admin-auth-form">
          <label>{t("管理令牌")}<input type="password" autoComplete="off" value={enteredToken} onChange={event => setEnteredToken(event.target.value)} required disabled={busy !== null} /></label>
          <button type="submit" disabled={busy !== null}>{busy === "auth" ? t("正在验证…") : t("验证令牌")}</button>
        </form>}
        <p className="admin-help">{t("输入统一管理员密钥。退出或刷新后需要重新验证。")}</p>
      </section>
      {notice && <div className={`admin-notice ${notice.error ? "error" : "success"}`} role={notice.error ? "alert" : "status"}>{t(notice.text)}</div>}
      {token && <div className="admin-form-grid">
        <section className="admin-panel"><p className="eyebrow">01 / CREATE</p><h2>{t("创建主文章讨论")}</h2>
          <form onSubmit={submitArticle}><fieldset disabled={locked}>
            <label>{t("主文章 X 链接")}<input type="url" value={primaryUrl} onChange={event => setPrimaryUrl(event.target.value)} placeholder="https://x.com/author/status/123…" required /></label>
            <label>{t("备用标题（可选）")}<input value={title} onChange={event => setTitle(event.target.value)} maxLength={160} /></label>
            <p className="admin-help">{t("文章原有标题优先；普通推文可以使用备用标题。")}</p>
            <label>{t("简介（可选）")}<textarea value={description} onChange={event => setDescription(event.target.value)} maxLength={600} rows={3} /></label>
            <label>{t("地址标识（可选）")}<input value={customSlug} onChange={event => setCustomSlug(event.target.value)} placeholder="pearl-debate" /></label>
            <p className="admin-help">{t("留空会自动生成。点击创建后，讨论会直接公开发布。")}</p>
          </fieldset><button type="submit" disabled={locked}>{busy === "create" ? t("正在抓取主文章…") : t("创建并发布讨论")}</button></form>
          {token && created && <p className="admin-result-link"><a href={href(`/archive/community-discussion/${created.slug}`)} target="_blank" rel="noreferrer">{t("打开已发布讨论")} <span aria-hidden="true">↗</span></a></p>}
        </section>
        <section className="admin-panel"><p className="eyebrow">02 / RESPONSES</p><h2>{t("添加辩论与回应")}</h2>
          {token && cards.error && <p className="admin-inline-error" role="alert">{t("无法读取讨论列表，请确认数据库配置。")}</p>}
          <form onSubmit={submitResponses}><fieldset disabled={locked}>
            <label>{t("选择讨论")}<select value={selectedSlug} onChange={event => { setSelectedSlug(event.target.value); setOutcomes(null); }} required><option value="">{cards.loading ? t("正在读取讨论…") : t("请选择讨论")}</option>{options.map(card => <option key={card.slug} value={card.slug}>{card.title}</option>)}</select></label>
            <label>{t("回应 X 链接")}<textarea value={responseInput} onChange={event => setResponseInput(event.target.value)} placeholder="https://x.com/author/status/123…" rows={7} required /></label>
            <p className="admin-help">{t("一行一个链接，每次最多 50 条。重复来源不会再次创建。")}</p>
          </fieldset><button type="submit" disabled={locked || !selectedSlug}>{busy === "responses" ? t("正在抓取回应…") : t("添加回应")}</button></form>
        </section>
      </div>}
      {token && outcomes?.slug === selectedSlug && <section className="admin-panel"><h2>{t("本次添加结果")}</h2><div className="admin-table-scroll"><table><thead><tr><th>{t("来源 ID")}</th><th>{t("处理结果")}</th><th>{t("操作")}</th></tr></thead><tbody>{outcomes.items.map((item, index) => <tr key={`${item.statusId}:${index}`}><td>{item.statusId}</td><td>{t(outcomeLabels[item.outcome])}</td><td>{item.outcome === "failed" && <button type="button" disabled={locked} aria-label={`${t("重试来源")} ${item.statusId}`} onClick={() => refreshSource(item.statusId)}>{t("重试抓取")}</button>}</td></tr>)}</tbody></table></div></section>}
      {token && selectedSlug && <section className="admin-panel"><h2>{t("已保存的来源")}</h2>{resource.loading && <p>{t("正在读取来源…")}</p>}{resource.error && <p className="admin-inline-error" role="alert">{t("无法读取来源，请刷新后重试。")}</p>}
        {selected && <div className="admin-table-scroll"><table><thead><tr><th>{t("来源")}</th><th>{t("抓取状态")}</th><th>{t("操作")}</th></tr></thead><tbody>{selected.sources.map(source => <tr key={source.xStatusId}><td>{originalXUrl(source.url) ? <a href={originalXUrl(source.url)} target="_blank" rel="noreferrer">{source.author ?? source.handle ?? source.xStatusId} ↗</a> : source.xStatusId}</td><td>{source.fetchStatus === "success" ? t("已保存") : t("抓取失败")}</td><td><button type="button" disabled={locked} aria-label={`${t("刷新来源")} ${source.xStatusId}`} onClick={() => refreshSource(source.xStatusId)}>{busy === `refresh:${source.xStatusId}` ? t("正在抓取…") : t("刷新原文")}</button></td></tr>)}</tbody></table></div>}
      </section>}
    </div>
  </main>;
}
