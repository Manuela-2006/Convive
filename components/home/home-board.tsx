import Image from "next/image";
import Link from "next/link";

import { formatCurrency } from "../../lib/dashboard-presenters";
import styles from "./home-board.module.css";
import { PaymentStatusChart } from "./payment-status-chart";

type HomeBoardProps = {
  houseCode: string;
  houseName: string;
  memberCount: number;
  dashboardPath: string;
  monthlyPayments: {
    verifiedCount: number;
    totalCount: number;
    slotCount: number;
  };
  nextPayment: {
    amount: number | string;
    currency: string;
    title: string;
    daysUntil: number;
  } | null;
  debtSummary: {
    totalAmount: number | string;
    pendingCount: number;
  };
  recentActivity: Array<{
    id: string;
    label: string;
  }>;
};

function formatNextPaymentMeta(nextPayment: HomeBoardProps["nextPayment"]) {
  if (!nextPayment) {
    return "No tienes pagos pendientes próximos";
  }

  const timing =
    nextPayment.daysUntil <= 0
      ? "hoy"
      : nextPayment.daysUntil === 1
        ? "en 1 día"
        : `en ${nextPayment.daysUntil} días`;

  return `${nextPayment.title} ${timing}`;
}

export function HomeBoard({
  houseCode,
  houseName,
  memberCount,
  dashboardPath,
  monthlyPayments,
  nextPayment,
  debtSummary,
  recentActivity,
}: HomeBoardProps) {
  const basePath = dashboardPath;

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
            <Link
              href={`${basePath}/calendario`}
              className={`${styles.tile} ${styles.tileWide} ${styles.tilePayments} ${styles.tileTop}`}
            >
              <h2 className={styles.title}>Pagos del mes</h2>
              <PaymentStatusChart
                verifiedPayments={monthlyPayments.verifiedCount}
                totalPayments={monthlyPayments.totalCount}
                slots={monthlyPayments.slotCount}
              />
              <p className={styles.meta}>
                {monthlyPayments.verifiedCount} de {monthlyPayments.totalCount} pagos verificados
              </p>
            </Link>

            <article className={`${styles.tile} ${styles.tileNarrow} ${styles.tileTop}`}>
              <h2 className={styles.title}>Próximo pago</h2>
              <p className={`${styles.value} ${styles.valueTop}`}>
                {nextPayment
                  ? formatCurrency(nextPayment.amount, nextPayment.currency)
                  : "Sin pagos"}
              </p>
              <p className={styles.meta}>{formatNextPaymentMeta(nextPayment)}</p>
            </article>

            <Link
              href={`${basePath}/area-personal#mis-deudas`}
              className={`${styles.tile} ${styles.tileNarrow}`}
            >
              <h2 className={styles.title}>Deuda total</h2>
              <p className={styles.value}>{formatCurrency(debtSummary.totalAmount)}</p>
              <p className={styles.meta}>
                {debtSummary.pendingCount}{" "}
                {debtSummary.pendingCount === 1 ? "pago pendiente" : "pagos pendientes"} de
                realizar
              </p>
            </Link>

            <article className={`${styles.tile} ${styles.tileWide}`}>
              <h2 className={styles.title}>Actividad reciente</h2>
              <ul className={`${styles.activity} ${styles.activityRecent}`}>
                {recentActivity.length ? (
                  recentActivity.map((item) => <li key={item.id}>{item.label}</li>)
                ) : (
                  <li>Sin actividad reciente</li>
                )}
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

