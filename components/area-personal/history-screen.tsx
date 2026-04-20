"use client";

import Image from "next/image";
import Link from "next/link";
import { Card } from "../ui/card";
import styles from "./history-screen.module.css";

type AreaPersonalHistoryScreenProps = {
  houseCode: string;
  dashboardPath: string;
};

type HistoryEntry = {
  icon: string;
  title: string;
  subtitle: string;
  date: string;
  amount: string;
};

type HistoryGroup = {
  month: string;
  items: HistoryEntry[];
};

const entries: HistoryGroup[] = [
  {
    month: "Enero 2026",
    items: [
      {
        icon: "/images/IconoperfilH.webp",
        title: "Pago a Marc",
        subtitle: "Factura de la luz",
        date: "2/01/2026",
        amount: "25\u20AC",
      },
      {
        icon: "/iconos/Carrodecompra.svg",
        title: "Compra supermercado",
        subtitle: "",
        date: "2/01/2026",
        amount: "40\u20AC",
      },
      {
        icon: "/images/IconoperfilH.webp",
        title: "Pago a Marc",
        subtitle: "Factura de la luz",
        date: "2/01/2026",
        amount: "25\u20AC",
      },
    ],
  },
  {
    month: "Diciembre 2025",
    items: [
      {
        icon: "/images/IconoperfilH.webp",
        title: "Pago de Marc",
        subtitle: "Factura de la luz",
        date: "2/01/2026",
        amount: "25\u20AC",
      },
      {
        icon: "/iconos/Carrodecompra.svg",
        title: "Compra supermercado",
        subtitle: "",
        date: "2/01/2026",
        amount: "40\u20AC",
      },
      {
        icon: "/images/IconoperfilH.webp",
        title: "Pago a Marc",
        subtitle: "Factura de la luz",
        date: "2/01/2026",
        amount: "25\u20AC",
      },
      {
        icon: "/iconos/Carrodecompra.svg",
        title: "Compra supermercado",
        subtitle: "",
        date: "2/01/2026",
        amount: "40\u20AC",
      },
      {
        icon: "/images/IconoperfilH.webp",
        title: "Pago de Marc",
        subtitle: "Factura de la luz",
        date: "2/01/2026",
        amount: "25\u20AC",
      },
      {
        icon: "/iconos/Carrodecompra.svg",
        title: "Compra supermercado",
        subtitle: "",
        date: "2/01/2026",
        amount: "40\u20AC",
      },
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
                <input className={styles.searchInput} placeholder="Buscar" />
                <Image src="/iconos/Lupa.svg" alt="" width={14} height={14} />
              </div>
            </div>

            <div className={styles.listWrap}>
              {entries.map((group) => (
                <section key={group.month} className={styles.monthBlock}>
                  <h3 className={styles.monthTitle}>{group.month}</h3>
                  <div className={styles.monthRows}>
                    {group.items.map((item, index) => (
                      <div className={styles.row} key={`${group.month}-${index}`}>
                        <div className={styles.left}>
                          <Image src={item.icon} alt="" width={20} height={20} />
                          <div>
                            <p className={styles.mainText}>{item.title}</p>
                            {item.subtitle ? <p className={styles.subText}>{item.subtitle}</p> : null}
                            <p className={styles.dateText}>{item.date}</p>
                          </div>
                        </div>

                        <p className={styles.amount}>{item.amount}</p>
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
