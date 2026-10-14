import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../i18n/Language";
import type { AdminDiscussionCard, DiscussionAction } from "../data/communityAdmin";
export function AdminDiscussionDialog({ card, action, busy, onCancel, onConfirm }: { card: AdminDiscussionCard; action: DiscussionAction; busy: boolean; onCancel: () => void; onConfirm: (confirmation?: string) => void }) {
  const { t } = useLanguage(); const [confirmation, setConfirmation] = useState(""); const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialog.current!; if (element.showModal) element.showModal(); else element.setAttribute("open", ""); return () => { element.close?.(); }; }, []);
  const label = action === "delete" ? "确认彻底删除" : action === "hide" ? "确认隐藏" : "确认恢复";
  return <dialog className="admin-panel admin-action-dialog" ref={dialog} aria-labelledby="admin-action-title" onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
    <h2 id="admin-action-title">{t(label)}</h2><p className="admin-dialog-title">{card.title}</p>
    <p>{t(action === "delete" ? "将彻底删除主题帖、所有回应和译文，无法恢复。" : action === "hide" ? "隐藏后公众无法查看，主题帖、回应和译文会保留，可随时恢复。" : "恢复后主题帖与回应将重新公开。")}</p>
    {action === "delete" && <label>{t("输入讨论地址标识以确认")}<input aria-label={t("输入讨论地址标识以确认")} autoComplete="off" value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} /><span className="admin-help">{card.slug}</span></label>}
    <div className="admin-card-actions"><button type="button" onClick={onCancel} disabled={busy}>{t("取消")}</button><button type="button" className={action === "delete" ? "admin-danger" : ""} disabled={busy || (action === "delete" && confirmation !== card.slug)} onClick={() => onConfirm(action === "delete" ? confirmation : undefined)}>{t(busy ? "正在处理…" : label)}</button></div>
  </dialog>;
}
