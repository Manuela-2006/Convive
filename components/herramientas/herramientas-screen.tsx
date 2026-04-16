"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import styles from "./herramientas-screen.module.css";

type HerramientasScreenProps = {
  houseCode: string;
  dashboardPath: string;
};

export function HerramientasScreen({
  houseCode,
  dashboardPath,
}: HerramientasScreenProps) {
  const basePath = dashboardPath;
  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <header className={styles.header}>
          <Link href={`${basePath}/menu`} className={styles.backLink}>
            <Image src="/iconos/flechaatras.svg" alt="Volver" width={20} height={20} className={styles.backIcon} />
          </Link>
          <div className={styles.headerCenter}>
            <h1 className={styles.title}>Herramientas</h1>
            <p className={styles.subtitle}>Simula cambios y ahorra en gastos</p>
          </div>
          <span />
        </header>

        <div className={styles.content}>
          <Card className={styles.whiteCard}>
            <h2 className={styles.sectionTitle}>Simulador de escenarios</h2>
            <p className={styles.sectionText}>
              Simula como afectaria a los pagos comunes, la entrada o salida de personas al piso o incluso el cambio en otros factores.
            </p>
            <div className={styles.actionsRow}>
              <Link href={`${basePath}/herramientas/entra-alguien`} className={`convive-button ${styles.smallButton}`}>
                + Entra alguien
              </Link>
              <Button className={styles.smallButton}>- Sale alguien</Button>
              <Button className={styles.smallButton}>Cambiar condiciones</Button>
            </div>
          </Card>

          <Card className={styles.maroonCard}>
            <h2 className={styles.maroonTitle}>Comparador de gastos</h2>

            <div className={styles.tabsRow}>
              <button className={`${styles.tab} ${styles.tabActive}`}>Luz</button>
              <button className={styles.tab}>Agua</button>
              <button className={styles.tab}>Wifi</button>
            </div>

            <div className={styles.compareGrid}>
              <Card className={styles.compareCard}>
                <div className={styles.compareRow}>
                  <div className={styles.vendorLeft}>
                    <Image src="/iconos/building-2-svgrepo-com 1.svg" alt="" width={20} height={20} />
                    <div>
                      <p>Aquaservice</p>
                      <small>Martes 13/05/2026</small>
                    </div>
                  </div>
                  <strong>30€</strong>
                </div>
                <p className={styles.compareNote}>Ahorras hasta 15€ al mes en agua</p>
              </Card>

              <Card className={styles.compareCard}>
                <div className={styles.compareRow}>
                  <div className={styles.vendorLeft}>
                    <Image src="/iconos/building-2-svgrepo-com 1.svg" alt="" width={20} height={20} />
                    <div>
                      <p>Aqualia</p>
                    </div>
                  </div>
                  <div className={styles.priceRight}>
                    <strong>20€</strong>
                    <span>↓10€</span>
                  </div>
                </div>

                <div className={`${styles.compareRow} ${styles.compareRowSecond}`}>
                  <div className={styles.vendorLeft}>
                    <Image src="/iconos/building-2-svgrepo-com 1.svg" alt="" width={20} height={20} />
                    <div>
                      <p>Aqualia</p>
                    </div>
                  </div>
                  <div className={styles.priceRight}>
                    <strong>20€</strong>
                    <span>↓10€</span>
                  </div>
                </div>
              </Card>
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}

