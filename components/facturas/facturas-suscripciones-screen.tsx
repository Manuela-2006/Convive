"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import styles from "./facturas-history-screen.module.css";

type FacturasSuscripcionesScreenProps = {
  houseCode: string;
  dashboardPath?: string;
};

const monthlyRows = [
  {
    month: "Enero 2026",
    items: [1, 2, 3],
  },
  {
    month: "Diciembre 2025",
    items: [1, 2, 3, 4, 5, 6],
  },
];

export function FacturasSuscripcionesScreen({
  houseCode,
  dashboardPath,
}: FacturasSuscripcionesScreenProps) {
  const basePath = dashboardPath ?? `/dashboard/${houseCode}`;
  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <header className={styles.header}>
          <Link href={`${basePath}/facturas`} className={styles.backLink}>
            <Image src="/iconos/flechaatras.svg" alt="Volver" width={20} height={20} className={styles.backIcon} />
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
                <Link href={`${basePath}/facturas`} className={styles.inlineBack} aria-label="Volver a facturas">
                  ←
                </Link>
                <h2 className={styles.cardTitle}>Facturas suscripciones</h2>
              </div>
              <div className={styles.searchWrap}>
                <input className={styles.searchInput} placeholder="Buscar" />
                <Image src="/iconos/Lupa.svg" alt="" width={14} height={14} />
              </div>
            </div>

            <div className={styles.listWrap}>
              {monthlyRows.map((group) => (
                <section key={group.month} className={styles.monthBlock}>
                  <h3 className={styles.monthTitle}>{group.month}</h3>
                  <div className={styles.monthRows}>
                    {group.items.map((item) => (
                      <div className={styles.row} key={`${group.month}-${item}`}>
                        <div className={styles.left}>
                          <Image src="/iconos/building-2-svgrepo-com 1.svg" alt="" width={20} height={20} />
                          <div>
                            <p className={styles.mainText}>Factura de Netflix</p>
                            <p className={styles.dateText}>15 de Mayo</p>
                          </div>
                        </div>
                        <p className={styles.amount}>{"23\u20AC"}</p>
                        <Button className={styles.actionButton}>Ver factura</Button>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}
