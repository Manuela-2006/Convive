"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  adminConfirmPaymentAction,
  adminRejectPaymentAction,
  requestExpensePaymentConfirmationAction,
} from "../../app/actions/expense-actions";
import type {
  CurrentUserExpenseState,
  PendingPaymentConfirmation,
  SharedExpense,
} from "../../lib/dashboard-types";
import {
  formatCurrency,
  formatMonthLabel,
  formatShortDate,
} from "../../lib/dashboard-presenters";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import styles from "./gastos-division-screen.module.css";

type GastosDivisionScreenProps = {
  houseCode: string;
  dashboardPath: string;
  sharedExpenses?: SharedExpense[];
  currentProfileId: string;
  currentUserExpenseStates?: CurrentUserExpenseState[];
  pendingPaymentConfirmations?: PendingPaymentConfirmation[];
  canReviewPayments?: boolean;
};

function matchesSearch(expense: SharedExpense, searchTerm: string) {
  const haystack = [
    expense.title,
    expense.paid_by_name,
    expense.participants_text,
    expense.expense_type,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(searchTerm);
}

export function GastosDivisionScreen({
  houseCode,
  dashboardPath,
  sharedExpenses = [],
  currentProfileId,
  currentUserExpenseStates = [],
  pendingPaymentConfirmations = [],
  canReviewPayments = false,
}: GastosDivisionScreenProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const basePath = dashboardPath;
  const normalizedSearchValue = searchValue.trim().toLowerCase();
  const currentUserStateByExpenseId = new Map(
    currentUserExpenseStates.map((state) => [state.expense_id, state] as const)
  );

  const groupedExpenses = sharedExpenses
    .filter((expense) =>
      normalizedSearchValue ? matchesSearch(expense, normalizedSearchValue) : true
    )
    .reduce<Array<{ month: string; rows: SharedExpense[] }>>((groups, expense) => {
      const month = formatMonthLabel(expense.expense_date);
      const currentGroup = groups.find((group) => group.month === month);

      if (currentGroup) {
        currentGroup.rows.push(expense);
        return groups;
      }

      groups.push({ month, rows: [expense] });
      return groups;
    }, []);

  const filteredPendingConfirmations = pendingPaymentConfirmations.filter((payment) => {
    if (!normalizedSearchValue) {
      return true;
    }

    const haystack = [
      payment.expense_title ?? "",
      payment.from_name,
      payment.to_name,
      payment.note ?? "",
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedSearchValue);
  });

  const runAction = (task: () => Promise<boolean>) => {
    setFeedbackMessage(null);
    startTransition(async () => {
      const shouldRefresh = await task();

      if (shouldRefresh) {
        router.refresh();
      }
    });
  };

  const handleRequestPaymentConfirmation = (expense: SharedExpense) => {
    runAction(async () => {
      const result = await requestExpensePaymentConfirmationAction({
        houseCode,
        dashboardPath: basePath,
        expenseId: expense.expense_id,
      });

      if (result.success) {
        setFeedbackMessage(
          result.data.status === "completed_self"
            ? "Tu parte ha quedado marcada como pagada."
            : "Tu pago ha quedado pendiente de revision."
        );
        return true;
      }

      if ("error" in result) {
        setFeedbackMessage(result.error);
      }
      return false;
    });
  };

  const handleAdminConfirmPayment = (paymentId: string) => {
    runAction(async () => {
      const result = await adminConfirmPaymentAction({
        houseCode,
        dashboardPath: basePath,
        paymentId,
      });

      if (result.success) {
        setFeedbackMessage("Pago confirmado correctamente.");
        return true;
      }

      if ("error" in result) {
        setFeedbackMessage(result.error);
      }
      return false;
    });
  };

  const handleAdminRejectPayment = (paymentId: string) => {
    runAction(async () => {
      const result = await adminRejectPaymentAction({
        houseCode,
        dashboardPath: basePath,
        paymentId,
        reason: "Pago rechazado desde el panel de validacion.",
      });

      if (result.success) {
        setFeedbackMessage("Pago rechazado correctamente.");
        return true;
      }

      if ("error" in result) {
        setFeedbackMessage(result.error);
      }
      return false;
    });
  };

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <header className={styles.header}>
          <Link href={`${basePath}/gastos`} className={styles.backLink}>
            <Image
              src="/iconos/flechaatras.svg"
              alt="Volver"
              width={20}
              height={20}
              className={styles.backIcon}
            />
          </Link>
          <div className={styles.headerCenter}>
            <h1 className={styles.title}>Gastos</h1>
            <p className={styles.subtitle}>Compras, imprevistos y gastos compartidos</p>
          </div>
          <span />
        </header>

        <div className={styles.content}>
          <Card className={styles.card}>
            <div className={styles.cardTop}>
              <div className={styles.titleWrap}>
                <Link
                  href={`${basePath}/gastos`}
                  className={styles.inlineBack}
                  aria-label="Volver a gastos"
                >
                  <Image
                    src="/iconos/flechaatras.svg"
                    alt=""
                    width={34}
                    height={34}
                  />
                </Link>
                <h2 className={styles.cardTitle}>Division de gastos</h2>
              </div>
              <div className={styles.searchWrap}>
                <input
                  className={styles.searchInput}
                  placeholder="Buscar"
                  aria-label="Buscar gastos"
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                />
                <Image src="/iconos/Lupa.svg" alt="" width={14} height={14} />
              </div>
            </div>

            {feedbackMessage ? (
              <p className={styles.feedbackMessage}>{feedbackMessage}</p>
            ) : null}

            <div className={styles.listWrap}>
              {groupedExpenses.length ? (
                groupedExpenses.map((group) => (
                  <section key={group.month} className={styles.monthBlock}>
                    <h3 className={styles.monthTitle}>{group.month}</h3>
                    <div className={styles.monthRows}>
                      {group.rows.map((expense) => {
                        const currentUserState = currentUserStateByExpenseId.get(
                          expense.expense_id
                        );
                        const currentUserIsParticipant =
                          expense.my_share_amount !== null &&
                          expense.my_share_amount !== undefined;
                        const currentUserMatchesStatus =
                          currentUserIsParticipant || expense.my_status === null;
                        const isPaid =
                          currentUserState?.participant_status === "paid" ||
                          expense.my_status === "paid";
                        const hasPendingConfirmation = Boolean(
                          currentUserState?.pending_payment_id
                        );

                        return (
                          <div key={expense.expense_id} className={styles.row}>
                            <div className={styles.left}>
                              <Image
                                src="/iconos/building-2-svgrepo-com 1.svg"
                                alt=""
                                width={20}
                                height={20}
                              />
                              <div>
                                <p className={styles.main}>{expense.title}</p>
                                <p className={styles.sub}>
                                  {formatShortDate(expense.expense_date)} · Pago{" "}
                                  {expense.paid_by_name}
                                </p>
                                <p className={styles.meta}>
                                  Participantes:{" "}
                                  {expense.participants_text || "Sin participantes"}
                                </p>
                                {currentUserMatchesStatus && currentUserIsParticipant ? (
                                  <p className={styles.statusLine}>
                                    Tu parte:{" "}
                                    {formatCurrency(
                                      expense.my_share_amount ?? 0,
                                      expense.currency
                                    )}{" "}
                                    ·{" "}
                                    {isPaid
                                      ? "Pagada"
                                      : hasPendingConfirmation
                                        ? "Pendiente de revision"
                                        : expense.my_status === "pending"
                                          ? "Pendiente"
                                          : "Sin estado"}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                            <p className={styles.amount}>
                              {formatCurrency(
                                expense.my_share_amount ?? expense.total_amount,
                                expense.currency
                              )}
                            </p>
                            {currentUserIsParticipant ? (
                              <Button
                                className={`${styles.button} ${
                                  isPaid || hasPendingConfirmation
                                    ? styles.buttonMuted
                                    : ""
                                }`}
                                onClick={() =>
                                  !isPaid && !hasPendingConfirmation
                                    ? handleRequestPaymentConfirmation(expense)
                                    : undefined
                                }
                                disabled={isPending || isPaid || hasPendingConfirmation}
                              >
                                {isPaid
                                  ? "Parte pagada"
                                  : hasPendingConfirmation
                                    ? "Pendiente"
                                    : "Marcar pagado"}
                              </Button>
                            ) : (
                              <span className={styles.stateBadge}>
                                {canReviewPayments ? "Vista revisor" : "Sin reparto"}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))
              ) : (
                <p className={styles.emptyState}>
                  No hay gastos compartidos visibles ahora mismo.
                </p>
              )}

              {canReviewPayments ? (
                <section className={styles.pendingSection}>
                  <h3 className={styles.monthTitle}>Confirmaciones pendientes</h3>
                  {filteredPendingConfirmations.length ? (
                    <div className={styles.pendingRows}>
                      {filteredPendingConfirmations.map((payment) => (
                        <div key={payment.payment_id} className={styles.pendingRow}>
                          <div className={styles.pendingInfo}>
                            <p className={styles.main}>
                              {payment.expense_title || "Gasto sin titulo"}
                            </p>
                            <p className={styles.sub}>
                              {payment.from_name} → {payment.to_name} ·{" "}
                              {formatCurrency(payment.amount)}
                            </p>
                            <p className={styles.meta}>
                              {formatShortDate(payment.payment_date)}
                              {payment.note ? ` · ${payment.note}` : ""}
                            </p>
                          </div>
                          <div className={styles.pendingActions}>
                            <Button
                              className={styles.pendingApprove}
                              onClick={() =>
                                handleAdminConfirmPayment(payment.payment_id)
                              }
                              disabled={isPending}
                            >
                              Confirmar
                            </Button>
                            <Button
                              className={styles.pendingReject}
                              onClick={() =>
                                handleAdminRejectPayment(payment.payment_id)
                              }
                              disabled={isPending}
                            >
                              Rechazar
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.emptyState}>
                      No hay pagos pendientes de revision.
                    </p>
                  )}
                </section>
              ) : null}
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}
