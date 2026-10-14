import type { SourceBlock } from "../discussions/types.js";
import { isEnglishBlock, needsChineseTranslation } from "./content.js";

export type TranslationSource = { id: string; fetchedAt: string; blocks: SourceBlock[] };
export type TranslationStore = { list(): Promise<TranslationSource[]>; save(id: string, fetchedAt: string, blocks: SourceBlock[]): Promise<boolean> };
type Options = { store: TranslationStore; translate(blocks: SourceBlock[], signal?: AbortSignal): Promise<SourceBlock[]>; now?: () => number; onResult?: (id: string, ok: boolean) => void };
export function createTranslationQueue({ store, translate, now = Date.now, onResult }: Options) {
  let inFlight: Promise<void> | undefined; let stopped = false; let timer: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();
  const failures = new Map<string, { until: number; attempts: number }>();
  function tick() {
    if (stopped) return Promise.resolve(); if (inFlight) return inFlight;
    inFlight = (async () => {
      const sources = await store.list();
      for (const source of sources) {
        if (stopped) break;
        const key = `${source.id}:${source.fetchedAt}`;
        if (!needsChineseTranslation(source.blocks) || (failures.get(key)?.until ?? 0) > now()) continue;
        let blocks = source.blocks;
        try {
          while (needsChineseTranslation(blocks) && !stopped) {
            const indices: number[] = []; let size = 0;
            for (const [index, block] of blocks.entries()) {
              if (!isEnglishBlock(block) || block.translationZh?.trim()) continue;
              if (indices.length && (indices.length >= 20 || size + block.text.length > 6000)) break;
              indices.push(index); size += block.text.length;
            }
            const translated = await translate(indices.map(index => blocks[index]), controller.signal);
            if (stopped) break;
            const next = blocks.map((block, index) => { const position = indices.indexOf(index); return position < 0 ? block : translated[position]; });
            if (!await store.save(source.id, source.fetchedAt, next)) break;
            blocks = next; onResult?.(source.id, true);
          }
          failures.delete(key);
        } catch {
          const attempts = (failures.get(key)?.attempts ?? 0) + 1;
          failures.set(key, { attempts, until: now() + Math.min(600_000, 60_000 * 2 ** (attempts - 1)) });
          onResult?.(source.id, false);
        }
      }
    })().catch(() => { onResult?.("storage", false); }).finally(() => { inFlight = undefined; });
    return inFlight;
  }
  return {
    tick,
    start() { if (timer || stopped) return; const cycle = () => { void tick().finally(() => { if (!stopped) timer = setTimeout(cycle, 20_000); }); }; cycle(); },
    stop() { stopped = true; if (timer) clearTimeout(timer); controller.abort(); },
  };
}
