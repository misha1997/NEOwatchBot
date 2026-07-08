// Feedback modal: footer "Зворотній зв'язок" opens this form. On submit it
// POSTs to /api/feedback, which forwards the message to the owner's Telegram
// chat via the bot. Renders nothing when closed (parent controls open).
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { sendFeedback } from "../lib/api";

export default function FeedbackModal({ open, onClose }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | success | error
  const [errKey, setErrKey] = useState("fbErrSend");
  const firstField = useRef(null);

  // Esc closes, and focus the first field on open. Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => firstField.current && firstField.current.focus(), 60);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;

  async function submit(e) {
    e.preventDefault();
    if (!message.trim()) { setErrKey("fbErrEmpty"); setStatus("error"); return; }
    setStatus("sending");
    try {
      await sendFeedback({ name: name.trim(), email: email.trim(), message: message.trim() });
      setStatus("success");
    } catch (err) {
      setErrKey(err && err.status === 503 ? "fbErrUnavail" : "fbErrSend");
      setStatus("error");
    }
  }

  function close() {
    // Reset on close so reopening starts fresh.
    setStatus("idle");
    setName(""); setEmail(""); setMessage("");
    onClose();
  }

  const sending = status === "sending";

  return (
    <div className="fb-overlay" role="dialog" aria-modal="true" aria-label={t("footer.fbTitle")} onMouseDown={close}>
      <div className="fb-card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="fb-head">
          <div className="fb-ic" aria-hidden="true">✉</div>
          <div className="fb-titles">
            <div className="fb-title">{t("footer.fbTitle")}</div>
            <div className="fb-sub">{t("footer.fbSub")}</div>
          </div>
          <button className="fb-close" onClick={close} aria-label={t("footer.fbClose")}>×</button>
        </div>

        {status === "success" ? (
          <div className="fb-success">
            <div className="fb-ok" aria-hidden="true">✓</div>
            <p>{t("footer.fbSuccess")}</p>
            <button className="btn primary fb-done" onClick={close}>{t("footer.fbClose")}</button>
          </div>
        ) : (
          <form className="fb-form" onSubmit={submit}>
            <label className="fb-field">
              <span className="fb-label">{t("footer.fbName")}</span>
              <input
                ref={firstField}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("footer.fbNamePh")}
                maxLength={120}
                autoComplete="name"
              />
            </label>
            <label className="fb-field">
              <span className="fb-label">{t("footer.fbEmail")}</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("footer.fbEmailPh")}
                maxLength={200}
                autoComplete="email"
              />
            </label>
            <label className="fb-field">
              <span className="fb-label">{t("footer.fbMessage")}</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("footer.fbMessagePh")}
                maxLength={5000}
                rows={5}
                required
              />
            </label>

            {status === "error" && <p className="fb-err">{t("footer." + errKey)}</p>}

            <button type="submit" className="btn primary fb-submit" disabled={sending}>
              {sending ? t("footer.fbSending") : t("footer.fbSend")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}