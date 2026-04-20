"use client";

import Image from "next/image";
import Link from "next/link";
import { Card } from "../ui/card";
import type {
  ExpenseTicket,
  PendingPaymentConfirmation,
  Settlement,
  SharedExpense,
} from "../../lib/dashboard-types";
import {
  formatCurrency,
  formatShortDate,
  resolveTicketFileUrl,
} from "../../lib/dashboard-presenters";
import styles from "./gastos-screen.module.css";

type GastosScreenProps = {
  houseCode: string;
  dashboardPath: string;
  tickets?: ExpenseTicket[];
  sharedExpenses?: SharedExpense[];
  settlements?: Settlement[];
  pendingPaymentConfirmations?: PendingPaymentConfirmation[];
  canReviewPayments?: boolean;
};

export function GastosScreen({
  houseCode,
  dashboardPath,
  tickets = [],
  sharedExpenses = [],
  settlements = [],
  pendingPaymentConfirmations = [],
  canReviewPayments = false,
}: GastosScreenProps) {
  const basePath = dashboardPath;
  const visibleTickets = tickets.slice(0, 2);
  const visibleSharedExpenses = sharedExpenses.slice(0, 2);
  const visibleSettlements = settlements.slice(0, 2);

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
          <Card className={`${styles.maroonSection} ${styles.ticketsSection}`}>
            <div className={`${styles.sectionTop} ${styles.simpleTop}`}>
              <div className={styles.sectionTitleWrap}>
                <Link
                  href={`${basePath}/gastos/anadir-ticket`}
                  className={styles.plusLink}
                  aria-label="Añadir ticket"
                >
                  <Image
                    src="/iconos/Añadir.svg"
                    alt=""
                    width={16}
                    height={16}
                    className={styles.plusIcon}
                  />
                </Link>
                <h2 className={styles.sectionTitle}>Tickets de compra</h2>
              </div>
              <Link href={`${basePath}/gastos/tickets`} className={styles.viewAll}>
                <span className={styles.viewAllContent}>
                  Ver todo
                  <Image
                    src="/iconos/flechascalendario.svg"
                    alt=""
                    width={20}
                    height={20}
                    className={styles.viewAllArrow}
                  />
                </span>
              </Link>
            </div>
            <Card className={`${styles.innerPaper} ${styles.ticketsPaper}`}>
              {visibleTickets.length ? (
                visibleTickets.map((ticket) => {
                  const ticketFileUrl = resolveTicketFileUrl(ticket.ticket_file_path);

                  return (
                    <div key={ticket.ticket_id} className={styles.innerRow}>
                      <div className={styles.leftInfo}>
                        <Image src="/images/IconoperfilM.webp" alt="" width={20} height={20} />
                        <div>
                          <p className={styles.mainText}>
                            {ticket.paid_by_name} -{" "}
                            {ticket.display_title || ticket.merchant}
                          </p>
                          <p className={styles.subText}>
                            {formatShortDate(ticket.purchase_date)}
                          </p>
                        </div>
                      </div>
                      <p className={styles.amount}>
                        {formatCurrency(ticket.total_amount, ticket.currency)}
                      </p>
                      {ticketFileUrl ? (
                        <a
                          href={ticketFileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={`convive-button ${styles.actionButton}`}
                        >
                          Ver ticket
                        </a>
                      ) : (
                        <Link
                          href={`${basePath}/gastos/tickets`}
                          className={`convive-button ${styles.actionButton}`}
                        >
                          Ver ticket
                        </Link>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className={styles.emptyState}>Todavía no hay tickets de compra.</p>
              )}
            </Card>
            <div className={styles.ticketsFooter} aria-hidden="true" />
          </Card>

          <Card className={`${styles.maroonSection} ${styles.divisionSection}`}>
            <div className={styles.sectionTop}>
              <h2 className={styles.sectionTitle}>Division de gastos</h2>
              <Link href={`${basePath}/gastos/division`} className={styles.viewAll}>
                <span className={styles.viewAllContent}>
                  Ver todo
                  <Image
                    src="/iconos/flechascalendario.svg"
                    alt=""
                    width={20}
                    height={20}
                    className={styles.viewAllArrow}
                  />
                </span>
              </Link>
            </div>
            <Card className={`${styles.innerPaper} ${styles.divisionPaper}`}>
              {visibleSharedExpenses.length ? (
                visibleSharedExpenses.map((expense) => (
                  <div key={expense.expense_id} className={styles.innerRow}>
                    <div className={styles.leftInfo}>
                      <Image
                        src="/iconos/building-2-svgrepo-com 1.svg"
                        alt=""
                        width={20}
                        height={20}
                      />
                      <div>
                        <p className={styles.mainText}>{expense.title}</p>
                        <p className={styles.subText}>
                          {formatShortDate(expense.expense_date)}
                        </p>
                        <p className={styles.metaText}>
                          Pago: {expense.paid_by_name || "Sin pagador"}
                        </p>
                        <p className={styles.metaText}>
                          Participantes: {expense.participants_text || "Sin reparto"}
                        </p>
                      </div>
                    </div>
                    <p className={styles.amount}>
                      {formatCurrency(expense.total_amount, expense.currency)}
                    </p>
                    <Link
                      href={`${basePath}/gastos/division`}
                      className={`convive-button ${styles.actionButton}`}
                    >
                      Ver reparto
                    </Link>
                  </div>
                ))
              ) : (
                <p className={styles.emptyState}>Todavía no hay gastos compartidos.</p>
              )}
            </Card>
            <div className={styles.divisionFooter} aria-hidden="true" />
          </Card>

          <Card className={styles.simpleCard}>
            <div className={styles.sectionTop}>
              <div>
                <h2 className={styles.simpleTitle}>Simplificar pagos</h2>
                <p className={styles.simpleSub}>
                  Reducir pagos innecesarios entre companeros de piso
                </p>
              </div>
              <Link
                href={`${basePath}/gastos/simplificar`}
                className={`${styles.viewAll} ${styles.viewAllRed}`}
              >
                <span className={styles.viewAllContent}>
                  Ver todo
                  <Image
                    src="/iconos/flechascalendario.svg"
                    alt=""
                    width={20}
                    height={20}
                    className={styles.viewAllArrow}
                  />
                </span>
              </Link>
            </div>

            <div className={styles.payRows}>
              {visibleSettlements.length ? (
                visibleSettlements.map((settlement, index) => (
                  <div
                    key={`${settlement.from_profile_id}-${settlement.to_profile_id}-${index}`}
                    className={styles.payRow}
                  >
                    <div className={styles.flow}>
                      <span className={styles.personTag}>
                        <Image
                          src="/images/IconoperfilM.webp"
                          alt=""
                          width={16}
                          height={16}
                        />
                        {settlement.from_name}
                      </span>
                      <span className={styles.smallAmount}>
                        {formatCurrency(settlement.amount)}
                      </span>
                      <Image
                        src="/iconos/flechaderecha.svg"
                        alt=""
                        width={18}
                        height={18}
                      />
                      <span className={styles.personTag}>
                        <Image
                          src="/images/IconoperfilH.webp"
                          alt=""
                          width={16}
                          height={16}
                        />
                        {settlement.to_name}
                      </span>
                    </div>
                    <Link
                      href={`${basePath}/gastos/simplificar/pago-simplificado`}
                      className={`convive-button ${styles.actionButton}`}
                    >
                      Optimizar
                    </Link>
                  </div>
                ))
              ) : (
                <p className={styles.emptyState}>
                  No hay pagos pendientes para simplificar.
                </p>
              )}
            </div>
          </Card>

          {canReviewPayments ? (
            <Card className={styles.simpleCard}>
              <div className={`${styles.sectionTop} ${styles.simpleTop}`}>
                <div>
                  <h2 className={styles.simpleTitle}>Validaciones</h2>
                  <p className={styles.simpleSub}>
                    Pagos marcados por los participantes pendientes de revisión
                  </p>
                </div>
                <Link
                  href={`${basePath}/gastos/division`}
                  className={`${styles.viewAll} ${styles.viewAllRed}`}
                >
                  <span className={styles.viewAllContent}>
                    Ver todo
                    <Image
                      src="/iconos/flechascalendario.svg"
                      alt=""
                      width={20}
                      height={20}
                      className={styles.viewAllArrow}
                    />
                  </span>
                </Link>
              </div>

              <div className={styles.payRows}>
                {pendingPaymentConfirmations.length ? (
                  pendingPaymentConfirmations.slice(0, 3).map((payment) => (
                    <div key={payment.payment_id} className={styles.payRow}>
                      <div className={styles.flow}>
                        <span className={styles.personTag}>
                          <Image
                            src="/images/IconoperfilM.webp"
                            alt=""
                            width={16}
                            height={16}
                          />
                          {payment.from_name}
                        </span>
                        <span className={styles.smallAmount}>
                          {formatCurrency(payment.amount)}
                        </span>
                        <Image
                          src="/iconos/flechaderecha.svg"
                          alt=""
                          width={18}
                          height={18}
                        />
                        <span className={styles.personTag}>
                          <Image
                            src="/images/IconoperfilH.webp"
                            alt=""
                            width={16}
                            height={16}
                          />
                          {payment.to_name}
                        </span>
                      </div>
                      <span className={styles.pendingBadge}>Pendiente</span>
                    </div>
                  ))
                ) : (
                  <p className={styles.emptyState}>
                    No hay pagos pendientes de confirmar.
                  </p>
                )}
              </div>
            </Card>
          ) : null}
        </div>
      </section>
    </main>
  );
}



