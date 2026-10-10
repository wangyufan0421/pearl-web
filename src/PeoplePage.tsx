import { ArchiveNavigation } from "./ArchiveNavigation";

type PublicPerson = { name: string; role: string; focus: string; note: string; href: string };
type Connection = { title: string; label: string; proves: string; doesNotProve: string; href: string };

const publicPeople: PublicPerson[] = [
  { name: "Omri Weinstein", role: "公开具名创始人 · CEO", focus: "算法与计算效率", note: "公开学术与职业记录聚焦计算复杂性、数据结构、优化与 AI 基础设施。", href: "https://pearlified.com/team" },
  { name: "Ilan Komargodski", role: "公开具名创始人 · 联合创始人", focus: "密码学与 PoUW 研究", note: "公开研究记录覆盖密码学证明、私密计算与分布式协议。", href: "https://pearlified.com/team" },
  { name: "Idan Sugarman", role: "公开具名创始人 · 联合创始人", focus: "风险投资与公司建设", note: "公开记录将其背景与 Zero Knowledge Ventures、QuantHealth 等经历相连。", href: "https://pearlified.com/team" },
  { name: "Rafael Pass", role: "公开点名的研究关联人", focus: "共识与有用工作量证明", note: "团队公开材料将其列为研究人员之一；其研究与 Simplex、PoUW 经济学等主题存在关联。", href: "https://pearlified.com/team" },
];

const anonymousRoles = [
  "协议设计", "ZK / 可验证计算", "GPU Kernel", "挖矿系统", "基础设施", "节点与客户端", "钱包", "CUDA", "ML 工程", "推理优化", "MoE", "密码学研究", "共识与 PoUW", "量化与编译", "安全与审计",
];

const connections: Connection[] = [
  { title: "研究谱系", label: "作者列表 / 公开履历", proves: "公开履历和论文可核对 Ilan 与 Moni Naor、Rafael Pass、Elaine Shi，以及与 Yogev Bar-On 的学术脉络。", doesNotProve: "学术关系不等于雇佣、投资、产品部署或商业合作。", href: "https://pearlified.com/team" },
  { title: "NVIDIA 相关公开记录", label: "职业记录 / 公开项目", proves: "公开履历中存在 Omri 的 NVIDIA Research 经历与 Pearl 对 GPU kernel、Blackwell 等计算环境的公开讨论。", doesNotProve: "这不能证明 NVIDIA 对 Pearl 的投资、联合交付或未公开商业协议。", href: "https://pearlified.com/suspects" },
  { title: "Attestable 公开合作", label: "公开宣布", proves: "Pearl 曾公开宣布与 Attestable 围绕 ZK 与 PoUW 的合作叙事。", doesNotProve: "公开合作表述不等于全部产品已部署，也不自动证明客户采用规模。", href: "https://pearlified.com/signal" },
  { title: "架构澄清：L1 与 L2", label: "团队声明", proves: "团队材料将 L1 挖矿、Proof-of-Inference 与 L2 / Rollup 的发展方向区分讨论。", doesNotProve: "架构口述与路线图不等于相应支付、结算或整模证明能力已经交付。", href: "https://pearlified.com/pearl-explained" },
  { title: "RPC 主机名线索", label: "基础设施观察", proves: "公开探测记录中出现以 Anchorage、Coinbase 命名的 pearlresearch.ai RPC 主机名。", doesNotProve: "主机名不能单独证明托管支持、上币、商业协议、资金通道或机构产品已经上线。", href: "https://pearlified.com/suspects" },
];

const speculationCategories = ["推理 / 算力提供商", "芯片与硬件", "封闭实验室 / 应用侧", "机构轨道", "产品叙事与落地"];

export default function PeoplePage() {
  return <main className="site-shell people-page">
    <header className="topbar">
      <a className="brand" href="/">Pearl <span>中文社区</span></a>
      <nav aria-label="主导航"><a href="/overview">数据概览</a><a href="/chain">链上数据</a><a href="/valuation">数据汇总</a><ArchiveNavigation current /></nav>
    </header>

    <section className="people-hero" aria-labelledby="people-title">
      <div>
        <p className="eyebrow">IDENTITY FILE / 05</p>
        <h1 id="people-title">Pearl人物与关系</h1>
        <p>从公开人物、研究脉络与基础设施线索出发的证据地图；它不是组织架构图，也不是商业关系的猜测清单。</p>
      </div>
      <aside className="reading-principles" aria-label="阅读原则">
        <p>READING PRINCIPLES</p>
        <strong>先读记录，再读推断。</strong>
        <ul><li>履历与论文说明能力和研究关联，不证明交付进度或客户采用。</li><li>公开主机名与代码归属是线索，不是权限、人数或商业协议。</li><li>未具名贡献者与合作方，不以推测替代事实。</li></ul>
      </aside>
    </section>

    <section className="people-brief" aria-label="证据范围">
      <article><span>01 / 事实</span><p>公开身份、作者署名、官方声明与可复核的基础设施记录。</p></article>
      <article><span>02 / 能力地图</span><p>公开代码和论文能显示的贡献领域；不据此还原花名册。</p></article>
      <article><span>03 / 推测</span><p>编辑性推断单列展示，且不与事实、合作记录混排。</p></article>
    </section>

    <section className="people-section people-facts" aria-labelledby="people-facts-title">
      <header><p className="eyebrow">01 / PUBLIC RECORD</p><h2 id="people-facts-title">团队与公开研究关联</h2><p>角色来自归档材料与可公开核对的外部记录；它们描述背景，不判断项目交付结果。</p></header>
      <div className="public-people-grid">
        {publicPeople.map((person) => <article data-testid="public-person-card" key={person.name}>
          <span>{person.role}</span><h3>{person.name}</h3><b>{person.focus}</b><p>{person.note}</p><a href={person.href} target="_blank" rel="noreferrer">查看公开记录 <i aria-hidden="true">↗</i></a>
        </article>)}
      </div>
    </section>

    <section className="people-section role-map" aria-labelledby="role-map-title">
      <header><p className="eyebrow">02 / NO ROSTER</p><h2 id="role-map-title">匿名工程能力地图</h2><p>基于公开 GitHub、提交元数据与论文中可观察到的工作领域。以下是角色线索，不对应姓名，也不构成完整组织图。</p></header>
      <div className="role-map-layout">
        <div className="role-map-core"><span>CONTRIBUTION MAP</span><strong>能力可见，身份保留。</strong><p>CODEOWNERS 可以指向审阅路由；它不披露发布权限、密钥、网络运营者或员工人数。</p></div>
        <div className="role-chip-grid">{anonymousRoles.map((role, index) => <span data-testid="anonymous-role" key={role}><i>{String(index + 1).padStart(2, "0")}</i>{role}</span>)}</div>
      </div>
    </section>

    <section className="people-section connection-records" aria-labelledby="connection-title">
      <header><p className="eyebrow">03 / RELATIONSHIP RECORD</p><h2 id="connection-title">公开合作记录</h2><p>每一条都把记录能支持的结论与不能支持的外推并列呈现。</p></header>
      <div className="connection-grid">{connections.map((connection, index) => <article key={connection.title}>
        <div className="connection-number">0{index + 1}</div><span>{connection.label}</span><h3>{connection.title}</h3>
        <div className="evidence-columns"><div><b>证明到哪</b><p>{connection.proves}</p></div><div><b>证不到哪</b><p>{connection.doesNotProve}</p></div></div>
        <a href={connection.href} target="_blank" rel="noreferrer">查看记录 <i aria-hidden="true">↗</i></a>
      </article>)}</div>
    </section>

    <section className="people-section speculation-board" aria-labelledby="speculation-title">
      <header><p className="eyebrow">04 / OPEN SPECULATION</p><h2 id="speculation-title">合作方推测板</h2><p>此处只放带日期与来源的历史编辑推测。它不是内部消息、已签约名单或可合成的概率预测。</p></header>
      <div className="speculation-grid">{speculationCategories.map((category, index) => <article key={category}><span>CASE {String(index + 1).padStart(2, "0")}</span><h3>{category}</h3><p>等待补入经编辑确认、可回溯来源的候选与判断依据。</p><b>未录入具体对象或赔率</b></article>)}</div>
      <p className="speculation-note">在来源、观察时间与证据边界补齐之前，本站不会把适配性描述写成“正在洽谈”，也不会把基础设施命名写成已完成商业合作。</p>
    </section>
  </main>;
}
