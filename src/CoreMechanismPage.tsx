import { useLanguage } from "./i18n/Language";
import { SiteHeader } from "./SiteHeader";

const flow = [
  ["01", "请求进来", "人或程序向 AI 服务发问；调度系统准备输入，并安排模型开始运行。"],
  ["02", "GPU 开始算", "模型逐层把输入变成矩阵运算与其他算子，主要算力消耗发生在这些矩阵核上。"],
  ["03", "Pearl 插进来", "对协议认定合格的矩阵工作附加与链状态相关的约束，并对照挖矿目标检查。"],
  ["04", "两个出口", "应用收到推理结果；只有满足条件且被网络接受时，链上证明才可能转化为奖励。"],
] as const;

const checklist = [
  "测的是哪个模型、哪套卡、什么精度，以及什么 batch / serving 条件？",
  "数字来自内部 benchmark，还是可复现的对比？",
  "规格、PR 或测试网，是否已经变成有文档的主网激活？",
] as const;

const conclusions = [
  ["机制本体", "合格矩阵运算同时服务推理结果与挖矿尝试（duplex）。"],
  ["用户体感", "你通常是为了答案而使用服务；出块是概率事件，不是标配赠品。"],
  ["工程演进", "从整数构造走向更贴近真实浮点推理栈的方案；发表不等于主网激活。"],
  ["经济外延", "收益补贴与 PEARL 购买算力都是可分开验证的下一层，不应提前写入机制结论。"],
] as const;

function EvidenceTag({ tone, children }: { tone: "mechanism" | "statement" | "open"; children: string }) {
  const { t, href: localizeHref, language } = useLanguage();
  return <span className={`mechanism-evidence ${tone}`}>{t(children)}</span>;
}

export default function CoreMechanismPage() {
  const { t, href: localizeHref, language } = useLanguage();
  return <main className="site-shell mechanism-page">
    <SiteHeader />

    <section className="mechanism-hero" aria-labelledby="mechanism-title">
      <div className="mechanism-hero-copy">
        <p className="eyebrow">FIELD GUIDE / 01</p>
        <h1 id="mechanism-title">{t("核心机制")}</h1>
        <h2>{t("同一次计算，两头办事")}</h2>
        <p>{t("Pearl 想回答一个很具体的问题：跑 AI 推理时，GPU 上的矩阵运算能否同时获得挖矿资格？项目把这种一算两用称为 ")}<strong>{t("duplex（双工）")}</strong>{language === "en" ? "." : "。"}</p>
        <p className="mechanism-hero-note">{t("模型答案几乎总会有；出块奖励没有保证。它们共享一次计算，但不是两份必得的产出。")}</p>
      </div>
      <div className="mechanism-diagram" aria-label={t("一次计算通向推理结果和挖矿尝试的示意")}>
        <p>ONE COMPUTE LOAD</p>
        <div className="mechanism-diagram-core">DUPLEX<span>{t("双工工作")}</span></div>
        <div className="mechanism-diagram-branches">
          <article><span>APPLICATION</span><b>{t("推理结果")}</b><p>{t("交给用户的模型答案")}</p></article>
          <article><span>NETWORK</span><b>{t("挖矿尝试")}</b><p>{t("争取被网络接受的证明")}</p></article>
        </div>
      </div>
    </section>

    <nav className="mechanism-index" aria-label={t("核心机制页内导航")}>
      <a href={localizeHref("#distinction")}>{t("两件事")}</a><a href={localizeHref("#mechanism-flow")}>{t("算力怎么走")}</a><a href={localizeHref("#pearl-gemm")}>{t("浮点转向")}</a><a href={localizeHref("#mechanism-economics")}>{t("经济外延")}</a>
    </nav>

    <article className="mechanism-reading">
      <section id="distinction" className="mechanism-section">
        <div className="mechanism-section-heading"><p className="eyebrow">01 / THE DISTINCTION</p><h2>{t("先分清两件本来不相干的事")}</h2></div>
        <div className="mechanism-section-body">
          <div className="mechanism-compare">
            <article><span>{t("INFERENCE / 推理")}</span><h3>{t("为了答案而计算")}</h3><p>{t("用户或应用把输入交给模型；模型给出输出。中间大量工作是矩阵乘法，GPU 天生擅长这类运算。")}</p></article>
            <article><span>{t("MINING / 挖矿")}</span><h3>{t("为了出块而竞争")}</h3><p>{t("PoUW 链上，参与者以计算竞争区块证明；谁先提交符合规则且被网络接受的结果，谁才可能获得 PEARL 奖励。")}</p></article>
          </div>
          <p className="mechanism-copy">{t("传统世界里，这两套活各算各的账。Pearl 的核心主张是让")}<strong>{t("符合条件的矩阵运算")}</strong>{t("同时服务应用，并参与挖矿竞争——不是另开一台矿机，而是尽量让有用算力也具备争块资格。")}</p>
        </div>
      </section>

      <section id="mechanism-flow" className="mechanism-section">
        <div className="mechanism-section-heading"><p className="eyebrow">02 / THE ROUTE</p><h2>{t("算力实际怎么走")}</h2><p>{t("下面是理解机制的四步示意，不表示线上每一个算子都会挖矿。")}</p></div>
        <div className="mechanism-section-body">
          <ol className="mechanism-flow-list">
            {flow.map(([index, title, description]) => <li key={index}><span>{t(index)}</span><div><h3>{t(title)}</h3><p>{t(description)}</p></div></li>)}
          </ol>
          <div className="mechanism-dual-output">
            <p><EvidenceTag tone="mechanism">{t("机制说明")}</EvidenceTag>{t(" 早期整数构造的安全论证依赖对计算")}<strong>{t("中间过程")}</strong>{t("的结构检查，并不是对任意最终答案做一次 Hash 就结束。")}</p>
            <p><strong>{t("准确的 duplex 含义：")}</strong>{t("有用输出 + 一次争块机会。算得越多，通常只是尝试次数可能更多；单次用户请求不保底中块。")}</p>
          </div>
        </div>
      </section>

      <section id="pearl-gemm" className="mechanism-section">
        <div className="mechanism-section-heading"><p className="eyebrow">03 / FLOATING POINT</p><h2>{t("Pearl-GEMM：为什么机制讨论会转向浮点")}</h2></div>
        <div className="mechanism-section-body">
          <p className="mechanism-copy">{t("运营商愿不愿意接入，关键在于两件事：跟我的模型、硬件是否合得来，以及额外开销有多贵。")}</p>
          <div className="mechanism-transition">
            <article><span>EARLIER ROUTE</span><h3>{t("整数 / INT8 路径")}</h3><p>{t("公开叙事中，旧路线对原生浮点模型的兼容性较弱，额外开销也被描述得更高。")}</p></article>
            <div aria-hidden="true">→</div>
            <article><span>NEWER ROUTE</span><h3>Pearl-GEMM / FP8</h3><p>{t("面向更贴近实际推理栈的原生浮点环境；方案、测试网与主网激活仍是不同阶段。")}</p></article>
          </div>
          <p className="mechanism-copy"><EvidenceTag tone="statement">{t("团队表述")}</EvidenceTag>{t(" 团队在 2026 年 9 月前后的公开讨论中，提到面向 Blackwell 等环境的原生浮点路线、约 0–3% 的端到端开销，以及测试网进展。它不是本站实测，也不是第三方独立 benchmark。")}</p>
          <div className="mechanism-checks"><p><EvidenceTag tone="open">{t("待验证")}</EvidenceTag>{t(" 读到性能数字时，固定问这三件事：")}</p><ol>{checklist.map((item, index) => <li key={item}><span>0{t(index + 1)}</span>{t(item)}</li>)}</ol></div>
        </div>
      </section>

      <section id="mechanism-economics" className="mechanism-section">
        <div className="mechanism-section-heading"><p className="eyebrow">04 / THE ECONOMICS</p><h2>{t("机制背后的经济说法")}</h2><p>{t("它和机制绑在一起，但仍是另一层需要独立验证的问题。")}</p></div>
        <div className="mechanism-section-body">
          <div className="mechanism-modes"><article><span>01</span><h3>{t("纯挖矿")}</h3><p>{t("主要为了维护账本与争取区块奖励。")}</p></article><article><span>02</span><h3>{t("纯推理")}</h3><p>{t("主要为了交付模型答案与服务收入。")}</p></article><article><span>03</span><h3>duplex</h3><p>{t("两边同时参与，但通常伴随额外开销。")}</p></article></div>
          <div className="mechanism-economy-flow"><span>{t("硬件、电费与 serving 成本")}</span><i>→</i><span>{t("运营商或以挖矿收益补贴")}</span><i>→</i><strong>{t("是否降价给客户，取决于竞争与定价")}</strong></div>
          <p className="mechanism-copy">{t("这个模型不保证有用算力永远更优，也不保证挖矿收益会自动变成更低的 API 价格。有用需求弱、币价下跌或额外开销变大时，优势都可能被吃掉；即使推理生意好，运营商也未必将收入用于买入 PEARL。")}</p>
          <p className="mechanism-copy"><EvidenceTag tone="open">{t("待验证")}</EvidenceTag>{t(" 用 PEARL 买推理属于产品与支付层里程碑；它与 L1 上能否 duplex 挖矿不是同一天完成的事。Proof-of-Inference 一类能力也更接近 L2 / Rollup 的独立方向。")}</p>
        </div>
      </section>

      <section id="mechanism-engineering" className="mechanism-section">
        <div className="mechanism-section-heading"><p className="eyebrow">05 / ENGINEERING</p><h2>{t("为什么老提 MoE、内核、调度")}</h2></div>
        <div className="mechanism-section-body mechanism-engineering-card">
          <p>{t("机制要在真实服务中站住，GPU 不能大量空转。公开材料里常提到 Mixture-of-Experts、合并小矩阵、减少等待、叠算叠传等；本质是把可参与挖矿的矩阵工作嵌进现有推理栈时，尽量少拖慢主业。")}</p>
          <div><span>IMPLEMENTATION NOTE</span><strong>{t("它们支撑的是“额外开销能否被接受”，并不自动证明经济飞轮已经形成。")}</strong></div>
        </div>
      </section>

      <section id="mechanism-summary" className="mechanism-summary-section">
        <p className="eyebrow">06 / IN FOUR LINES</p>
        <h2>{t("用四句话收束「核心机制」")}</h2>
        <div>{conclusions.map(([label, text], index) => <article key={label}><span>0{t(index + 1)} / {t(label)}</span><p>{t(text)}</p></article>)}</div>
        <p className="mechanism-summary-outro">{t("机制、性能、主网状态与支付结算是四份不同的答卷。将它们分开阅读，才能既看见 Pearl 的命题，也看见它尚待验证的边界。")}</p>
      </section>
    </article>
  </main>;
}
