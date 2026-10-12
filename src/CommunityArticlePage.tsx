import { Fragment, useEffect, useState } from "react";
import { ArchiveNavigation } from "./ArchiveNavigation";
import { getCommunityDiscussion, type CommunitySource, type CommunitySourceBlock } from "./data/communityDiscussion";

type SourceMeta = Omit<CommunitySource, "blocks">;

const primarySource: SourceMeta = {
  sourceId: "2108519545514410023",
  author: "blocmates.",
  handle: "@blocmates",
  avatar: "https://pbs.twimg.com/profile_images/2016157466698944513/a7EkPcJa_normal.jpg",
  href: "https://x.com/blocmates/status/2108519545514410023?s=20",
};

const theoristSource: SourceMeta = {
  sourceId: "2108528311735607793",
  author: "theoristalgo ™️ | ⓝ",
  handle: "@theoristalgo",
  avatar: "https://pbs.twimg.com/profile_images/2101042430699036672/LI50ARk1_normal.jpg",
  href: "https://x.com/theoristalgo/status/2108528311735607793",
};

const tokugawaSource: SourceMeta = {
  sourceId: "2108568857317118362",
  author: "Tokugawa The Gem General",
  handle: "@tokugawasuprema",
  avatar: "https://pbs.twimg.com/profile_images/2048184515663699968/uHZMFwRb_normal.jpg",
  href: "https://x.com/tokugawasuprema/status/2108568857317118362",
};

const debateSource: SourceMeta = {
  sourceId: "2108579196268077447",
  author: "Tulip King 🌷",
  handle: "@tulipking",
  avatar: "https://pbs.twimg.com/profile_images/2062216238223265793/WY21HCO0_normal.jpg",
  href: "https://x.com/tulipking/status/2108579196268077447?s=20",
};

const kiwiSource: SourceMeta = {
  sourceId: "2108928836780065031",
  author: "Kiwibig.eth",
  handle: "@KiwiCryptoBig",
  avatar: "https://pbs.twimg.com/profile_images/1721392814045667328/9uORlqSW_normal.jpg",
  href: "https://x.com/KiwiCryptoBig/status/2108928836780065031",
};

const dialogueEntries: Array<{ source: SourceMeta; side: "left" | "right"; label: string }> = [
  { source: primarySource, side: "left", label: "原文章" },
  { source: theoristSource, side: "right", label: "社区回应 / 01" },
  { source: tokugawaSource, side: "left", label: "社区回应 / 02" },
  { source: debateSource, side: "right", label: "社区回应 / 03" },
  { source: kiwiSource, side: "left", label: "社区回应 / 04" },
];

type ReaderState =
  | { status: "loading"; sources: CommunitySource[] }
  | { status: "ready"; sources: CommunitySource[] }
  | { status: "error"; sources: CommunitySource[] };

function useDiscussionReader() {
  const [state, setState] = useState<ReaderState>({ status: "loading", sources: [] });

  useEffect(() => {
    let active = true;
    void getCommunityDiscussion("wtf-is-pearl").then(
      (discussion) => { if (active) setState({ status: "ready", sources: discussion.sources }); },
      () => { if (active) setState({ status: "error", sources: [] }); },
    );
    return () => { active = false; };
  }, []);

  return state;
}

function SourceText({ blocks }: { blocks: CommunitySourceBlock[] }) {
  return <div className="community-source-body">
    {blocks.map((block) => {
      if (block.kind === "heading") return <h2 key={block.id}>{block.text}</h2>;
      if (block.kind === "quote") return <blockquote key={block.id}>{block.text}</blockquote>;
      return <p key={block.id}>{block.text}</p>;
    })}
  </div>;
}

function DialogueMessage({ source, side, label, state }: { source: SourceMeta; side: "left" | "right"; label: string; state: ReaderState }) {
  const liveSource = state.sources.find((candidate) => candidate.sourceId === source.sourceId);
  const resolvedSource = liveSource ?? source;

  return <article className={`community-dialogue-message community-dialogue-${side}`} data-testid={`community-dialogue-${side}`}>
    {side === "left" && <img className="community-dialogue-avatar" src={resolvedSource.avatar} alt={`${resolvedSource.author} 的头像`} />}
    <div className="community-dialogue-bubble">
      <header><span>{label}</span><strong>{resolvedSource.author}</strong><small>{resolvedSource.handle}</small></header>
      <div className="community-dialogue-scroll" aria-live="polite">
        {state.status === "loading" && <p className="community-source-status">正在读取完整原文…</p>}
        {state.status === "ready" && liveSource && <SourceText blocks={liveSource.blocks} />}
        {state.status === "error" && <p className="community-source-status">完整正文暂时不可用，请通过下方来源链接查看原文。</p>}
      </div>
      <a href={resolvedSource.href} target="_blank" rel="noreferrer">在 X 查看原文 <span aria-hidden="true">↗</span></a>
    </div>
    {side === "right" && <img className="community-dialogue-avatar" src={resolvedSource.avatar} alt={`${resolvedSource.author} 的头像`} />}
  </article>;
}

export default function CommunityArticlePage() {
  const state = useDiscussionReader();

  return <main className="site-shell community-article-page">
    <header className="topbar">
      <a className="brand" href="/">Pearl <span>中文社区</span></a>
      <nav aria-label="主导航"><a href="/overview">数据概览</a><a href="/chain">链上数据</a><a href="/valuation">数据汇总</a><ArchiveNavigation current /></nav>
    </header>

    <section className="community-article-hero" aria-labelledby="article-title">
      <p className="eyebrow">COMMUNITY ARTICLE / 01</p>
      <h1 id="article-title">WTF Is Pearl?</h1>
      <p>原文章与围绕它展开的社区回应，按发布时间顺序收录。完整正文由云端来源读取，并可在框内滚动查看。</p>
      <div><a href="/archive/community-discussion">返回社区讨论 <span aria-hidden="true">←</span></a></div>
    </section>

    <section className="community-dialogue" aria-label="WTF Is Pearl? 文章与辩论">
      {dialogueEntries.map((entry, index) => <Fragment key={entry.source.sourceId}>
        {index > 0 && <div className="community-dialogue-divider" aria-hidden="true"><span>RESPONSE {String(index).padStart(2, "0")}</span></div>}
        <DialogueMessage {...entry} state={state} />
      </Fragment>)}
    </section>
  </main>;
}
