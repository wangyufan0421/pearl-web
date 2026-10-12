import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PdfPageReader } from "./PdfPageReader";

const { getDocument } = vi.hoisted(() => ({ getDocument: vi.fn() }));
vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({ getDocument, GlobalWorkerOptions: {} }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); getDocument.mockReset(); window.history.replaceState({}, "", "/"); });

describe("whitepaper language changes", () => {
  it("clears the old-language PDF while the new document loads and if it fails", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as CanvasRenderingContext2D);
    let rejectNew!: (error: Error) => void;
    getDocument.mockReturnValueOnce({ promise: Promise.resolve({ numPages: 1, getPage: async () => ({ getViewport: () => ({ width: 100, height: 200 }), render: () => ({ promise: Promise.resolve() }) }) }), destroy: vi.fn().mockResolvedValue(undefined) });
    getDocument.mockReturnValueOnce({ promise: new Promise((_, reject) => { rejectNew = reject; }), destroy: vi.fn().mockResolvedValue(undefined) });
    const view = render(<PdfPageReader src="/documents/chinese.pdf" />);
    await screen.findByText("1 页原始 PDF");
    expect(document.querySelectorAll(".pdf-page-sheet canvas")).toHaveLength(1);
    window.history.replaceState({}, "", "/en/archive/whitepaper");
    view.rerender(<PdfPageReader src="/documents/english.pdf" />);
    expect(screen.getByText("Loading PDF…")).toBeInTheDocument();
    expect(document.querySelectorAll(".pdf-page-sheet canvas")).toHaveLength(0);
    await waitFor(() => expect(getDocument).toHaveBeenCalledTimes(2));
    await act(async () => { rejectNew(new Error("unavailable")); });
    expect(screen.getByText("The reader could not load. Please open the original in a new tab.")).toBeInTheDocument();
    expect(document.querySelectorAll(".pdf-page-sheet canvas")).toHaveLength(0);
  });
});
