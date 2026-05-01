"use client";

import Image from "next/image";
import Link from "next/link";
import { Card } from "../ui/card";
import { ProfileAvatar } from "../ui/profile-avatar";
import type { SharedExpense } from "../../lib/dashboard-types";
import { formatCurrency, formatShortDate } from "../../lib/dashboard-presenters";
import styles from "./gastos-reparto-screen.module.css";

type GastosRepartoScreenProps = {
  dashboardPath: string;
  expense: SharedExpense | null;
};

function parseParticipants(participantsText: string) {
  return participantsText
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

export function GastosRepartoScreen({
  dashboardPath,
  expense,
}: GastosRepartoScreenProps) {
  const basePath = dashboardPath;

  if (!expense) {
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
                <Link href={`${basePath}/gastos`} className={styles.inlineBack}>
                  <Image src="/iconos/flechaatras.svg" alt="" width={34} height={34} />
                </Link>
                <h2 className={styles.cardTitle}>Division de gasto</h2>
              </div>
              <p className={styles.emptyState}>No se encontro ese gasto.</p>
            </Card>
          </div>
        </section>
      </main>
    );
  }

  const totalAmount = Number(expense.total_amount);
  const participants = expense.participants.length
    ? expense.participants
    : parseParticipants(expense.participants_text).map((name, index) => ({
        profile_id: `fallback-${index}`,
        display_name: name,
        avatar_url: null,
      }));
  const participantsCount = Math.max(
    1,
    expense.participants_count || 0,
    participants.length
  );
  const perPersonAmount =
    Number.isFinite(totalAmount) && participantsCount > 0
      ? totalAmount / participantsCount
      : 0;

  const fallbackParticipants = Array.from({ length: participantsCount }).map(
    (_, index) => ({
      profile_id: `fallback-${index}`,
      display_name: `Participante ${index + 1}`,
      avatar_url: null,
    })
  );
  const participantRows = participants.length ? participants : fallbackParticipants;

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
              <Link
                href={`${basePath}/gastos`}
                className={styles.inlineBack}
                aria-label="Volver a gastos"
              >
                <Image src="/iconos/flechaatras.svg" alt="" width={34} height={34} />
              </Link>
              <h2 className={styles.cardTitle}>Division de gasto</h2>
            </div>

            <p className={styles.meta}>
              {expense.title} - {formatShortDate(expense.expense_date)}
            </p>

            <div className={styles.grid}>
              <Card className={styles.resultBox}>
                <div className={styles.boxContent}>
                  <span className={styles.bigAmount}>
                    {formatCurrency(expense.total_amount, expense.currency)}
                  </span>
                </div>
                <div className={styles.resultLabel}>Precio del gasto</div>
              </Card>

              <Card className={styles.resultBox}>
                <div className={styles.participantsList}>
                  {participantRows.map((participant, index) => (
                    <div
                      key={`${participant.profile_id}-${index}`}
                      className={styles.participantRow}
                    >
                      <span className={styles.participantLeft}>
                        <ProfileAvatar
                          src={participant.avatar_url}
                          alt=""
                          width={20}
                          height={20}
                        />
                        {participant.display_name}
                      </span>
                      <span className={styles.participantAmount}>
                        {formatCurrency(perPersonAmount, expense.currency)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className={styles.resultLabel}>Reparto</div>
              </Card>
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}

