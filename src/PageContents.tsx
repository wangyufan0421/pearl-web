import { useEffect, useState } from "react";
import { useLanguage, stripLanguage } from "./i18n/Language";

type Entry = { element: HTMLElement; title: string; number: string };

function collect(route: string, zh: boolean): Entry[] {
  const main = document.querySelector('main'); if (!main) return [];
  let nodes: HTMLElement[] = [];
  if (route === '/overview') nodes = Array.from(main.querySelectorAll<HTMLElement>('#overview, #market-cap, #chain, #valuation, #ai'));
  else if (route === '/chain') nodes = Array.from(main.querySelectorAll<HTMLElement>('.chain-wrap > .chain-module, .chain-wrap > .network-profit-section'));
  else if (route === '/valuation') nodes = Array.from(main.querySelectorAll<HTMLElement>('.valuation-module'));
  else if (route === '/economics') nodes = Array.from(main.querySelectorAll<HTMLElement>('.economics-page > .econ-cards, .economics-page .econ-panel'));
  else if (route === '/pearl-vs-bitcoin') nodes = Array.from(main.querySelectorAll<HTMLElement>('.comparison-ratio-section, .comparison-details, .comparison-market, .comparison-method'));
  else if (route === '/' || route === '/archive') nodes = Array.from(main.querySelectorAll<HTMLElement>('.archive-section'));
  else if (route === '/archive/core-mechanism') nodes = Array.from(main.querySelectorAll<HTMLElement>('section')).filter(el => !!el.querySelector('h2'));
  else if (route === '/archive/people') nodes = Array.from(main.querySelectorAll<HTMLElement>('.people-section'));
  else if (route === '/archive/whitepaper') nodes = Array.from(main.querySelectorAll<HTMLElement>('.whitepaper-layout'));
  else if (route === '/archive/articles') nodes = Array.from(main.querySelectorAll<HTMLElement>('.articles-hero, .articles-list'));
  else if (route === '/archive/community-discussion' || route === '/archive/community-discussion/') nodes = Array.from(main.querySelectorAll<HTMLElement>('.community-hero, .community-debate'));
  else if (route.startsWith('/archive/community-discussion/')) nodes = Array.from(main.querySelectorAll<HTMLElement>('.community-article-hero, .community-dialogue'));
  return nodes.map((element, i) => {
    let title = element.querySelector('h1,h2,h3')?.textContent?.trim() ?? '';
    if (route === '/overview' && element.id === 'overview') title = zh ? '概况' : 'Overview';
    if (route === '/economics' && element.classList.contains('econ-cards')) title = zh ? '经济概况' : 'Economic overview';
    if (element.classList.contains('articles-list')) title = zh ? '文章列表' : 'Articles';
    if (element.classList.contains('community-debate')) title = zh ? '讨论列表' : 'Discussions';
    if (element.classList.contains('community-dialogue')) title = zh ? '讨论内容' : 'Discussion';
    if (element.classList.contains('comparison-method')) title = zh ? '方法与来源' : 'Method and sources';
    if (!title) title = zh ? '概览' : 'Overview';
    const raw = element.querySelector('header > p, .comparison-section-title p, .eyebrow')?.textContent?.match(/^\s*(\d{2})\s*\//)?.[1];
    return { element, title, number: raw ?? String(i + 1).padStart(2, '0') };
  });
}

export function PageContents() {
  const { language } = useLanguage(); const zh = language === 'zh';
  const [entries, setEntries] = useState<Entry[]>([]); const [active, setActive] = useState(0);
  useEffect(() => {
    let frame = 0;
    const refresh = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { const route = stripLanguage(window.location.pathname); setEntries(route.startsWith('/admin/') ? [] : collect(route, zh)); }); };
    refresh(); window.addEventListener('popstate', refresh); window.addEventListener('hashchange', refresh);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('popstate', refresh); window.removeEventListener('hashchange', refresh); };
  }, [zh]);
  useEffect(() => {
    if (!entries.length) return;
    const onScroll = () => { let current = 0; entries.forEach((entry, index) => { if (entry.element.getBoundingClientRect().top <= 180) current = index; }); setActive(current); };
    onScroll(); window.addEventListener('scroll', onScroll, { passive:true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [entries]);
  if (entries.length < 2) return null;
  return <nav className="page-contents" aria-label={zh ? '本页目录' : 'On this page'}><div>{entries.map((entry,index) => <button type="button" key={`${entry.number}-${index}`} className={active === index ? 'active' : ''} aria-current={active === index ? 'location' : undefined} onClick={() => { setActive(index); entry.element.scrollIntoView({behavior:'smooth',block:'start'}); }}><span>{entry.number}</span><b>{entry.title}</b></button>)}</div></nav>;
}
