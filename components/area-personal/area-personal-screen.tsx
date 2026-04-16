"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import Calendar from "react-calendar";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import styles from "./area-personal-screen.module.css";

type AreaPersonalScreenProps = {
  houseCode: string;
  dashboardPath: string;
};

const summaryCards = [
  { title: "Mis deudas", value: "250\u20AC", meta: "3 pagos pendientes" },
  { title: "Me deben", value: "974\u20AC", meta: "1 pagos pendientes" },
  { title: "Gastos del mes", value: "250\u20AC", meta: "+8% que el mes anterior" },
];

const pieData = [
  { name: "Alquiler", value: 45, color: "#F0EAE4" },
  { name: "Facturas", value: 30, color: "#C47A93" },
  { name: "Compras", value: 25, color: "#8B1A2F" },
];

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const highlightedRange: [Date, Date] = [new Date(2026, 5, 9), new Date(2026, 5, 13)];
const upcomingPaymentDate = new Date(2026, 6, 5);

function isSameDay(left: Date, right: Date) {
  return (
    left.getDate() === right.getDate() &&
    left.getMonth() === right.getMonth() &&
    left.getFullYear() === right.getFullYear()
  );
}

export function AreaPersonalScreen({
  houseCode,
  dashboardPath,
}: AreaPersonalScreenProps) {
  const [activeMonth, setActiveMonth] = useState(new Date(2026, 5, 1));
  const [isPaymentPopoverOpen, setIsPaymentPopoverOpen] = useState(false);
  const basePath = dashboardPath;

  const goPrevMonth = () => {
    setActiveMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
  };

  const goNextMonth = () => {
    setActiveMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
  };

  const calendarLabel = `${MONTH_NAMES[activeMonth.getMonth()]} / ${activeMonth.getFullYear()}`;

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
                <p className={styles.amount}>{"23\u20AC"}</p>
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
                <p className={styles.amount}>{"23\u20AC"}</p>
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
                <p className={styles.amount}>{"23\u20AC"}</p>
                <Button className={styles.actionButton}>Verificar pago</Button>
              </div>
              <div className={styles.row}>
                <div className={styles.person}>
                  <Image src="/images/IconoperfilH.webp" alt="Perfil" width={22} height={22} className={styles.avatar} />
                  <p className={styles.personLine}>Marc - Compra papel</p>
                </div>
                <p className={styles.amount}>{"23\u20AC"}</p>
                <Button className={styles.actionButton}>Verificar pago</Button>
              </div>
              <div className={styles.row}>
                <div className={styles.person}>
                  <Image src="/images/IconoperfilM.webp" alt="Perfil" width={22} height={22} className={styles.avatar} />
                  <p className={styles.personLine}>Ana - Compra farmacia</p>
                </div>
                <p className={styles.amount}>{"23\u20AC"}</p>
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
                    <p className={styles.personSub}>Factura de la luz - {"25\u20AC"}</p>
                  </div>
                </div>
                <p className={styles.historyAmount} />
                <Button className={styles.historyButton}>Ver factura</Button>
              </div>
              <div className={styles.row}>
                <div className={styles.person}>
                  <Image src="/iconos/Carrodecompra.svg" alt="Compra" width={18} height={18} />
                  <p className={styles.personLine}>Compra supermercado - {"40\u20AC"}</p>
                </div>
              </div>
            </div>
          </Card>

          <div className={styles.bottomGrid}>
            <Card className={`${styles.bottomCardMaroon} ${styles.calendarCard}`}>
              <div className={styles.calendarHeader}>
                <button type="button" className={styles.calendarNavButton} onClick={goPrevMonth} aria-label="Mes anterior">
                  <Image src="/iconos/flechascalendario.svg" alt="" width={24} height={24} />
                </button>
                <h2 className={styles.calendarTitle}>{calendarLabel}</h2>
                <button
                  type="button"
                  className={`${styles.calendarNavButton} ${styles.calendarNavButtonRight}`}
                  onClick={goNextMonth}
                  aria-label="Mes siguiente"
                >
                  <Image src="/iconos/flechascalendario.svg" alt="" width={24} height={24} />
                </button>
              </div>
              <div className={styles.calendar}>
                <Calendar
                  activeStartDate={activeMonth}
                  value={highlightedRange}
                  selectRange
                  view="month"
                  showNavigation={false}
                  locale="en-US"
                  tileClassName={({ date, view }) => {
                    if (view === "month" && isSameDay(date, upcomingPaymentDate)) {
                      return "payment-day";
                    }
                    return undefined;
                  }}
                  tileContent={({ date, view }) => {
                    if (view === "month" && isSameDay(date, upcomingPaymentDate)) {
                      return (
                        <Popover open={isPaymentPopoverOpen} onOpenChange={setIsPaymentPopoverOpen}>
                          <PopoverTrigger asChild>
                            <span
                              className={styles.paymentAnchor}
                              onMouseEnter={() => setIsPaymentPopoverOpen(true)}
                              onMouseLeave={() => setIsPaymentPopoverOpen(false)}
                              onFocus={() => setIsPaymentPopoverOpen(true)}
                              onBlur={() => setIsPaymentPopoverOpen(false)}
                              aria-label="Ver próximo pago"
                            />
                          </PopoverTrigger>
                          <PopoverContent
                            side="top"
                            align="center"
                            sideOffset={8}
                            className={styles.paymentPopoverContent}
                            onMouseEnter={() => setIsPaymentPopoverOpen(true)}
                            onMouseLeave={() => setIsPaymentPopoverOpen(false)}
                          >
                            Próximo pago: Factura de luz
                          </PopoverContent>
                        </Popover>
                      );
                    }
                    return null;
                  }}
                  onActiveStartDateChange={({ activeStartDate }) => {
                    if (activeStartDate) {
                      setActiveMonth(activeStartDate);
                    }
                  }}
                  formatShortWeekday={(_, date) =>
                    date.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2)
                  }
                />
              </div>
            </Card>

            <Card className={styles.bottomCardMaroon}>
              <h2 className={styles.pieTitle}>Resumen visual</h2>
              <div className={styles.pieWrap}>
                <div className={styles.pieChartWrap}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={84}
                        innerRadius={0}
                      >
                        {pieData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => `${value}%`}
                        itemStyle={{ color: "#000000" }}
                        labelStyle={{ color: "#000000" }}
                        contentStyle={{ borderRadius: "10px" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <ul className={styles.pieLegend}>
                  {pieData.map((entry) => (
                    <li key={entry.name} className={styles.legendItem}>
                      <span
                        className={`${styles.dot} ${entry.name === "Compras" ? styles.dotOutlined : ""}`}
                        style={entry.name === "Compras" ? undefined : { background: entry.color }}
                      />
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






