import { useLanguage } from "./i18n/Language";
import { SiteHeader } from "./SiteHeader";
import { PdfPageReader } from "./PdfPageReader";

export default function WhitepaperPage() {
  const { t, href: localizeHref, language } = useLanguage();
  const documentUrl = language === "en" ? "/documents/pearl-whitepaper-en.pdf" : "/documents/pearl-whitepaper.pdf";
  return <main className="site-shell whitepaper-page">
    <SiteHeader />

    <section className="whitepaper-hero" aria-labelledby="whitepaper-title">
      <div>
        <p className="eyebrow">PRIMARY RECORD / 02</p>
        <h1 id="whitepaper-title">{t("Pearl 白皮书")}</h1>
        <div className="whitepaper-actions"><a href={localizeHref("#whitepaper-reader")}>{t("开始阅读 ")}<span>↓</span></a><a href={localizeHref(documentUrl)} target="_blank" rel="noreferrer">{t("在新窗口打开原文 ")}<span>↗</span></a></div>
      </div>
      <aside className="whitepaper-file-card" aria-label={t("白皮书文件信息")}>
        <span>DOCUMENT</span><b>PEARL WHITEPAPER</b>
        <dl><div><dt>{t("格式")}</dt><dd>PDF</dd></div><div><dt>{t("阅读方式")}</dt><dd>{t("原始文件")}</dd></div></dl>
        <p>{t("本站不改写或重排原文；嵌入区展示你提供的 PDF 文件。")}</p>
        {language === "en" && <a className="whitepaper-original-source" href="https://pearlresearch.ai/research/int-whitepaper" target="_blank" rel="noreferrer">Official English source ↗</a>}
      </aside>
    </section>

    <section className="whitepaper-layout" id="whitepaper-reader">
      <aside className="whitepaper-rail">
        <p className="eyebrow">TABLE OF CONTENTS</p>
        <a href={localizeHref("#whitepaper-reader")}>{t("原始白皮书")}</a>
        <a href={localizeHref("/archive/core-mechanism")}>{t("核心机制解读 ")}<span>↗</span></a>
        <a href={localizeHref("/overview")}>{t("数据概览 ")}<span>↗</span></a>
        <a href={localizeHref(documentUrl)} target="_blank" rel="noreferrer">{t("下载 / 新窗口 ")}<span>↗</span></a>
        <p className="whitepaper-rail-note">{t("阅读器加载失败时，请使用“在新窗口打开原文”。")}</p>
      </aside>
      <div className="whitepaper-reader-shell">
        <header><div><p className="eyebrow">ORIGINAL FILE</p><h2>{t("Pearl INT 白皮书")}</h2></div><a href={localizeHref(documentUrl)} target="_blank" rel="noreferrer" aria-label={t("在新窗口打开原文")}>↗</a></header>
        <PdfPageReader src={documentUrl} />
      </div>
    </section>
  </main>;
}
