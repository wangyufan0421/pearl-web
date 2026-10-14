import type { SourceBlock } from "../discussions/types.js";

export function isEnglishBlock(block: SourceBlock) {
  const text = block.text.replace(/https?:\/\/\S+/g, "");
  const latin = (text.match(/[a-zA-Z]/g) ?? []).length;
  const han = (text.match(/[\u3400-\u9fff]/g) ?? []).length;
  return latin >= 2 && latin > han * 2;
}
export function needsChineseTranslation(blocks: SourceBlock[]) {
  return blocks.some(block => isEnglishBlock(block) && !block.translationZh?.trim());
}
export function hasCompleteChineseTranslation(blocks: SourceBlock[]) {
  return blocks.some(block => Boolean(block.translationZh)) && !needsChineseTranslation(blocks);
}
export function chineseSummary(blocks: SourceBlock[]): string | null {
  return blocks.find(block => block.translationZh?.trim())?.translationZh?.replace(/\s+/g, " ").slice(0, 200) ?? null;
}
