"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Card } from "../ui/card";
import type { ExpenseTicket } from "../../lib/dashboard-types";
import {
  formatCurrency,
  formatMonthLabel,
  formatShortDate,
  resolveTicketFileUrl,
} from "../../lib/dashboard-presenters";
import styles from "./gastos-tickets-screen.module.css";

type GastosTicketsScreenProps = {
  houseCode: string;
  dashboardPath: string;
  tickets?: ExpenseTicket[];
};

export function GastosTicketsScreen({
  houseCode,
  dashboardPath,
  tickets = [],
}: GastosTicketsScreenProps) {
  const basePath = dashboardPath;
  const [searchValue, setSearchValue] = useState("");
  const normalizedSearchValue = searchValue.trim().toLowerCase();
  const groupedTickets = tickets
    .filter((ticket) => {
      if (!normalizedSearchValue) {
        return true;
      }

      const haystack = [
        ticket.display_title,
        ticket.merchant,
        ticket.paid_by_name,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearchValue);
    })
    .reduce<
    Array<{ month: string; rows: ExpenseTicket[] }>
  >((groups, ticket) => {
    const month = formatMonthLabel(ticket.purchase_date);
    const currentGroup = groups.find((group) => group.month === month);

    if (currentGroup) {
      currentGroup.rows.push(ticket);
      return groups;
    }

    groups.push({ month, rows: [ticket] });
    return groups;
  }, []);

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
          <Card className={styles.ticketsCard}>
            <div className={styles.cardTop}>
              <div className={styles.cardTitleWrap}>
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
                <h2 className={styles.cardTitle}>Tickets de compra</h2>
              </div>

              <div className={styles.searchWrap}>
                <input
                  className={styles.searchInput}
                  placeholder="Buscar"
                  aria-label="Buscar tickets"
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                />
                <Image
                  src="/iconos/Lupa.svg"
                  alt=""
                  width={14}
                  height={14}
                  className={styles.searchIcon}
                />
              </div>
            </div>

            <div className={styles.listWrap}>
              {groupedTickets.length ? (
                groupedTickets.map((group) => (
                  <section key={group.month} className={styles.monthBlock}>
                    <h3 className={styles.monthTitle}>{group.month}</h3>
                    <div className={styles.monthRows}>
                      {group.rows.map((ticket) => {
                        const ticketFileUrl = resolveTicketFileUrl(ticket.ticket_file_path);

                        return (
                          <div className={styles.ticketRow} key={ticket.ticket_id}>
                            <div className={styles.ticketLeft}>
                              <Image
                                src="/images/IconoperfilM.webp"
                                alt=""
                                width={20}
                                height={20}
                              />
                              <div>
                                <p className={styles.ticketMain}>
                                  {ticket.paid_by_name} -{" "}
                                  {ticket.display_title || ticket.merchant}
                                </p>
                                <p className={styles.ticketDate}>
                                  {formatShortDate(ticket.purchase_date)}
                                </p>
                              </div>
                            </div>
                            <p className={styles.ticketAmount}>
                              {formatCurrency(ticket.total_amount, ticket.currency)}
                            </p>
                            {ticketFileUrl ? (
                              <a
                                href={ticketFileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className={styles.ticketButton}
                              >
                                Ver ticket
                              </a>
                            ) : (
                              <span className={styles.ticketButton}>Ver ticket</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))
              ) : (
                <p className={styles.emptyState}>Todavía no hay tickets registrados.</p>
              )}
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}

