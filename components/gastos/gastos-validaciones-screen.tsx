"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  adminConfirmPaymentAction,
  adminRejectPaymentAction,
} from "../../app/backend/endpoints/gastos/actions";
import type { PendingPaymentConfirmation } from "../../lib/dashboard-types";
import { formatCurrency, formatShortDate } from "../../lib/dashboard-presenters";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import styles from "./gastos-division-screen.module.css";

type GastosValidacionesScreenProps = {
  houseCode: string;
  dashboardPath: string;
  pendingPaymentConfirmations?: PendingPaymentConfirmation[];
};

export function GastosValidacionesScreen({
  houseCode,
  dashboardPath,
  pendingPaymentConfirmations = [],
}: GastosValidacionesScreenProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const basePath = dashboardPath;
  const normalizedSearchValue = searchValue.trim().toLowerCase();

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
            <p className={styles.subtitle}>Pagos pendientes de validacion</p>
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
                <h2 className={styles.cardTitle}>Validaciones</h2>
              </div>
              <div className={styles.searchWrap}>
                <input
                  className={styles.searchInput}
                  placeholder="Buscar"
                  aria-label="Buscar validaciones"
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
              <section className={styles.pendingSection}>
                <h3 className={styles.monthTitle}>Confirmaciones pendientes</h3>
                {filteredPendingConfirmations.length ? (
                  <div className={styles.pendingRows}>
                    {filteredPendingConfirmations.map((payment) => (
                      <div key={payment.payment_id} className={styles.pendingRow}>
                        <div className={styles.pendingInfo}>
                          <p className={styles.main}>
                            {payment.expense_title || "Gasto sin título"}
                          </p>
                          <p className={styles.sub}>
                            {payment.from_name} - {payment.to_name} -{" "}
                            {formatCurrency(payment.amount)}
                          </p>
                          <p className={styles.meta}>
                            {formatShortDate(payment.payment_date)}
                            {payment.note ? ` - ${payment.note}` : ""}
                          </p>
                          {!payment.can_review ? (
                            <p className={styles.meta}>
                              Solo el admin o quien creo el gasto puede revisarlo.
                            </p>
                          ) : null}
                        </div>
                        <div className={styles.pendingActions}>
                          <Button
                            className={styles.pendingApprove}
                            onClick={() =>
                              payment.can_review
                                ? handleAdminConfirmPayment(payment.payment_id)
                                : undefined
                            }
                            disabled={isPending || !payment.can_review}
                          >
                            Confirmar
                          </Button>
                          <Button
                            className={styles.pendingReject}
                            onClick={() =>
                              payment.can_review
                                ? handleAdminRejectPayment(payment.payment_id)
                                : undefined
                            }
                            disabled={isPending || !payment.can_review}
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
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}

