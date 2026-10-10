const topics = [
  ["01", "Duplex Work", "一份 AI 计算负载，如何服务两种目标？", "#duplex-work"],
  ["02", "挖矿如何嵌入计算", "应用结果与出块证明，在哪一步分开？", "#mining-flow"],
  ["03", "Pearl-GEMM", "从整数方案到浮点方案，改变了什么？", "#pearl-gemm"],
  ["04", "两套里程碑", "挖矿与 AI 算力支付，分别走到哪里？", "#milestones"],
] as const;

function EvidenceTag({ tone, children }: { tone: "mechanism" | "statement" | "open"; children: string }) {
  return <span className={`evidence-tag ${tone}`}>{children}</span>;
}

export default function ArchiveHomePage() {
  return <main className="site-shell archive-page">
    <header className="topbar">
      <a className="brand" href="/">Pearl <span>中文社区</span></a>
      <nav aria-label="主导航">
        <a href="/overview">数据总览</a><a href="/chain">链上</a><a href="/valuation">数据</a><a href="/archive">项目档案</a>
      </nav>
    </header>

    <section className="archive-hero" aria-labelledby="archive-title">
      <div className="archive-hero-copy">
        <p className="eyebrow">01 / START HERE</p>
        <h1 id="archive-title">Pearl 是什么</h1>
        <p className="archive-definition">Pearl 是一条 <strong>PoW 区块链</strong>，旨在让 AI 计算负载参与挖取原生代币 PRL。</p>
        <p className="archive-intro">它想让同一套算力服务两种目的：交付实际的 AI 推理工作，同时在符合条件时参与区块链出块。</p>
        <div className="archive-actions"><a href="#introduction">开始阅读 <span>↓</span></a><a href="/overview">查看数据总览 <span>→</span></a></div>
      </div>
      <div className="archive-topic-grid" aria-label="阅读入口">
        {topics.map(([index, title, question, href]) => <a href={href} key={title}>
          <span>{index} / EXPLORE</span><b>{title}</b><p>{question}</p><i aria-hidden="true">↓</i>
        </a>)}
      </div>
    </section>

    <article className="archive-reading">
      <section id="introduction" className="archive-section archive-lead">
        <p className="eyebrow">THE BRIEF</p>
        <h2>核心定位与工作原理</h2>
        <div className="archive-prose">
          <p>在人工智能与区块链技术交汇的探索中，Pearl（PRL）提出了一个引人关注的设定：让 AI 算力不仅服务于实际的推理请求，还能同时参与区块链挖矿。</p>
          <p><EvidenceTag tone="mechanism">公开机制</EvidenceTag> Pearl 的目标不是让每一次 AI 请求自动产生奖励。它是一条工作量证明链：当矿工执行符合规则的计算并满足网络难度要求时，才可能获得出块机会；最终仍须由全网广播并接受。</p>
        </div>
      </section>

      <section id="duplex-work" className="archive-section">
        <p className="eyebrow">01 / DUPLEX WORK</p>
        <h2>一份负载，两种产出</h2>
        <div className="archive-prose">
          <p>传统 AI 推理会消耗 GPU 擅长的矩阵乘法（GEMM）运算；传统 PoW 则依靠矿工竞争出块。Pearl 提出的 Duplex Work（双工工作）尝试把两者放入同一个计算过程。</p>
        </div>
        <div className="archive-split-card-grid">
          <article><span>对客户</span><b>提交 AI 输入</b><p>获得模型推理的应用结果。</p></article>
          <article><span>对矿工</span><b>执行符合条件的矩阵运算</b><p>在计算过程中尝试寻找满足区块难度的证明。</p></article>
        </div>
        <p className="archive-caveat">算得更多代表拥有更多尝试机会，并不意味着单次 AI 请求保证出块。</p>
      </section>

      <section id="mining-flow" className="archive-section">
        <p className="eyebrow">02 / MINING FLOW</p>
        <h2>挖矿如何嵌入计算</h2>
        <div className="archive-prose">
          <p>在早期提出的整数方案中，Pearl 将 AI 输入、链上状态和规定的矩阵计算连接起来。安全性依赖于对计算中间过程的结构检查，而不是只对最终输出做一次 Hash。</p>
        </div>
        <ol className="archive-flow" aria-label="Pearl 挖矿流程">
          <li><span>准备</span><b>绑定 AI 输入与链上状态</b></li>
          <li><span>计算</span><b>运行规定矩阵运算与结构化噪声</b></li>
          <li><span>检查</span><b>对照挖矿目标条件</b></li>
          <li><span>返回</span><b>交付结果；满足条件时提交证明</b></li>
        </ol>
        <p className="archive-caveat"><EvidenceTag tone="mechanism">公开机制</EvidenceTag> 应用结果与挖矿证明是相连但不同的产物；只有被网络接受的区块才构成实际奖励。</p>
      </section>

      <section id="pearl-gemm" className="archive-section">
        <p className="eyebrow">03 / PEARL-GEMM</p>
        <h2>从整数到 Pearl-GEMM</h2>
        <div className="archive-prose">
          <p>算力运营商是否愿意接入，取决于模型兼容性与性能开销。2026 年 9 月发布的 Pearl Floating Point Scheme 对底层流程做了重新构造，例如将噪声处理放在 FP8 量化之前；它不应与早期整数方案的实现细节混为一谈。</p>
          <p><EvidenceTag tone="statement">团队表述</EvidenceTag> 团队曾表示，在测试网、NVIDIA Blackwell 原生浮点架构下，Pearl-GEMM 的端到端性能开销约为 0–3%，并预期相关功能在“几周内”推进。</p>
          <p><EvidenceTag tone="open">待验证</EvidenceTag> 这一性能数据不是第三方独立基准测试；时间预期也不等同于主网已完成上线。实际表现仍需按模型规格、硬件、精度和服务场景验证。</p>
        </div>
      </section>

      <section id="milestones" className="archive-section">
        <p className="eyebrow">04 / MILESTONES</p>
        <h2>两个方向，两套里程碑</h2>
        <div className="archive-milestone-grid">
          <article><span>阶段一</span><b>算力 → PRL</b><p>矿工贡献 AI 算力，并在 PoW 机制下尝试获得 PRL 奖励。这是基础的 L1 链上机制。</p></article>
          <article><span>阶段二</span><b>PRL → 算力</b><p>用户以 PRL 支付并购买去中心化网络中的 AI 推理算力，形成反向消费与结算闭环。</p></article>
        </div>
        <div className="archive-prose">
          <p><EvidenceTag tone="open">待验证</EvidenceTag> 算力挖矿可以先行出现，但 PRL 计价的算力消费与结算市场需要独立的链上结算证据，不能因前者存在就视为后者已经成熟。</p>
          <p><EvidenceTag tone="open">待验证</EvidenceTag> 单次矩阵计算的挖矿凭证不等于完整大模型跑完整场推理的全局证明。团队曾将 Proof-of-Inference 归为独立于 L1 挖矿的 L2 / Rollup 方向，相关高吞吐支付与结算能力仍需持续观察。</p>
        </div>
      </section>

      <section className="archive-section archive-conclusion">
        <p className="eyebrow">THE TAKEAWAY</p>
        <h2>让 AI 计算与出块尝试共用一份负载，是 Pearl 的核心命题。</h2>
        <p>这是一种具有吸引力的方向，但技术机制、性能、主网状态与支付结算的落地进度，需要分别阅读、分别验证。</p>
      </section>
    </article>

    <section className="archive-next">
      <p className="eyebrow">FOLLOW THE RECORD</p>
      <h2>理解机制之后，再看它正在发生什么。</h2>
      <div><a href="/overview">进入数据总览 <span>→</span></a><a href="/chain">查看链上实况 <span>→</span></a></div>
    </section>
  </main>;
}
