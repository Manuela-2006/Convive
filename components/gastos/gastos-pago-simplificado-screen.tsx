"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import type { Settlement } from "../../lib/dashboard-types";
import { formatCurrency } from "../../lib/dashboard-presenters";
import styles from "./gastos-pago-simplificado-screen.module.css";

type GastosPagoSimplificadoScreenProps = {
  houseCode: string;
  dashboardPath: string;
  settlements?: Settlement[];
};

export function GastosPagoSimplificadoScreen({
  houseCode,
  dashboardPath,
  settlements = [],
}: GastosPagoSimplificadoScreenProps) {
  const basePath = dashboardPath;
  const totalAmount = settlements.reduce((sum, settlement) => {
    const amount =
      typeof settlement.amount === "number"
        ? settlement.amount
        : Number(settlement.amount);

    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0);

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <header className={styles.header}>
          <Link href={`${basePath}/gastos/simplificar`} className={styles.backLink}>
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
                href={`${basePath}/gastos/simplificar`}
                className={styles.inlineBack}
                aria-label="Volver a simplificar"
              >
                ←
              </Link>
              <h2 className={styles.cardTitle}>Pago simplificado</h2>
            </div>

            <Card className={styles.resultBox}>
              <div className={styles.flow}>
                {settlements.length ? (
                  settlements.map((settlement, index) => (
                    <div
                      key={`${settlement.from_profile_id}-${settlement.to_profile_id}-${index}`}
                      className={styles.personTag}
                    >
                      <Image
                        src="/images/IconoperfilM.webp"
                        alt=""
                        width={22}
                        height={22}
                      />
                      {settlement.from_name}
                      <span className={styles.amount}>
                        {formatCurrency(settlement.amount)}
                      </span>
                      <Image
                        src="/iconos/flechapagos.svg"
                        alt=""
                        width={18}
                        height={18}
                      />
                      <Image
                        src="/images/IconoperfilH.webp"
                        alt=""
                        width={22}
                        height={22}
                      />
                      {settlement.to_name}
                    </div>
                  ))
                ) : (
                  <p className={styles.personTag}>No hay pagos pendientes.</p>
                )}
              </div>
              <div className={styles.resultLabel}>Recomendado</div>
            </Card>

            <Card className={styles.resultBox}>
              <div className={styles.flow}>
                <span className={styles.personTag}>
                  <Image
                    src="/iconos/building-2-svgrepo-com 1.svg"
                    alt=""
                    width={22}
                    height={22}
                  />
                  {settlements.length} pagos
                </span>
                <span className={styles.amount}>{formatCurrency(totalAmount)}</span>
              </div>
              <div className={styles.resultLabel}>Resumen</div>
            </Card>

            <div className={styles.saveWrap}>
              <Button className={styles.saveButton}>Guardar</Button>
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}

