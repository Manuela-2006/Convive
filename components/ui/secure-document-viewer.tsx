"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";

import type { ActionResult } from "../../app/backend/endpoints/shared/action-result";
import styles from "./secure-document-viewer.module.css";

type SecureDocumentViewerProps = {
  label: string;
  title: string;
  buttonClassName?: string;
  documentAvailable?: boolean;
  documentType?: "image" | "pdf";
  disabled?: boolean;
  emptyMessage: string;
  loadSignedUrl: () => Promise<ActionResult<{ signedUrl: string }>>;
};

export function SecureDocumentViewer({
  label,
  title,
  buttonClassName,
  documentAvailable = true,
  documentType = "image",
  disabled = false,
  emptyMessage,
  loadSignedUrl,
}: SecureDocumentViewerProps) {
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const openDocument = () => {
    if (disabled || isPending) {
      return;
    }

    setErrorMessage(null);

    if (!documentAvailable) {
      setSignedUrl(null);
      setIsOpen(true);
      return;
    }

    startTransition(async () => {
      const result = await loadSignedUrl();

      if (result.success) {
        setSignedUrl(result.data.signedUrl);
        setIsOpen(true);
        return;
      }

      if ("error" in result) {
        setSignedUrl(null);
        setErrorMessage(result.error);
        setIsOpen(true);
      }
    });
  };

  const closeDocument = () => {
    setIsOpen(false);
    setSignedUrl(null);
    setErrorMessage(null);
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDocument();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const modal = isOpen ? (
    <div className={styles.overlay} role="presentation" onClick={closeDocument}>
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <button
            type="button"
            className={styles.backButton}
            onClick={closeDocument}
            aria-label="Cerrar"
          >
            <span aria-hidden="true" className={styles.backIcon} />
          </button>
          <h2 className={styles.title}>{title}</h2>
        </header>
        {signedUrl && documentType === "pdf" ? (
          <div className={styles.documentWrap}>
            <iframe src={signedUrl} title={title} className={styles.documentFrame} />
          </div>
        ) : signedUrl ? (
          <div className={styles.imageWrap}>
            <img src={signedUrl} alt={title} className={styles.image} />
          </div>
        ) : (
          <div className={styles.emptyWrap}>
            <p className={styles.emptyMessage}>{errorMessage ?? emptyMessage}</p>
          </div>
        )}
      </section>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        className={buttonClassName}
        onClick={openDocument}
        disabled={disabled || isPending}
      >
        {isPending ? "Abriendo..." : label}
      </button>

      {modal ? createPortal(modal, document.body) : null}
    </>
  );
}
