"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  adminMarkInvoicePaidAction,
  getInvoiceDocumentSignedUrlAction,
} from "../../app/backend/endpoints/facturas/actions";
import {
  formatCurrency,
  formatMonthLabel,
  formatShortDate,
} from "../../lib/dashboard-presenters";
import type { Invoice } from "../../lib/dashboard-types";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { SecureDocumentViewer } from "../ui/secure-document-viewer";
import styles from "./facturas-history-screen.module.css";

type FacturasHistoryScreenProps = {
  houseCode: string;
  dashboardPath: string;
  title: string;
  invoices?: Invoice[];
  categorySlug?: string;
  canMarkInvoicesPaid?: boolean;
};

function normalizeCategoryKey(value?: string | null) {
  return `${value || ""}`
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getInvoiceCategoryIcon(categoryKey?: string | null) {
  const normalized = normalizeCategoryKey(categoryKey);
  const combined = ` ${normalized} `;

  if (combined.includes(" alquiler ")) return "/iconos/alquiler.svg";
  if (combined.includes(" agua ") || combined.includes(" water ")) return "/iconos/agua.svg";
  if (combined.includes(" luz ") || combined.includes(" elect ")) return "/iconos/luz.svg";
  if (combined.includes(" suscrip ") || combined.includes(" subscription ")) {
    return "/iconos/suscripciones.svg";
  }
  if (combined.includes(" wifi ") || combined.includes(" internet ")) return "/iconos/wifi.svg";

  return "/iconos/building-2-svgrepo-com 1.svg";
}

export function FacturasHistoryScreen({
  houseCode,
  dashboardPath,
  title,
  invoices = [],
  categorySlug,
  canMarkInvoicesPaid = false,
}: FacturasHistoryScreenProps) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const [pendingExpenseId, setPendingExpenseId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const basePath = dashboardPath;

  const visibleInvoices = useMemo(() => {
    const normalizedSearchValue = searchValue.trim().toLowerCase();

    return invoices.filter((invoice) => {
      if (categorySlug && invoice.category_slug !== categorySlug) {
        return false;
      }

      if (!normalizedSearchValue) {
        return true;
      }

      return [invoice.title, invoice.category_name, invoice.settlement_status ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearchValue);
    });
  }, [categorySlug, invoices, searchValue]);

  const groupedInvoices = visibleInvoices.reduce<
    Array<{ month: string; rows: Invoice[] }>
  >((groups, invoice) => {
    const month = formatMonthLabel(invoice.invoice_date);
    const currentGroup = groups.find((group) => group.month === month);

    if (currentGroup) {
      currentGroup.rows.push(invoice);
      return groups;
    }

    groups.push({ month, rows: [invoice] });
    return groups;
  }, []);

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
          <span />
        </header>

        <div className={styles.content}>
          <Card className={styles.card}>
            <div className={styles.cardTop}>
              <div className={styles.titleWrap}>
                <Link
                  href={`${basePath}/facturas`}
                  className={styles.inlineBack}
                  aria-label="Volver a facturas"
                >
                  <Image
                    src="/iconos/flechaatras.svg"
                    alt=""
                    width={34}
                    height={34}
                  />
                </Link>
                <h2 className={styles.cardTitle}>{title}</h2>
              </div>
              <div className={styles.searchWrap}>
                <input
                  className={styles.searchInput}
                  placeholder="Buscar"
                  aria-label="Buscar facturas"
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                />
                <Image src="/iconos/Lupa.svg" alt="" width={14} height={14} />
              </div>
            </div>

            {errorMessage ? (
              <p className={styles.feedbackMessage}>{errorMessage}</p>
            ) : null}

            <div className={styles.listWrap}>
              {groupedInvoices.length ? (
                groupedInvoices.map((group) => (
                  <section key={group.month} className={styles.monthBlock}>
                    <h3 className={styles.monthTitle}>{group.month}</h3>
                    <div className={styles.monthRows}>
                      {group.rows.map((invoice) => {
                        const canMarkPaid =
                          canMarkInvoicesPaid && invoice.can_mark_paid;
                        const iconSrc = getInvoiceCategoryIcon(
                          invoice.category_slug || invoice.category_name
                        );

                        return (
                          <div className={styles.row} key={invoice.expense_id}>
                            <div className={styles.left}>
                              <Image
                                src={iconSrc}
                                alt=""
                                width={46}
                                height={46}
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
                      })}
                    </div>
                  </section>
                ))
              ) : (
                <p className={styles.emptyState}>No hay facturas en el historial.</p>
              )}
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}
