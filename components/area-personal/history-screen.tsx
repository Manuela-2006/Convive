"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { PersonalAreaHistoryItem } from "../../lib/dashboard-types";
import {
  formatCurrency,
  formatMonthLabel,
  formatShortDate,
} from "../../lib/dashboard-presenters";
import { Card } from "../ui/card";
import styles from "./history-screen.module.css";

type AreaPersonalHistoryScreenProps = {
  houseCode: string;
  dashboardPath: string;
  entries: PersonalAreaHistoryItem[];
};

function getHistoryIcon(item: PersonalAreaHistoryItem) {
  if (item.icon_type === "purchase") {
    return "/iconos/Carrodecompra.svg";
  }

  return "/iconos/euro.svg";
}

function matchesSearch(item: PersonalAreaHistoryItem, searchTerm: string) {
  const haystack = [
    item.title,
    item.subtitle,
    item.item_type,
    item.status,
    item.amount,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(searchTerm);
}

export function AreaPersonalHistoryScreen({
  houseCode,
  dashboardPath,
  entries,
}: AreaPersonalHistoryScreenProps) {
  const basePath = dashboardPath;
  const [searchValue, setSearchValue] = useState("");
  const searchTerm = searchValue.trim().toLowerCase();
  const groupedEntries = useMemo(() => {
    const filteredEntries = searchTerm
      ? entries.filter((item) => matchesSearch(item, searchTerm))
      : entries;
    const groups = new Map<string, PersonalAreaHistoryItem[]>();

    for (const item of filteredEntries) {
      const key = formatMonthLabel(item.item_date);
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }

    return [...groups.entries()].map(([month, items]) => ({ month, items }));
  }, [entries, searchTerm]);

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
            <h1 className={styles.title}>{"\u00C1rea personal"}</h1>
            <p className={styles.subtitle}>Resumen de tu situaci{"\u00F3"}n en el piso</p>
          </div>
          <span />
        </header>

        <div className={styles.content}>
          <Card className={styles.card}>
            <div className={styles.cardTop}>
              <div className={styles.titleWrap}>
                <Link href={`${basePath}/area-personal`} className={styles.inlineBack} aria-label="Volver al resumen">
                  <Image src="/iconos/flechaatras.svg" alt="" width={34} height={34} />
                </Link>
                <h2 className={styles.cardTitle}>Historial</h2>
              </div>
              <div className={styles.searchWrap}>
                <input
                  className={styles.searchInput}
                  placeholder="Buscar"
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                />
                <Image src="/iconos/Lupa.svg" alt="" width={14} height={14} />
              </div>
            </div>

            <div className={styles.listWrap}>
              {groupedEntries.length ? (
                groupedEntries.map((group) => (
                  <section key={group.month} className={styles.monthBlock}>
                    <h3 className={styles.monthTitle}>{group.month}</h3>
                    <div className={styles.monthRows}>
                      {group.items.map((item) => (
                        <div className={styles.row} key={`${item.item_type}-${item.item_id}`}>
                          <div className={styles.left}>
                            <Image src={getHistoryIcon(item)} alt="" width={20} height={20} />
                            <div>
                              <p className={styles.mainText}>{item.title}</p>
                              {item.subtitle ? <p className={styles.subText}>{item.subtitle}</p> : null}
                              <p className={styles.dateText}>
                                {formatShortDate(item.item_date)}
                              </p>
                            </div>
                          </div>

                          <p className={styles.amount}>
                            {formatCurrency(item.amount, item.currency)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                ))
              ) : (
                <p className={styles.emptyState}>No hay movimientos personales.</p>
              )}
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}
