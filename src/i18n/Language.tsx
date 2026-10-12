import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { english } from "./catalogue";

export type Language = "zh" | "en";
const storageKey = "pearl-language";
export function languageFromPath(path: string): Language { return /^\/en(?:\/|$)/.test(path) ? "en" : "zh"; }
export function stripLanguage(path: string) { return path.replace(/^\/en(?=\/|$)/, "") || "/"; }
export function localizedHref(href: string, language: Language) {
  if (!href.startsWith("/") || href.startsWith("//") || /^\/(?:api|assets|documents)(?:\/|$)/.test(href)) return href;
  const path = stripLanguage(href);
  return language === "en" ? `/en${path === "/" ? "" : path}` : path;
}
export function formatLocale() { return languageFromPath(window.location.pathname) === "en" ? "en-US" : "zh-CN"; }

// Exact editorial translations first; short catalogue fragments cover dynamic
// readouts (for example a block height embedded in a sentence). Source posts
// must not be passed through this function.
const fragments = Object.keys(english).sort((a, b) => b.length - a.length);
const fragmentPattern = new RegExp(fragments.map(key => key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g");
export function translate<T>(value: T, language: Language): T {
  if (language !== "en" || typeof value !== "string") return value;
  const exact = Object.hasOwn(english, value) ? english[value] : undefined;
  if (exact !== undefined) return exact as T;
  return value.replace(fragmentPattern, key => english[key]) as T;
}

type LanguageContextValue = { language: Language; t: <T>(value: T) => T; href: (url: string) => string; switchLanguage: (language: Language) => void };
const LanguageContext = createContext<LanguageContextValue | null>(null);

function initialLanguage(): Language {
  const explicit = languageFromPath(window.location.pathname);
  if (window.location.pathname !== "/" || window.location.hash) return explicit;
  try { return localStorage.getItem(storageKey) === "en" ? "en" : "zh"; } catch { return explicit; }
}

const pageTitles: Record<string, string> = {
  "/": "Pearl 是什么", "/archive": "Pearl 是什么", "/overview": "数据概览", "/chain": "链上数据", "/valuation": "PRL 数据汇总",
  "/archive/core-mechanism": "核心机制", "/archive/whitepaper": "Pearl 白皮书", "/archive/articles": "Pearl相关文章", "/archive/people": "Pearl人物与关系",
  "/archive/community-discussion": "Pearl社区讨论",
  "/admin/community-discussions": "社区讨论管理",
};
const pageDescriptions: Record<string, string> = {
  "/": "了解 Pearl 的双工计算、有用工作量证明和技术边界。",
  "/archive": "了解 Pearl 的双工计算、有用工作量证明和技术边界。",
  "/overview": "查看 PRL 永续价格、Pearl 网络状态、供应与 AI 成本指标。",
  "/chain": "查看 Pearl 矿池、交易活跃度、币龄和持币地址数据。",
  "/valuation": "查看 PRL 参考价格、市值、BTC 相对尺度和发行数据。",
  "/archive/core-mechanism": "了解 Pearl 如何将矩阵计算用于 AI 推理和挖矿尝试。",
  "/archive/whitepaper": "阅读 Pearl INT 白皮书原文及对应中文译本。",
  "/archive/articles": "浏览 Pearl 协议、学术研究、经济分析和社区长文。",
  "/archive/people": "探索 Pearl 公开人物、研究关联和合作记录的证据边界。",
  "/archive/community-discussion": "阅读已归档的社区推文、文章及完整回应，原帖保留原文。",
  "/admin/community-discussions": "通过管理员页面创建讨论、添加回应及刷新归档来源。",
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const [locationKey, setLocationKey] = useState(window.location.pathname + window.location.hash);
  useEffect(() => {
    if (language === "en" && window.location.pathname === "/" && !window.location.hash) {
      window.history.replaceState(window.history.state, "", `/en${window.location.search}`);
      setLocationKey("/en");
    }
    const sync = () => { setLanguage(languageFromPath(window.location.pathname)); setLocationKey(window.location.pathname + window.location.hash); };
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => { window.removeEventListener("popstate", sync); window.removeEventListener("hashchange", sync); };
  }, []);
  useEffect(() => {
    document.documentElement.lang = language === "en" ? "en" : "zh-CN";
    const [pathname, hash] = locationKey.split("#");
    const baseRoute = stripLanguage(pathname);
    const legacyRoute = baseRoute === "/" && hash === "overview" ? "/overview" : baseRoute === "/archive" && hash === "community-discussion" ? "/archive/community-discussion" : baseRoute;
    const route = legacyRoute.startsWith("/archive/community-discussion/") ? "/archive/community-discussion" : legacyRoute;
    document.title = `${translate(pageTitles[route] ?? "Pearl 是什么", language)} · Pearl ${language === "en" ? "Community" : "中文社区"}`;
    let description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!description) { description = document.createElement("meta"); description.name = "description"; document.head.append(description); }
    description.content = translate(pageDescriptions[route] ?? pageDescriptions["/"], language);
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!robots) { robots = document.createElement("meta"); robots.name = "robots"; document.head.append(robots); }
    robots.content = route.startsWith("/admin/") ? "noindex,nofollow" : "index,follow";
  }, [language, locationKey]);
  const value = useMemo<LanguageContextValue>(() => ({
    language,
    t: value => translate(value, language),
    href: url => localizedHref(url, language),
    switchLanguage: next => {
      try { localStorage.setItem(storageKey, next); } catch { /* Private browsing can disable storage. */ }
      const location = window.location;
      const target = localizedHref(location.pathname, next) + location.search + location.hash;
      if (target !== location.pathname + location.search + location.hash) window.history.pushState(window.history.state, "", target);
      setLanguage(next);
      setLocationKey(window.location.pathname + window.location.hash);
      window.dispatchEvent(new PopStateEvent("popstate"));
    },
  }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  const language = languageFromPath(window.location.pathname);
  return context ?? { language, t: value => translate(value, language), href: url => localizedHref(url, language), switchLanguage: () => {} };
}
