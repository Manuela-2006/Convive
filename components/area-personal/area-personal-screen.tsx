"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import Calendar from "react-calendar";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  adminConfirmPaymentAction,
  requestExpensePaymentConfirmationAction,
} from "../../app/backend/endpoints/gastos/actions";
import type {
  PersonalAreaCalendarEvent,
  PersonalAreaDashboardData,
} from "../../lib/dashboard-types";
import { formatCurrency } from "../../lib/dashboard-presenters";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { ProfileAvatar } from "../ui/profile-avatar";
import styles from "./area-personal-screen.module.css";

type AreaPersonalScreenProps = {
  houseCode: string;
  dashboardPath: string;
  data: PersonalAreaDashboardData;
};

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

const chartColors = ["#F0EAE4", "#C47A93", "#8B1A2F", "#D7B9C3"];

function toNumber(value: number | string | null | undefined) {
  const numericValue =
    typeof value === "number" ? value : Number(String(value ?? 0));

  return Number.isFinite(numericValue) ? numericValue : 0;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMonthlyMeta(current: number, previous: number) {
  if (previous <= 0) {
    return current > 0 ? "Sin mes anterior" : "Sin gastos este mes";
  }

  const percent = Math.round(((current - previous) / previous) * 100);
  if (percent === 0) {
    return "Igual que el mes anterior";
  }

  return `${percent > 0 ? "+" : ""}${percent}% que el mes anterior`;
}

function formatPendingPaymentsMeta(countValue: number | string | null | undefined) {
  const count = Math.max(0, Math.trunc(toNumber(countValue)));
  return `${count} ${count === 1 ? "pago pendiente" : "pagos pendientes"}`;
}

function buildChartData(data: PersonalAreaDashboardData) {
  const total = data.chart.reduce((sum, item) => sum + toNumber(item.amount), 0);

  return data.chart.map((item, index) => ({
    name: item.name,
    amount: toNumber(item.amount),
    value: total > 0 ? Math.round((toNumber(item.amount) / total) * 100) : 0,
    color: chartColors[index % chartColors.length],
  }));
}

export function AreaPersonalScreen({
  houseCode,
  dashboardPath,
  data,
}: AreaPersonalScreenProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [activeMonth, setActiveMonth] = useState(new Date());
  const [activeCalendarDate, setActiveCalendarDate] = useState<string | null>(null);
  const basePath = dashboardPath;

  const monthlyTotal = toNumber(data.summary.monthly_spending_total);
  const previousMonthlyTotal = toNumber(
    data.summary.previous_month_spending_total
  );
  const summaryCards = [
    {
      title: "Mis deudas",
      value: formatCurrency(data.summary.my_debts_total),
      meta: formatPendingPaymentsMeta(data.summary.my_debts_count),
    },
    {
      title: "Me deben",
      value: formatCurrency(data.summary.owed_to_me_total),
      meta: formatPendingPaymentsMeta(data.summary.owed_to_me_count),
    },
    {
      title: "Gastos del mes",
      value: formatCurrency(data.summary.monthly_spending_total),
      meta: formatMonthlyMeta(monthlyTotal, previousMonthlyTotal),
    },
  ];
  const chartData = useMemo(() => buildChartData(data), [data]);
  const calendarEventsByDate = useMemo(() => {
    const eventsByDate = new Map<string, PersonalAreaCalendarEvent[]>();

    for (const event of data.calendar_events) {
      if (!event.event_date) continue;
      eventsByDate.set(event.event_date, [
        ...(eventsByDate.get(event.event_date) ?? []),
        event,
      ]);
    }

    return eventsByDate;
  }, [data.calendar_events]);
  const calendarLabel = `${MONTH_NAMES[activeMonth.getMonth()]} / ${activeMonth.getFullYear()}`;
  const previewHistory = data.history.slice(0, 2);

  const runAction = (action: () => Promise<boolean>) => {
    setFeedbackMessage(null);
    startTransition(async () => {
      const shouldRefresh = await action();
      if (shouldRefresh) {
        router.refresh();
      }
    });
  };

  const handleRequestPaymentConfirmation = (expenseId: string) => {
    runAction(async () => {
      const result = await requestExpensePaymentConfirmationAction({
        houseCode,
        dashboardPath: basePath,
        expenseId,
      });

      if (result.success) {
        setFeedbackMessage(
          result.data.status === "completed_self"
            ? "Tu parte ha quedado marcada como pagada."
            : "Tu pago ha quedado pendiente de revision."
        );
        return true;
      }

      if ("error" in result) {
        setFeedbackMessage(result.error);
      }
      return false;
    });
  };

  const handleVerifyPayment = (paymentId: string) => {
    runAction(async () => {
      const result = await adminConfirmPaymentAction({
        houseCode,
        dashboardPath: basePath,
        paymentId,
      });

      if (result.success) {
        setFeedbackMessage("Pago verificado correctamente.");
        return true;
      }

      if ("error" in result) {
        setFeedbackMessage(result.error);
      }
      return false;
    });
  };

  const goPrevMonth = () => {
    setActiveMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)
    );
  };

  const goNextMonth = () => {
    setActiveMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)
    );
  };

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

          {feedbackMessage ? (
            <p className={styles.feedbackMessage}>{feedbackMessage}</p>
          ) : null}

          <Card id="mis-deudas" className={styles.sectionCard}>
            <h2 className={styles.sectionHeader}>Mis deudas</h2>
            <div className={`${styles.rows} ${styles.debtsRows}`}>
              {data.debts.length ? (
                data.debts.map((debt) => {
                  const hasPendingConfirmation =
                    debt.status === "pending_confirmation" || debt.payment_id;
                  const isSettlement = debt.status === "settlement";

                  return (
                    <div className={styles.row} key={debt.expense_id}>
                      <div className={styles.person}>
                        <ProfileAvatar
                          src={debt.person_avatar_url}
                          alt="Perfil"
                          width={22}
                          height={22}
                          className={styles.avatar}
                        />
                        <div>
                          <p className={styles.personLine}>{debt.person_name}</p>
                          <p className={styles.personSub}>{debt.title}</p>
                        </div>
                      </div>
                      <p className={styles.amount}>
                        {formatCurrency(debt.amount, debt.currency)}
                      </p>
                      {isSettlement ? (
                        <Link
                          className={styles.actionButton}
                          href={`${basePath}/gastos/simplificar/pago-simplificado`}
                        >
                          Optimizar
                        </Link>
                      ) : (
                        <Button
                          className={styles.actionButton}
                          disabled={isPending || Boolean(hasPendingConfirmation)}
                          onClick={() =>
                            !hasPendingConfirmation
                              ? handleRequestPaymentConfirmation(debt.expense_id)
                              : undefined
                          }
                        >
                          {hasPendingConfirmation ? "Pendiente" : "Confirmar pago"}
                        </Button>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className={styles.emptyState}>No tienes deudas pendientes.</p>
              )}
            </div>
          </Card>

          <Card className={styles.sectionCard}>
            <h2 className={styles.sectionHeader}>Me deben</h2>
            <div className={`${styles.rows} ${styles.debtsRows}`}>
              {data.receivables.length ? (
                data.receivables.map((receivable) => (
                  <div
                    className={styles.row}
                    key={`${receivable.expense_id}-${receivable.person_name}`}
                  >
                    <div className={styles.person}>
                      <ProfileAvatar
                        src={receivable.person_avatar_url}
                        alt="Perfil"
                        width={22}
                        height={22}
                        className={styles.avatar}
                      />
                      <div>
                        <p className={styles.personLine}>
                          {receivable.person_name}
                        </p>
                        <p className={styles.personSub}>{receivable.title}</p>
                      </div>
                    </div>
                    <p className={styles.amount}>
                      {formatCurrency(receivable.amount, receivable.currency)}
                    </p>
                    {receivable.payment_id && receivable.can_verify ? (
                      <Button
                        className={styles.actionButton}
                        disabled={isPending}
                        onClick={() =>
                          receivable.payment_id
                            ? handleVerifyPayment(receivable.payment_id)
                            : undefined
                        }
                      >
                        Verificar pago
                      </Button>
                    ) : (
                      <span className={styles.statusBadge}>Pendiente</span>
                    )}
                  </div>
                ))
              ) : (
                <p className={styles.emptyState}>No hay importes pendientes a tu favor.</p>
              )}
            </div>
          </Card>

          <Card className={styles.sectionCard}>
            <div className={styles.historyTop}>
              <h2 className={styles.sectionHeader}>Historial</h2>
              <Link href={`${basePath}/area-personal/historial`} className={styles.viewAll}>
                <span className={styles.viewAllContent}>
                  VER TODO
                  <Image
                    src="/iconos/flechascalendario.svg"
                    alt=""
                    width={20}
                    height={20}
                    className={styles.viewAllArrow}
                  />
                </span>
              </Link>
            </div>
            <div className={`${styles.rows} ${styles.historyRows}`}>
              {previewHistory.length ? (
                previewHistory.map((item) => (
                  <div className={`${styles.row} ${styles.historyRow}`} key={`${item.item_type}-${item.item_id}`}>
                    <div className={styles.person}>
                      <Image
                        src={item.icon_type === "purchase" ? "/iconos/Carrodecompra.svg" : "/iconos/euro.svg"}
                        alt=""
                        width={22}
                        height={22}
                      />
                      <div>
                        <p className={styles.personLine}>{item.title}</p>
                        <p className={styles.personSub}>{item.subtitle}</p>
                      </div>
                    </div>
                    <p className={styles.historyRightAmount}>
                      {formatCurrency(item.amount, item.currency)}
                    </p>
                    <span className={`${styles.actionButton} ${styles.historyRightSpacer}`} aria-hidden="true">
                      Verificar pago
                    </span>
                  </div>
                ))
              ) : (
                <p className={styles.emptyState}>No hay movimientos personales.</p>
              )}
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
                  value={null}
                  view="month"
                  showNavigation={false}
                  locale="en-US"
                  tileClassName={({ date, view }) => {
                    if (view === "month" && calendarEventsByDate.has(toDateKey(date))) {
                      return "payment-day";
                    }
                    return undefined;
                  }}
                  tileContent={({ date, view }) => {
                    const dateKey = toDateKey(date);
                    const events = calendarEventsByDate.get(dateKey) ?? [];
                    if (view !== "month" || !events.length) {
                      return null;
                    }

                    const firstEvent = events[0];
                    return (
                      <Popover
                        open={activeCalendarDate === dateKey}
                        onOpenChange={(open) =>
                          setActiveCalendarDate(open ? dateKey : null)
                        }
                      >
                        <PopoverTrigger asChild>
                          <span
                            className={styles.paymentAnchor}
                            onMouseEnter={() => setActiveCalendarDate(dateKey)}
                            onMouseLeave={() => setActiveCalendarDate(null)}
                            onFocus={() => setActiveCalendarDate(dateKey)}
                            onBlur={() => setActiveCalendarDate(null)}
                            aria-label="Ver evento personal"
                          />
                        </PopoverTrigger>
                        <PopoverContent
                          side="top"
                          align="center"
                          sideOffset={8}
                          className={styles.paymentPopoverContent}
                          onMouseEnter={() => setActiveCalendarDate(dateKey)}
                          onMouseLeave={() => setActiveCalendarDate(null)}
                        >
                          <span className={styles.popoverLine}>
                            {firstEvent.person_avatar_url ? (
                              <ProfileAvatar
                                src={firstEvent.person_avatar_url}
                                alt=""
                                width={14}
                                height={14}
                              />
                            ) : (
                              <Image
                                src="/iconos/euro.svg"
                                alt=""
                                width={14}
                                height={14}
                              />
                            )}
                            {firstEvent.title} ·{" "}
                            {formatCurrency(firstEvent.amount, firstEvent.currency)}
                          </span>
                        </PopoverContent>
                      </Popover>
                    );
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
                {chartData.length ? (
                  <>
                    <div className={styles.pieChartWrap}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={84}
                            innerRadius={0}
                          >
                            {chartData.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(_, name) => {
                              const entry = chartData.find((item) => item.name === name);
                              return entry
                                ? formatCurrency(entry.amount)
                                : formatCurrency(0);
                            }}
                            itemStyle={{ color: "#000000" }}
                            labelStyle={{ color: "#000000" }}
                            contentStyle={{ borderRadius: "10px" }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <ul className={styles.pieLegend}>
                      {chartData.map((entry) => (
                        <li key={entry.name} className={styles.legendItem}>
                          <span
                            className={`${styles.dot} ${entry.name === "Compras" ? styles.dotOutlined : ""}`}
                            style={entry.name === "Compras" ? undefined : { background: entry.color }}
                          />
                          {entry.name}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className={styles.emptyStateDark}>Sin gastos personales este mes.</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </section>
    </main>
  );
}
