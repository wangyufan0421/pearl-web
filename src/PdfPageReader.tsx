import { useLanguage } from "./i18n/Language";
import { useEffect, useRef, useState } from "react";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

type ReaderStatus = "loading" | "ready" | "failed";

export function PdfPageReader({ src }: { src: string }) {
  const { t, href: localizeHref, language } = useLanguage();
  const pagesRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<ReaderStatus>("loading");
  const [pageCount, setPageCount] = useState<number | null>(null);

  useEffect(() => {
    setStatus("loading");
    setPageCount(null);
    pagesRef.current?.replaceChildren();
    let cancelled = false;
    let destroyLoadingTask: (() => Promise<void>) | undefined;

    const renderDocument = async () => {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        if (cancelled) return;
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        const loadingTask = pdfjs.getDocument({ url: src });
        destroyLoadingTask = () => loadingTask.destroy();
        const pdf = await loadingTask.promise;
        if (cancelled || !pagesRef.current) return;

        setPageCount(pdf.numPages);
        const fragment = document.createDocumentFragment();
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 1.55 });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d", { alpha: false });
          if (!context) throw new Error("Canvas 2D context is unavailable");

          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          canvas.setAttribute("aria-label", language === "en" ? `Whitepaper page ${pageNumber}` : `白皮书第 ${pageNumber} 页`);
          const sheet = document.createElement("figure");
          sheet.className = "pdf-page-sheet";
          sheet.append(canvas);
          fragment.append(sheet);
          await page.render({ canvas, canvasContext: context, viewport }).promise;
          if (cancelled) return;
        }

        if (!cancelled && pagesRef.current) {
          pagesRef.current.replaceChildren(fragment);
          setStatus("ready");
        }
      } catch {
        if (!cancelled) setStatus("failed");
      }
    };

    void renderDocument();
    return () => {
      cancelled = true;
      void destroyLoadingTask?.();
    };
  }, [src, language]);

  return <div className="pdf-page-reader" data-testid="pdf-page-reader" role="region" aria-label={t("可滚动的白皮书阅读器")} tabIndex={0}>
    <p className="pdf-reader-status" aria-live="polite">
      {t(status === "loading" && "PDF 正在载入…")}
      {t(status === "ready" && `${pageCount} 页原始 PDF`)}
      {t(status === "failed" && "站内阅读器暂时无法载入，请在新窗口打开原文。")}
    </p>
    <div className="pdf-pages" ref={pagesRef} aria-label={t("Pearl 白皮书页面")} />
  </div>;
}
