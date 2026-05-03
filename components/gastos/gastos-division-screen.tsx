"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { requestExpensePaymentConfirmationAction } from "../../app/backend/endpoints/gastos/actions";
import type {
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
import { ExpenseSplitDialog } from "./expense-split-dialog";
import styles from "./gastos-division-screen.module.css";

type GastosDivisionScreenProps = {
  houseCode: string;
  dashboardPath: string;
  sharedExpenses?: SharedExpense[];
  pendingPaymentConfirmations?: PendingPaymentConfirmation[];
  currentProfileId?: string;
};

function normalizeKey(value?: string | null) {
  return `${value || ""}`
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getDivisionIcon(expense: SharedExpense) {
  const category = normalizeKey(expense.expense_type);
  const context = `${category} ${normalizeKey(expense.title)}`;
  const isInvoice = context.includes("factura") || context.includes("invoice");

  if (context.includes("alquiler")) return "/iconos/alquiler.svg";
  if (context.includes("agua") || context.includes("water")) return "/iconos/agua.svg";
  if (context.includes("luz") || context.includes("elect")) return "/iconos/luz.svg";
  if (context.includes("suscrip") || context.includes("subscription")) {
    return "/iconos/suscripciones.svg";
  }
  if (context.includes("wifi") || context.includes("internet")) return "/iconos/wifi.svg";

  return isInvoice ? "/iconos/alquiler.svg" : "/iconos/compra.svg";
}

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

function formatSettlementStatus(status: string | null) {
  if (status === "settled") {
    return "Liquidado";
  }

  if (status === "partial") {
    return "Parcial";
  }

  return "Pendiente de liquidar";
}

export function GastosDivisionScreen({
  houseCode,
  dashboardPath,
  sharedExpenses = [],
  pendingPaymentConfirmations = [],
  currentProfileId,
}: GastosDivisionScreenProps) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [activeExpenseId, setActiveExpenseId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const basePath = dashboardPath;
  const normalizedSearchValue = searchValue.trim().toLowerCase();

  const getCurrentUserPendingPayment = (expense: SharedExpense) =>
    pendingPaymentConfirmations.find(
      (payment) =>
        payment.expense_id === expense.expense_id &&
        payment.from_profile_id === currentProfileId &&
        payment.status === "pending"
    );

  const handleRequestPaymentConfirmation = (expense: SharedExpense) => {
    setFeedbackMessage(null);
    setActiveExpenseId(expense.expense_id);

    startTransition(async () => {
      const result = await requestExpensePaymentConfirmationAction({
        houseCode,
        dashboardPath: basePath,
        expenseId: expense.expense_id,
        note: "Confirmacion enviada desde Division de gastos.",
      });

      if (result.success) {
        setFeedbackMessage("Confirmacion enviada. Ya aparece en Validaciones.");
        router.refresh();
      } else if ("error" in result) {
        setFeedbackMessage(result.error);
      }

      setActiveExpenseId(null);
    });
  };

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

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <header className={styles.header}>
          <Link href={`${basePath}/menu`} className={styles.backLink}>
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
                        const pendingPayment =
                          getCurrentUserPendingPayment(expense);
                        const isParticipant = expense.my_share_amount != null;
                        const isMySharePaid = expense.my_status === "paid";
                        const canRequestPayment =
                          Boolean(currentProfileId) &&
                          isParticipant &&
                          expense.my_status === "pending" &&
                          !pendingPayment;
                        const isActive = activeExpenseId === expense.expense_id;

                        return (
                          <div key={expense.expense_id} className={styles.row}>
                            <div className={styles.left}>
                              <Image
                                src={getDivisionIcon(expense)}
                                alt=""
                                width={46}
                                height={46}
                              />
                              <div>
                                <p className={styles.main}>{expense.title}</p>
                                <p className={styles.sub}>
                                  {formatShortDate(expense.expense_date)} - Pago{" "}
                                  {expense.paid_by_name}
                                </p>
                                <p className={styles.meta}>
                                  Participantes:{" "}
                                  {expense.participants_text || "Sin participantes"}
                                </p>
                                <p className={styles.statusLine}>
                                  Estado general:{" "}
                                  {formatSettlementStatus(
                                    expense.settlement_status
                                  )}
                                </p>
                                {isParticipant ? (
                                  <p className={styles.myShareLine}>
                                    Tu parte:{" "}
                                    {formatCurrency(
                                      expense.my_share_amount ?? 0,
                                      expense.currency
                                    )}
                                    {pendingPayment
                                      ? " - pendiente de revision"
                                      : isMySharePaid
                                        ? " - confirmada"
                                        : " - pendiente"}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                            <p className={styles.amount}>
                              {formatCurrency(
                                expense.total_amount,
                                expense.currency
                              )}
                            </p>
                            <div className={styles.actions}>
                              <ExpenseSplitDialog
                                houseCode={houseCode}
                                expenseId={expense.expense_id}
                                buttonClassName={styles.button}
                              />
                              {canRequestPayment ? (
                                <Button
                                  className={styles.button}
                                  onClick={() =>
                                    handleRequestPaymentConfirmation(expense)
                                  }
                                  disabled={isPending}
                                >
                                  {isActive ? "Enviando" : "He pagado"}
                                </Button>
                              ) : isParticipant ? (
                                <span className={styles.stateBadge}>
                                  {pendingPayment
                                    ? "En revision"
                                    : isMySharePaid
                                      ? "Pagado"
                                      : "Pendiente"}
                                </span>
                              ) : (
                                <span className={styles.stateBadgeMuted}>
                                  Global
                                </span>
                              )}
                            </div>
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
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}
