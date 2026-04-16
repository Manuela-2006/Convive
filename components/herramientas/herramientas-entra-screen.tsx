"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import styles from "./herramientas-entra-screen.module.css";

type HerramientasEntraScreenProps = {
  houseCode: string;
  dashboardPath: string;
};

export function HerramientasEntraScreen({
  houseCode,
  dashboardPath,
}: HerramientasEntraScreenProps) {
  const basePath = dashboardPath;
  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <header className={styles.header}>
          <Link href={`${basePath}/herramientas`} className={styles.backLink}>
            <Image src="/iconos/flechaatras.svg" alt="Volver" width={20} height={20} className={styles.backIcon} />
          </Link>
          <div className={styles.headerCenter}>
            <h1 className={styles.title}>Herramientas</h1>
            <p className={styles.subtitle}>Simula cambios y ahorra en gastos</p>
          </div>
          <span />
        </header>

        <div className={styles.content}>
          <Card className={styles.card}>
            <div className={styles.topRow}>
              <Link href={`${basePath}/herramientas`} className={styles.inlineBack}>
                ←
              </Link>
              <h2 className={styles.cardTitle}>Simulador de escenarios</h2>
            </div>

            <h3 className={styles.question}>¿Quién entra en el piso?</h3>

            <div className={styles.formBlock}>
              <label htmlFor="nombre">Nombre</label>
              <Input id="nombre" className={styles.field} />
            </div>

            <div className={styles.formBlock}>
              <label htmlFor="fecha-entrada">Fecha de entrada</label>
              <select id="fecha-entrada" className={styles.fieldSelect} defaultValue="21/02/2026">
                <option>21/02/2026</option>
                <option>22/02/2026</option>
                <option>23/02/2026</option>
              </select>
            </div>

            <div className={styles.formBlock}>
              <label htmlFor="fecha-salida">Fecha de salida</label>
              <select id="fecha-salida" className={styles.fieldSelect} defaultValue="21/02/2026">
                <option>21/02/2026</option>
                <option>22/02/2026</option>
                <option>23/02/2026</option>
              </select>
            </div>

            <Button className={styles.simButton}>Simular impacto</Button>

            <h3 className={styles.sectionTitle}>Estado actual</h3>
            <Card className={styles.stateCard}>
              <div className={styles.stateRow}>
                <div className={styles.personTag}>
                  <Image src="/images/IconoperfilM.webp" alt="" width={22} height={22} />
                  Lucia
                </div>
                <strong>80€</strong>
              </div>
              <div className={styles.stateRow}>
                <div className={styles.personTag}>
                  <Image src="/images/IconoperfilM.webp" alt="" width={22} height={22} />
                  Lucia
                </div>
                <strong>80€</strong>
              </div>
              <p className={styles.stateLabel}>Actual</p>
            </Card>

            <h3 className={styles.sectionTitle}>Estado simulado</h3>
            <p className={styles.durationTitle}>Duración del cambio</p>
            <div className={styles.timeline}>
              <span className={styles.dot} />
              <span className={styles.dot} />
            </div>
            <div className={styles.dates}>
              <span>21 de junio</span>
              <span>4 de agosto</span>
            </div>

            <Card className={styles.stateCard}>
              <div className={styles.stateRow}>
                <div className={styles.personTag}>
                  <Image src="/images/IconoperfilM.webp" alt="" width={22} height={22} />
                  Lucia
                </div>
                <strong>50€</strong>
              </div>
              <div className={styles.stateRow}>
                <div className={styles.personTag}>
                  <Image src="/images/IconoperfilM.webp" alt="" width={22} height={22} />
                  Lucia
                </div>
                <strong>50€</strong>
              </div>
              <p className={styles.stateLabel}>Simulación</p>
            </Card>
          </Card>
        </div>
      </section>
    </main>
  );
}

