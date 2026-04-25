"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  adminMarkInvoicePaidAction,
  getInvoiceDocumentSignedUrlAction,
} from "../../app/backend/endpoints/facturas/actions";
import {
  formatCurrency,
  formatShortDate,
} from "../../lib/dashboard-presenters";
import type { InvoiceCategorySection } from "../../lib/dashboard-types";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { SecureDocumentViewer } from "../ui/secure-document-viewer";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import styles from "./facturas-screen.module.css";

type FacturasScreenProps = {
  houseCode: string;
  dashboardPath: string;
  sections?: InvoiceCategorySection[];
  canMarkInvoicesPaid?: boolean;
};

export function FacturasScreen({
  houseCode,
  dashboardPath,
  sections = [],
  canMarkInvoicesPaid = false,
}: FacturasScreenProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingExpenseId, setPendingExpenseId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const basePath = dashboardPath;

  const handleMarkPaid = (expenseId: string) => {
    setErrorMessage(null);
    setPendingExpenseId(expenseId);

    startTransition(async () => {
      const result = await adminMarkInvoicePaidAction({
        houseCode,
        dashboardPath: basePath,
        expenseId,
      });

      setPendingExpenseId(null);

      if (result.success) {
        router.refresh();
        return;
      }

      if ("error" in result) {
        setErrorMessage(result.error);
      }
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
            <h1 className={styles.title}>Facturas</h1>
            <p className={styles.subtitle}>Gestiona las facturas del piso de forma clara</p>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href={`${basePath}/facturas/anadir-factura`}
                  className={styles.headerPlusLink}
                  aria-label="Anadir factura"
                >
                  <Image
                    src="/iconos/A%C3%B1adir.svg"
                    alt="Anadir"
                    width={24}
                    height={24}
                    className={styles.headerPlusIcon}
                  />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="top">Añadir factura</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </header>

        <div className={styles.content}>
          {errorMessage ? (
            <p className={styles.feedbackMessage}>{errorMessage}</p>
          ) : null}

          {sections.length ? (
            sections.map((section) => (
              <Card
                key={section.category_id ?? section.category_slug}
                className={styles.group}
              >
                <div className={styles.groupTop}>
                  <div className={styles.groupTitleWrap}>
                    <h2 className={styles.groupTitle}>{section.category_name}</h2>
                  </div>
                  <Link
                    href={`${basePath}/facturas/${section.category_slug}`}
                    className={styles.viewAll}
                  >
                    <span className={styles.viewAllContent}>
                      Ver todo
                      <Image
                        src="/iconos/flechascalendario.svg"
                        alt=""
                        width={14}
                        height={14}
                        className={styles.viewAllArrow}
                      />
                    </span>
                  </Link>
                </div>

                <Card
                  className={`${styles.paper} ${styles.paperStack} ${
                    section.invoices.length < 2 ? styles.paperStackTwo : ""
                  }`}
                >
                  {section.invoices.length ? (
                    section.invoices.map((invoice) => {
                      const canMarkPaid =
                        canMarkInvoicesPaid && invoice.can_mark_paid;

                      return (
                        <div className={styles.paperRow} key={invoice.expense_id}>
                          <div className={styles.left}>
                            <Image
                              src="/iconos/building-2-svgrepo-com 1.svg"
                              alt=""
                              width={20}
                              height={20}
                            />
                            <div>
                              <p className={styles.mainText}>{invoice.title}</p>
                              <p className={styles.dateText}>
                                {formatShortDate(invoice.invoice_date)}
                              </p>
                            </div>
                          </div>
                          <p className={styles.amount}>
                            {formatCurrency(
                              invoice.total_amount,
                              invoice.currency
                            )}
                          </p>
                          <SecureDocumentViewer
                            label="Ver factura"
                            title="Factura"
                            buttonClassName={`convive-button ${styles.actionButton}`}
                            documentAvailable={!!invoice.invoice_file_path}
                            emptyMessage="No hay factura subida para este gasto."
                            loadSignedUrl={() =>
                              getInvoiceDocumentSignedUrlAction({
                                houseCode,
                                expenseId: invoice.expense_id,
                              })
                            }
                          />
                          {canMarkPaid ? (
                            <Button
                              className={styles.actionButton}
                              onClick={() => handleMarkPaid(invoice.expense_id)}
                              disabled={
                                isPending &&
                                pendingExpenseId === invoice.expense_id
                              }
                            >
                              {isPending &&
                              pendingExpenseId === invoice.expense_id
                                ? "Marcando..."
                                : "Marcar pagada"}
                            </Button>
                          ) : null}
                        </div>
                      );
                    })
                  ) : (
                    <p className={styles.emptyState}>
                      No hay facturas activas en esta categoria.
                    </p>
                  )}
                </Card>
                <div className={styles.groupFooter} aria-hidden="true" />
              </Card>
            ))
          ) : (
            <Card className={styles.group}>
              <p className={styles.emptyState}>Todavia no hay facturas activas.</p>
            </Card>
          )}
        </div>
      </section>
    </main>
  );
}
