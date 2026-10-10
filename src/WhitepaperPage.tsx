import { ArchiveNavigation } from "./ArchiveNavigation";
import { PdfPageReader } from "./PdfPageReader";

const documentUrl = "/documents/pearl-whitepaper.pdf";

export default function WhitepaperPage() {
  return <main className="site-shell whitepaper-page">
    <header className="topbar">
      <a className="brand" href="/">Pearl <span>中文社区</span></a>
      <nav aria-label="主导航">
        <a href="/overview">数据概览</a><a href="/chain">链上数据</a><a href="/valuation">数据汇总</a><ArchiveNavigation current />
      </nav>
    </header>

    <section className="whitepaper-hero" aria-labelledby="whitepaper-title">
      <div>
        <p className="eyebrow">PRIMARY RECORD / 02</p>
        <h1 id="whitepaper-title">Pearl 白皮书</h1>
        <div className="whitepaper-actions"><a href="#whitepaper-reader">开始阅读 <span>↓</span></a><a href={documentUrl} target="_blank" rel="noreferrer">在新窗口打开原文 <span>↗</span></a></div>
      </div>
      <aside className="whitepaper-file-card" aria-label="白皮书文件信息">
        <span>DOCUMENT</span><b>PEARL WHITEPAPER</b>
        <dl><div><dt>格式</dt><dd>PDF</dd></div><div><dt>页数</dt><dd>11</dd></div><div><dt>阅读方式</dt><dd>原始文件</dd></div></dl>
        <p>本站不改写或重排原文；嵌入区展示你提供的 PDF 文件。</p>
      </aside>
    </section>

    <section className="whitepaper-layout" id="whitepaper-reader">
      <aside className="whitepaper-rail">
        <p className="eyebrow">TABLE OF CONTENTS</p>
        <a href="#whitepaper-reader">原始白皮书</a>
        <a href="/archive/core-mechanism">核心机制解读 <span>↗</span></a>
        <a href="/overview">数据概览 <span>↗</span></a>
        <a href={documentUrl} target="_blank" rel="noreferrer">下载 / 新窗口 <span>↗</span></a>
        <p className="whitepaper-rail-note">阅读器加载失败时，请使用“在新窗口打开原文”。</p>
      </aside>
      <div className="whitepaper-reader-shell">
        <header><div><p className="eyebrow">ORIGINAL FILE</p><h2>Pearl INT 白皮书</h2></div><a href={documentUrl} target="_blank" rel="noreferrer" aria-label="在新窗口打开原文">↗</a></header>
        <PdfPageReader src={documentUrl} />
      </div>
    </section>
  </main>;
}
