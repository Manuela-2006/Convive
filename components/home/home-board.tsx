import Image from "next/image";
import Link from "next/link";
import styles from "./home-board.module.css";
import { PaymentStatusChart } from "./payment-status-chart";

type HomeBoardProps = {
  houseCode: string;
  houseName: string;
  memberCount: number;
  dashboardPath: string;
};

export function HomeBoard({
  houseCode,
  houseName,
  memberCount,
  dashboardPath,
}: HomeBoardProps) {
  const basePath = dashboardPath;
  const totalPayments = Math.max(memberCount + 6, 8);
  const verifiedPayments = Math.max(totalPayments - 3, 1);
  const pendingPayments = totalPayments - verifiedPayments;
  const nextPayment = 974;
  const totalDebt = 250;

  return (
    <main className={styles.page}>
      <Image
        src="/Logoconvive.png"
        alt="Convive"
        width={260}
        height={66}
        className={styles.logo}
        priority
      />

      <section className={styles.boardFrame}>
        <div className={styles.board}>
          <div className={styles.grid}>
            <article
              className={`${styles.tile} ${styles.tileWide} ${styles.tilePayments} ${styles.tileTop}`}
            >
              <h2 className={styles.title}>Pagos del mes</h2>
              <PaymentStatusChart
                verifiedPayments={verifiedPayments}
                totalPayments={totalPayments}
              />
              <p className={styles.meta}>
                {verifiedPayments} de {totalPayments} pagos verificados
              </p>
            </article>

            <article className={`${styles.tile} ${styles.tileNarrow} ${styles.tileTop}`}>
              <h2 className={styles.title}>Próximo pago</h2>
              <p className={`${styles.value} ${styles.valueTop}`}>{nextPayment}€</p>
              <p className={styles.meta}>Alquiler en 4 días</p>
            </article>

            <article className={`${styles.tile} ${styles.tileNarrow}`}>
              <h2 className={styles.title}>Deuda total</h2>
              <p className={styles.value}>{totalDebt}€</p>
              <p className={styles.meta}>{pendingPayments} pagos pendientes de realizar</p>
            </article>

            <article className={`${styles.tile} ${styles.tileWide}`}>
              <h2 className={styles.title}>Actividad reciente</h2>
              <ul className={`${styles.activity} ${styles.activityRecent}`}>
                <li>{houseName} - Piso activo</li>
                <li>{memberCount} personas en el piso</li>
                <li>Laura - Subido factura de luz</li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      <Link href={`${basePath}/menu`} className={styles.menu}>
        <Image
          src="/iconos/Iconopuerta.svg"
          alt="Menú"
          width={24}
          height={24}
          className={styles.menuIcon}
        />
        <span>Menú</span>
      </Link>
    </main>
  );
}

