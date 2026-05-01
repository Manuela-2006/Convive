"use client";

import Image from "next/image";
import Link from "next/link";
import { Card } from "../ui/card";
import { ProfileAvatar } from "../ui/profile-avatar";
import type { Settlement } from "../../lib/dashboard-types";
import { formatCurrency } from "../../lib/dashboard-presenters";
import styles from "./gastos-simplificar-screen.module.css";

type GastosSimplificarScreenProps = {
  houseCode: string;
  dashboardPath: string;
  settlements?: Settlement[];
};

export function GastosSimplificarScreen({
  houseCode,
  dashboardPath,
  settlements = [],
}: GastosSimplificarScreenProps) {
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
            <h1 className={styles.title}>Gastos</h1>
            <p className={styles.subtitle}>Compras, imprevistos y gastos compartidos</p>
          </div>
          <span />
        </header>

        <div className={styles.content}>
          <Card className={styles.card}>
            <div className={styles.cardTop}>
              <div className={styles.titleWrap}>
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
                <h2 className={styles.cardTitle}>Simplificar pagos</h2>
              </div>
            </div>

            <h3 className={styles.monthTitle}>Pagos recomendados</h3>

            <div className={styles.rows}>
              {settlements.length ? (
                settlements.map((settlement, index) => (
                  <div
                    key={`${settlement.from_profile_id}-${settlement.to_profile_id}-${index}`}
                    className={styles.row}
                  >
                    <div className={styles.flow}>
                      <span className={styles.personTag}>
                        <ProfileAvatar
                          src={settlement.from_avatar_url}
                          alt=""
                          width={18}
                          height={18}
                        />
                        {settlement.from_name}
                      </span>
                      <span className={styles.smallAmount}>
                        {formatCurrency(settlement.amount)}
                      </span>
                      <Image
                        src="/iconos/flechaderecha.svg"
                        alt=""
                        width={18}
                        height={18}
                      />
                      <span className={styles.personTag}>
                        <ProfileAvatar
                          src={settlement.to_avatar_url}
                          alt=""
                          width={18}
                          height={18}
                        />
                        {settlement.to_name}
                      </span>
                    </div>
                    <Link
                      href={`${basePath}/gastos/simplificar/pago-simplificado`}
                      className={`convive-button ${styles.button}`}
                    >
                      Optimizar
                    </Link>
                  </div>
                ))
              ) : (
                <p className={styles.emptyState}>
                  No hay pagos pendientes para optimizar.
                </p>
              )}
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}





