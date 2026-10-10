import { ArchiveNavigation } from "./ArchiveNavigation";

type ResearchArticle = {
  title: string;
  authors: string;
  tags: string[];
  summary: string;
  href: string;
  internal?: boolean;
};

const articles: ResearchArticle[] = [
  {
    title: "Proofs of Useful Work from Arbitrary Matrix Multiplication",
    authors: "Komargodski & Weinstein",
    tags: ["PoUW", "协议构造"],
    summary: "任意矩阵乘的 PoUW 原语构造；Pearl 相关开源下的学术起点之一。",
    href: "https://arxiv.org/abs/2504.09971",
  },
  {
    title: "Pearl INT 白皮书",
    authors: "Pearl Research",
    tags: ["一次性读", "核心协议"],
    summary: "核心协议说明也是站内原始材料；先看问题定义与安全假设。",
    href: "/archive/whitepaper",
    internal: true,
  },
  {
    title: "Pearl Floating Point Scheme Specification",
    authors: "Pearl Research Labs",
    tags: ["FP8", "实现路线"],
    summary: "面向 FP8 矩阵乘的 PoUW 方案，承载对外宣称的工程路线。",
    href: "https://www.pearlresearch.ai/Pearl_Whitepaper.pdf",
  },
  {
    title: "Reproducing GPU-Level Non-Determinism",
    authors: "Badash, Boneh, Komargodski & Srivastava",
    tags: ["GPU 验证", "非确定"],
    summary: "重现 GPU 级别的 bit-exact 差异，为可验证推理提供工程背景。",
    href: "https://arxiv.org/abs/2603.20421",
  },
  {
    title: "Pearl Improvement Proposals",
    authors: "Pearl Research Labs",
    tags: ["PIP", "协议附录"],
    summary: "包含 PIP-2 MoE、PIP-3 FP 证明等；跟踪验证、分布式与升级记录。",
    href: "https://pearl-research-labs.github.io/pips/pip-0003/",
  },
  {
    title: "The Economics of Proof-of-Useful-Work",
    authors: "Rafael Pass",
    tags: ["经济模型", "duplex"],
    summary: "从 duplex 角度讨论有用算力与安全预算的经济学；同时活动是否足够。",
    href: "https://arxiv.org/abs/2606.06700",
  },
  {
    title: "Proof of Work With External Utilities",
    authors: "Bar-On, Komargodski & Weinstein",
    tags: ["有用算力", "去中心化"],
    summary: "研究当矿工拥有外部收益（如 AI 推理）时，有用算力与去中心化动态如何变化。",
    href: "https://arxiv.org/abs/2505.21685",
  },
  {
    title: "Simplex Consensus",
    authors: "Chan & Pass",
    tags: ["L2 共识", "支持读物"],
    summary: "与 Pearl 协议不同层；作为 L2 /支付共识读物的背景文献。",
    href: "https://eprint.iacr.org/2023/463",
  },
  {
    title: "The Usefulness Gap in Proof-of-Useful-Work",
    authors: "Basu",
    tags: ["竞品实证", "外部观察"],
    summary: "外部观察 Pearl cuPOW：协议验证与工程实现是否为真实 AI 负载；记录有用算力来源。",
    href: "https://arxiv.org/abs/2606.04819",
  },
  {
    title: "Pearl thesis: PoUW / Duplex vs Bitcoin security budget",
    authors: "brezshares",
    tags: ["英文长文", "社区 thesis"],
    summary: "英文区核心 thesis 长帖，讨论 PoUW/Duplex 如何回应 BTC 安全预算与有用算力叙事。属社区观点，非官方声明。",
    href: "https://x.com/brezshares/status/2098035744598319569",
  },
  {
    title: "Response to Blockworks / MetaLight Pearl game-theory piece",
    authors: "brezshares",
    tags: ["英文长文", "辩论"],
    summary: "回应 Blockworks / @0xMetaLight 的 Pearl 博弈论文章并做纠偏；社区多人转发称被该帖说动。事实与推测需分开看。",
    href: "https://x.com/brezshares/status/2106476405949387201",
  },
  {
    title: "How I got into Pearl / Tom Schmidt thesis breakdown",
    authors: "andyyy",
    tags: ["英文长文", "社区 thesis"],
    summary: "高粉账号讲述被 Evan Van Ness 安利后，请 Dragonfly Tom Schmidt 拆解 Pearl thesis。伴随对谈视频：https://x.com/andyyy/status/2108826365243838756",
    href: "https://x.com/andyyy/status/2108099827930124377",
  },
  {
    title: "Proof-of-Verifiable Work & Pearl bull thesis (full conversation)",
    authors: "andyyy",
    tags: ["英文长文", "视频对谈"],
    summary: "完整对谈视频：Proof-of-Verifiable Work 与 Pearl bull thesis。属媒体/社区信息，非官方文档。",
    href: "https://x.com/andyyy/status/2108826365243838756",
  },
  {
    title: "Pearl as AI Bitcoin",
    authors: "tulipking",
    tags: ["英文长文", "叙事对比"],
    summary: "英文长帖将 Pearl 对标为「AI Bitcoin」并与竞品叙事对比；社区有表层批评反方（如 @0xSynthesis）。",
    href: "https://x.com/tulipking/status/2108579196268077447",
  },
  {
    title: "PoUW as next infra narrative",
    authors: "Tanaka_L2",
    tags: ["英文长文", "infra"],
    summary: "讨论 PoUW 可能成为下一波 infra 叙事：GPU 同时服务链安全与 AI 计算。属叙事/推测，非已验证事实。",
    href: "https://x.com/Tanaka_L2/status/2108067387618816464",
  },
  {
    title: "Monetary premium vs hashrate-follows-price",
    authors: "immutablejacob",
    tags: ["英文长文", "机制辩论"],
    summary: "回复 brezshares：货币溢价来自安全，但 hashrate 跟价格走；不同意「算力先于价格」路径。属社区辩论。",
    href: "https://x.com/immutablejacob/status/2108561206021648712",
  },
];

function SourceLink({ article }: { article: ResearchArticle }) {
  return <a className="article-source-link" href={article.href} {...(!article.internal ? { target: "_blank", rel: "noreferrer" } : {})}>
    {article.internal ? "站内阅读" : "阅读原文"}<span aria-hidden="true">↗</span>
  </a>;
}

export default function ArticlesPage() {
  return <main className="site-shell articles-page">
    <header className="topbar">
      <a className="brand" href="/">Pearl <span>中文社区</span></a>
      <nav aria-label="主导航">
        <a href="/overview">数据概览</a><a href="/chain">链上实况</a><a href="/valuation">数据汇总</a><ArchiveNavigation current />
      </nav>
    </header>

    <section className="articles-hero" aria-labelledby="articles-title">
      <div>
        <p className="eyebrow">ARCHIVE / READING LIST</p>
        <h1 id="articles-title">Pearl相关文章</h1>
        <p>围绕 Pearl 的协议、学术论文与可证性；也收录英文社区长文 / thread。一边是构造与经济实证，一边是社区 thesis 与辩论，可以自行判断信号强度。</p>
      </div>
      <aside className="articles-hero-note" aria-label="阅读卡说明">
        <span>16 / READING CARDS</span>
        <strong>从原始协议到英文社区长文，既有主源也有叙事与辩论的边界。</strong>
        <div><a href="/archive/whitepaper">阅读 INT 白皮书 <i aria-hidden="true">→</i></a><a href="/archive/core-mechanism">查看核心机制 <i aria-hidden="true">→</i></a></div>
      </aside>
    </section>

    <section className="articles-list" aria-label="Pearl相关文章阅读卡">
      {articles.map((article, index) => <article className="article-card" data-testid="article-card" key={article.title}>
        <div className="article-card-top"><span>{String(index + 1).padStart(2, "0")}</span><div>{article.tags.map((tag) => <b key={tag}>{tag}</b>)}</div></div>
        <p className="article-authors">{article.authors}</p>
        <h2><a href={article.href} {...(!article.internal ? { target: "_blank", rel: "noreferrer" } : {})}>{article.title}<span aria-hidden="true">↗</span></a></h2>
        <p className="article-summary">{article.summary}</p>
        <SourceLink article={article} />
      </article>)}
    </section>
  </main>;
}
