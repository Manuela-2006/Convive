"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";

import { getSharedExpenseSplitAction } from "../../app/backend/endpoints/gastos/actions";
import type { ExpenseSplitDetail } from "../../lib/dashboard-types";
import { formatCurrency, formatShortDate } from "../../lib/dashboard-presenters";
import { ProfileAvatar } from "../ui/profile-avatar";
import styles from "./expense-split-dialog.module.css";

type ExpenseSplitDialogProps = {
  houseCode: string;
  expenseId: string;
  buttonClassName?: string;
};

function formatParticipantStatus(status: string | null) {
  if (status === "paid") return "Pagado";
  if (status === "waived") return "Exento";
  return "Pendiente";
}

export function ExpenseSplitDialog({
  houseCode,
  expenseId,
  buttonClassName,
}: ExpenseSplitDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [split, setSplit] = useState<ExpenseSplitDetail | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const openDialog = () => {
    if (isPending) return;

    setErrorMessage(null);
    startTransition(async () => {
      const result = await getSharedExpenseSplitAction({ houseCode, expenseId });

      if (result.success) {
        setSplit(result.data.split);
        setIsOpen(true);
        return;
      }

      if ("error" in result) {
        setSplit(null);
        setErrorMessage(result.error);
        setIsOpen(true);
      }
    });
  };

  const closeDialog = () => {
    setIsOpen(false);
    setErrorMessage(null);
  };

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDialog();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const modal = isOpen ? (
    <div className={styles.overlay} role="presentation" onClick={closeDialog}>
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Reparto del gasto"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <button
            type="button"
            className={styles.backButton}
            onClick={closeDialog}
            aria-label="Cerrar"
          >
            <span aria-hidden="true" className={styles.backIcon} />
          </button>
          <div>
            <h2 className={styles.title}>{split?.title ?? "Reparto"}</h2>
            {split ? (
              <p className={styles.meta}>
                {formatShortDate(split.expense_date)} - Pago {split.paid_by_name}
              </p>
            ) : null}
          </div>
        </header>

        {split ? (
          <div className={styles.body}>
            <div className={styles.summary}>
              <span>Total</span>
              <strong>{formatCurrency(split.total_amount, split.currency)}</strong>
            </div>

            {split.description ? (
              <p className={styles.description}>{split.description}</p>
            ) : null}

            <div className={styles.participants}>
              {split.participants.map((participant) => (
                <div key={participant.profile_id} className={styles.participantRow}>
                  <span className={styles.participantInfo}>
                    <ProfileAvatar
                      src={participant.avatar_url}
                      alt=""
                      width={28}
                      height={28}
                    />
                    <span>
                      <span className={styles.participantName}>
                        {participant.display_name}
                      </span>
                      <span className={styles.participantStatus}>
                        {formatParticipantStatus(participant.status)}
                      </span>
                    </span>
                  </span>
                  <strong className={styles.participantAmount}>
                    {formatCurrency(participant.share_amount, split.currency)}
                  </strong>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className={styles.emptyState}>
            {errorMessage ?? "No se pudo cargar el reparto."}
          </p>
        )}
      </section>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        className={buttonClassName}
        onClick={openDialog}
        disabled={isPending}
      >
        {isPending ? "Abriendo..." : "Ver reparto"}
      </button>
      {modal ? createPortal(modal, document.body) : null}
    </>
  );
}
