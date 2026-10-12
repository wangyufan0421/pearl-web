import { ArchiveNavigation } from "./ArchiveNavigation";

type SourceCard = {
  sourceName: string;
  handle: string;
  avatar: string;
  publishedAt: string;
  href: string;
  ariaLabel: string;
  detailHref: string;
  kind: "X ARTICLE";
  title?: string;
  translation: string;
  engagement: { replies: number; reposts: number; likes: number; views: number };
};

const sourceCards: SourceCard[] = [
  {
    sourceName: "blocmates.",
    handle: "@blocmates",
    avatar: "https://pbs.twimg.com/profile_images/2016157466698944513/a7EkPcJa_normal.jpg",
    publishedAt: "2026.10.09",
    href: "https://x.com/blocmates/status/2108519545514410023?s=20",
    ariaLabel: "查看 blocmates 原文",
    detailHref: "/archive/community-discussion/wtf-is-pearl",
    kind: "X ARTICLE",
    title: "WTF Is Pearl? Why Is Everyone Comparing It to Nockchain?",
    translation: "这是一篇把 Pearl 与 Nockchain 放进同一比较框架的长文：前者被描述为围绕 AI 矩阵计算与挖矿的网络，后者则被描述为更宽泛的可验证计算路径。这里保留文章入口与中文阅读线索，不复制原文全文。",
    engagement: { replies: 28, reposts: 27, likes: 169, views: 28317 },
  },
];

function formatCount(value: number) {
  return new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function XSourceCard({ card }: { card: SourceCard }) {
  return <article className="x-source-card" data-testid="x-source-card">
    <a className="x-source-entry" href={card.detailHref} aria-label="进入 WTF Is Pearl? 讨论页">
      <header className="x-source-head">
        <img src={card.avatar} alt="" />
        <div><strong>{card.sourceName} <i aria-label="已验证">✓</i></strong><span>{card.handle} · {card.publishedAt}</span></div>
        <b aria-hidden="true">···</b>
      </header>
      <span className="x-source-kind">{card.kind}</span>
      {card.title && <h3>{card.title}</h3>}
      <p>{card.translation}</p>
      <div className="x-source-actions" aria-label="原帖互动数据（抓取时）">
        <span title="回复">◌ {formatCount(card.engagement.replies)}</span><span title="转发">↻ {formatCount(card.engagement.reposts)}</span><span title="喜欢">♡ {formatCount(card.engagement.likes)}</span><span title="浏览">▥ {formatCount(card.engagement.views)}</span>
      </div>
    </a>
    <a href={card.href} target="_blank" rel="noreferrer" aria-label={card.ariaLabel}>查看原帖 <span aria-hidden="true">↗</span></a>
  </article>;
}

export default function CommunityDiscussionPage() {
  return <main className="site-shell community-page">
    <header className="topbar">
      <a className="brand" href="/">Pearl <span>中文社区</span></a>
      <nav aria-label="主导航"><a href="/overview">数据概览</a><a href="/chain">链上数据</a><a href="/valuation">数据汇总</a><ArchiveNavigation current /></nav>
    </header>

    <section className="community-hero" aria-labelledby="community-title">
      <div>
        <p className="eyebrow">ARCHIVE / COMMUNITY DEBATE</p>
        <h1 id="community-title">Pearl社区讨论</h1>
        <p>将社区的高热度文章整理为可回到原帖的讨论档案。原帖与中文转述并排；事实、观点与尚待验证的推断不混写。</p>
      </div>
      <aside className="community-reading-rule">
        <span>READING RULE</span>
        <strong>先看原帖，再读转述。</strong>
        <p>社区帖呈现作者的判断，不构成协议状态、商业合作或投资结论。互动数为本次抓取时的快照。</p>
      </aside>
    </section>

    <section className="community-debate" aria-labelledby="debate-title">
      <header className="community-section-head"><p className="eyebrow">01 / DISCUSSION FILE</p><h2 id="debate-title">WTF Is Pearl?</h2><p>blocmates 围绕 Pearl 与 Nockchain 所做的比较长文。文章中出现的不同论点与辩论，将在后续按原文章节分别收录，而不在此页另行拼接。</p></header>

      <div className="x-source-grid">
        {sourceCards.map((card) => <XSourceCard key={card.href} card={card} />)}
      </div>
    </section>

  </main>;
}
