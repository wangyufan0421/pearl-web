import { useState } from "react";
import { useLanguage } from "./i18n/Language";
import { originalXUrl } from "./data/communityDiscussion";

type Identity = { url: string; xStatusId: string; author: string | null; handle: string | null; avatarUrl: string | null };
function account(source: Identity) {
  const fetched = source.handle?.replace(/^@/, "").trim();
  if (fetched && /^[a-zA-Z0-9_]{1,15}$/.test(fetched)) return fetched;
  const url = originalXUrl(source.url);
  if (!url) return null;
  const fromUrl = new URL(url).pathname.split("/")[1];
  return /^[a-zA-Z0-9_]{1,15}$/.test(fromUrl) && fromUrl.toLowerCase() !== "i" ? fromUrl : null;
}
export function CommunityAvatar({ source, className = "community-dialogue-avatar" }: { source: Identity; className?: string }) {
  const { t } = useLanguage(); const [failed, setFailed] = useState<string | null>(null);
  const handle = account(source); const author = source.author ?? (handle ? `@${handle}` : t("作者未提供"));
  const image = source.avatarUrl?.startsWith("https://") && source.avatarUrl !== failed ? source.avatarUrl : null;
  return image ? <img className={className} src={image} alt={author} referrerPolicy="no-referrer" onError={() => setFailed(image)} /> : <span className={`${className} community-avatar-placeholder`} aria-hidden="true">{(handle ?? author).slice(0, 1).toUpperCase()}</span>;
}
export function CommunityAuthorInfo({ source }: { source: Identity }) {
  const { t } = useLanguage(); const handle = account(source);
  return <><strong>{source.author ?? (handle ? `@${handle}` : t("作者未提供"))}</strong>{handle ? <a className="community-user-id" href={`https://x.com/${handle}`} target="_blank" rel="noreferrer">@{handle}</a> : <small>{t("账号未提供")} · {t("原帖 ID：")}{source.xStatusId}</small>}</>;
}
