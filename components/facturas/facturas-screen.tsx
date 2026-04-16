"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import styles from "./facturas-screen.module.css";

type FacturasScreenProps = {
  houseCode: string;
  dashboardPath: string;
};

const sections = [
  { key: "alquiler", title: "Alquiler", text: "Factura de el alquiler", date: "15 de Mayo" },
  { key: "suscripciones", title: "Suscripciones", text: "Factura de netflix", date: "15 de Mayo" },
  { key: "wifi", title: "Wifi", text: "Factura de el wifi", date: "15 de Mayo" },
  { key: "agua", title: "Agua", text: "Factura de el agua", date: "15 de Mayo" },
  { key: "luz", title: "Luz", text: "Factura de la luz", date: "15 de Mayo" },
];

export function FacturasScreen({
  houseCode,
  dashboardPath,
}: FacturasScreenProps) {
  const basePath = dashboardPath;
  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <header className={styles.header}>
          <Link href={`${basePath}/menu`} className={styles.backLink}>
            <Image src="/iconos/flechaatras.svg" alt="Volver" width={20} height={20} className={styles.backIcon} />
          </Link>
          <div className={styles.headerCenter}>
            <h1 className={styles.title}>Facturas</h1>
            <p className={styles.subtitle}>Gestiona las facturas del piso de forma clara</p>
          </div>
          <Link href={`${basePath}/facturas/anadir-factura`} className={styles.headerPlusLink} aria-label="Añadir factura">
            <Image src="/iconos/A%C3%B1adir.svg" alt="Añadir" width={24} height={24} className={styles.headerPlusIcon} />
          </Link>
        </header>

        <div className={styles.content}>
          {sections.map((section) => (
            <Card key={section.key} className={styles.group}>
              <div className={styles.groupTop}>
                <div className={styles.groupTitleWrap}>
                  <h2 className={styles.groupTitle}>{section.title}</h2>
                </div>
                <Link
                  href={
                    section.key === "alquiler"
                      ? `${basePath}/facturas/alquiler`
                      : section.key === "suscripciones"
                        ? `${basePath}/facturas/suscripciones`
                        : section.key === "wifi"
                          ? `${basePath}/facturas/wifi`
                          : section.key === "agua"
                            ? `${basePath}/facturas/agua`
                            : section.key === "luz"
                              ? `${basePath}/facturas/luz`
                              : `${basePath}/facturas`
                  }
                  className={styles.viewAll}
                >
                  <span className={styles.viewAllContent}>
                    Ver todo
                    <Image src="/iconos/flechascalendario.svg" alt="" width={14} height={14} className={styles.viewAllArrow} />
                  </span>
                </Link>
              </div>

              <Card
                className={`${styles.paper} ${styles.paperStack} ${
                  section.key === "suscripciones" || section.key === "wifi" || section.key === "luz" ? styles.paperStackTwo : ""
                }`}
              >
                <div className={styles.paperRow}>
                  <div className={styles.left}>
                    <Image src="/iconos/building-2-svgrepo-com 1.svg" alt="" width={20} height={20} />
                    <div>
                      <p className={styles.mainText}>{section.text}</p>
                      <p className={styles.dateText}>{section.date}</p>
                    </div>
                  </div>
                  <p className={styles.amount}>{"23\u20AC"}</p>
                  <Button className={styles.actionButton}>Ver factura</Button>
                </div>
              </Card>
              <div className={styles.groupFooter} aria-hidden="true" />
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}

