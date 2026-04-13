"use client";

import Image from "next/image";
import Link from "next/link";
import { DayPicker } from "react-day-picker";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import styles from "./area-personal-screen.module.css";

type AreaPersonalScreenProps = {
  houseCode: string;
  dashboardPath?: string;
};

const summaryCards = [
  { title: "Mis deudas", value: "250€", meta: "3 pagos pendientes" },
  { title: "Me deben", value: "974€", meta: "1 pagos pendientes" },
  { title: "Gastos del mes", value: "250€", meta: "+8% que el mes anterior" },
];

const pieData = [
  { name: "Alquiler", value: 45, color: "#F0EAE4" },
  { name: "Facturas", value: 30, color: "#C47A93" },
  { name: "Compras", value: 25, color: "#8B1A2F" },
];

export function AreaPersonalScreen({
  houseCode,
  dashboardPath,
}: AreaPersonalScreenProps) {
  const basePath = dashboardPath ?? `/dashboard/${houseCode}`;
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
            <h1 className={styles.title}>Área personal</h1>
            <p className={styles.subtitle}>Resumen de tu situación en el piso</p>
          </div>
          <span />
        </header>

        <div className={styles.content}>
          <div className={styles.summaryGrid}>
            {summaryCards.map((item) => (
              <Card key={item.title} className={styles.summaryCard}>
                <h2 className={styles.summaryTitle}>{item.title}</h2>
                <p className={styles.summaryValue}>{item.value}</p>
                <p className={styles.summaryMeta}>{item.meta}</p>
              </Card>
            ))}
          </div>

          <Card className={styles.sectionCard}>
            <h2 className={styles.sectionHeader}>Mis deudas</h2>
            <div className={`${styles.rows} ${styles.debtsRows}`}>
              <div className={styles.row}>
                <div className={styles.person}>
                  <Image src="/images/IconoperfilM.webp" alt="Perfil" width={22} height={22} className={styles.avatar} />
                  <div>
                    <p className={styles.personLine}>Laura - Compra Mercadona</p>
                  </div>
                </div>
                <p className={styles.amount}>23€</p>
                <Button className={styles.actionButton}>Confirmar pago</Button>
              </div>
              <div className={styles.row}>
                <div className={styles.person}>
                  <Image src="/images/IconoperfilH.webp" alt="Perfil" width={22} height={22} className={styles.avatar} />
                  <div>
                    <p className={styles.personLine}>Marc - Factura luz</p>
                    <p className={styles.personSub}>Pagar antes del 25 de mayo</p>
                  </div>
                </div>
                <p className={styles.amount}>23€</p>
                <Button className={styles.actionButton}>Confirmar pago</Button>
              </div>
            </div>
          </Card>

          <Card className={styles.sectionCard}>
            <h2 className={styles.sectionHeader}>Me deben</h2>
            <div className={`${styles.rows} ${styles.debtsRows}`}>
              <div className={styles.row}>
                <div className={styles.person}>
                  <Image src="/images/IconoperfilM.webp" alt="Perfil" width={22} height={22} className={styles.avatar} />
                  <p className={styles.personLine}>Laura - Compra IKEA</p>
                </div>
                <p className={styles.amount}>23€</p>
                <Button className={styles.actionButton}>Verificar pago</Button>
              </div>
              <div className={styles.row}>
                <div className={styles.person}>
                  <Image src="/images/IconoperfilH.webp" alt="Perfil" width={22} height={22} className={styles.avatar} />
                  <p className={styles.personLine}>Marc - Compra papel</p>
                </div>
                <p className={styles.amount}>23€</p>
                <Button className={styles.actionButton}>Verificar pago</Button>
              </div>
              <div className={styles.row}>
                <div className={styles.person}>
                  <Image src="/images/IconoperfilM.webp" alt="Perfil" width={22} height={22} className={styles.avatar} />
                  <p className={styles.personLine}>Ana - Compra farmacia</p>
                </div>
                <p className={styles.amount}>23€</p>
                <Button className={styles.actionButton}>Verificar pago</Button>
              </div>
            </div>
          </Card>

          <Card className={styles.sectionCard}>
            <div className={styles.historyTop}>
              <h2 className={styles.sectionHeader}>Historial</h2>
              <Link href={`${basePath}/area-personal/historial`} className={styles.viewAll}>
                Ver todo &gt;
              </Link>
            </div>
            <div className={styles.rows}>
              <div className={styles.row}>
                <div className={styles.person}>
                  <Image src="/images/IconoperfilH.webp" alt="Perfil" width={22} height={22} className={styles.avatar} />
                  <div>
                    <p className={styles.personLine}>Pago a Marc</p>
                    <p className={styles.personSub}>Factura de la luz - 25€</p>
                  </div>
                </div>
                <p className={styles.historyAmount} />
                <Button className={styles.historyButton}>Ver factura</Button>
              </div>
              <div className={styles.row}>
                <div className={styles.person}>
                  <Image src="/iconos/Carrodecompra.svg" alt="Compra" width={18} height={18} />
                  <p className={styles.personLine}>Compra supermercado - 40€</p>
                </div>
              </div>
            </div>
          </Card>

          <div className={styles.bottomGrid}>
            <Card className={styles.bottomCardMaroon}>
              <h2 className={styles.calendarTitle}>Junio / 2026</h2>
              <div className={styles.calendar}>
                <DayPicker
                  month={new Date(2026, 5, 1)}
                  defaultMonth={new Date(2026, 5, 1)}
                  showOutsideDays
                  fixedWeeks
                />
              </div>
            </Card>

            <Card className={styles.bottomCardMaroon}>
              <h2 className={styles.pieTitle}>Resumen visual</h2>
              <div className={styles.pieWrap}>
                <ResponsiveContainer width="100%" height={120}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={54}
                      innerRadius={0}
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>

                <ul className={styles.pieLegend}>
                  {pieData.map((entry) => (
                    <li key={entry.name} className={styles.legendItem}>
                      <span className={styles.dot} style={{ background: entry.color }} />
                      {entry.name}
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          </div>
        </div>
      </section>
    </main>
  );
}

