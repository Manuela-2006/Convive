"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import styles from "./history-screen.module.css";

type AreaPersonalHistoryScreenProps = {
  houseCode: string;
  dashboardPath: string;
};

const entries = [
  {
    month: "Enero 2026",
    items: [
      { icon: "/images/IconoperfilH.webp", title: "Pago a Marc", subtitle: "Factura de la luz - 25€", date: "2/01/2026", action: true },
      { icon: "/iconos/Carrodecompra.svg", title: "Compra supermercado - 40€", subtitle: "", date: "2/01/2026", action: false },
      { icon: "/images/IconoperfilH.webp", title: "Pago a Marc", subtitle: "Factura de la luz - 25€", date: "2/01/2026", action: true },
    ],
  },
  {
    month: "Diciembre 2025",
    items: [
      { icon: "/images/IconoperfilH.webp", title: "Pago de Marc", subtitle: "Factura de la luz - 25€", date: "2/01/2026", action: true },
      { icon: "/iconos/Carrodecompra.svg", title: "Compra supermercado - 40€", subtitle: "", date: "2/01/2026", action: false },
      { icon: "/images/IconoperfilH.webp", title: "Pago a Marc", subtitle: "Factura de la luz - 25€", date: "2/01/2026", action: true },
      { icon: "/iconos/Carrodecompra.svg", title: "Compra supermercado - 40€", subtitle: "", date: "2/01/2026", action: false },
      { icon: "/images/IconoperfilH.webp", title: "Pago de Marc", subtitle: "Factura de la luz - 25€", date: "2/01/2026", action: true },
      { icon: "/iconos/Carrodecompra.svg", title: "Compra supermercado - 40€", subtitle: "", date: "2/01/2026", action: false },
    ],
  },
];

export function AreaPersonalHistoryScreen({
  houseCode,
  dashboardPath,
}: AreaPersonalHistoryScreenProps) {
  const basePath = dashboardPath;
  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <header className={styles.header}>
          <Link href={`${basePath}/menu`} className={styles.backLink}>
            <Image src="/iconos/flechaatras.svg" alt="Volver" width={22} height={22} className={styles.backIcon} />
          </Link>
          <div className={styles.headerCenter}>
            <h1 className={styles.title}>Área personal</h1>
            <p className={styles.subtitle}>Resumen de tu situación en el piso</p>
          </div>
          <span />
        </header>

        <div className={styles.content}>
          <Card className={styles.historyCard}>
            <div className={styles.historyTop}>
              <div className={styles.historyTitleWrap}>
                <Link href={`${basePath}/area-personal`} className={styles.inlineBack} aria-label="Volver al resumen">
                  ←
                </Link>
                <h2 className={styles.historyTitle}>Historial</h2>
              </div>
              <div className={styles.searchWrap}>
                <input className={styles.searchInput} placeholder="Buscar" />
                <span className={styles.searchIcon}>⌕</span>
              </div>
            </div>

            <div className={styles.itemsWrap}>
              {entries.map((group) => (
                <section key={group.month} className={styles.monthBlock}>
                  <h3 className={styles.monthTitle}>{group.month}</h3>
                  <div className={styles.monthRows}>
                    {group.items.map((item, index) => (
                      <div key={`${group.month}-${index}`} className={styles.itemRow}>
                        <div className={styles.itemLeft}>
                          <Image src={item.icon} alt="" width={20} height={20} />
                          <div>
                            <p className={styles.itemTitle}>{item.title}</p>
                            {item.subtitle ? <p className={styles.itemSub}>{item.subtitle}</p> : null}
                            <p className={styles.itemDate}>{item.date}</p>
                          </div>
                        </div>
                        {item.action ? <Button className={styles.actionButton}>Ver factura</Button> : <span />}
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

