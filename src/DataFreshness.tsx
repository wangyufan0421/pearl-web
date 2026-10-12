import type { DataResult } from "./data/prlstats";
import { formatLocale, useLanguage } from "./i18n/Language";

export function DataFreshness({ result }: { result: DataResult<unknown> | null | undefined }) {
  const { t } = useLanguage();
  if (!result || result.sourceKind !== "live") return null;
  return <p className="fineprint" aria-live="polite">{t("数据采集时间：")}<time dateTime={result.fetchedAt.toISOString()}>{result.fetchedAt.toLocaleString(formatLocale())}</time>{result.stale ? <> · {t("暂用上次成功数据，后台正在更新")}</> : null}</p>;
}
