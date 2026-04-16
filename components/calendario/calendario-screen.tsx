"use client";

import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import type { DatesSetArg, EventContentArg, EventInput } from "@fullcalendar/core";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import styles from "./calendario-screen.module.css";

type CalendarioScreenProps = {
  houseCode: string;
  dashboardPath: string;
};

const weekdayMap = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

const calendarEvents: EventInput[] = [
  { title: "Compra", date: "2026-03-12", className: "mini-event" },
  {
    title: "Pagar alquiler",
    start: "2026-03-28",
    end: "2026-03-31",
    allDay: true,
    className: "rent-event",
  },
];

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" })
    .format(date)
    .toUpperCase();
}

function renderCalendarEventContent(arg: EventContentArg) {
  const isMultiDay =
    !!arg.event.start &&
    !!arg.event.end &&
    arg.event.end.getTime() - arg.event.start.getTime() > 24 * 60 * 60 * 1000;

  if (isMultiDay) {
    return (
      <span className={styles.rentEventContent}>
        <span className={styles.rentEventText}>{arg.event.title}</span>
      </span>
    );
  }

  return <span className={styles.defaultEventText}>{arg.event.title}</span>;
}

export function CalendarioScreen({
  houseCode,
  dashboardPath,
}: CalendarioScreenProps) {
  const calendarRef = useRef<FullCalendar | null>(null);
  const [currentDate, setCurrentDate] = useState<Date>(new Date(2026, 2, 1));
  const basePath = dashboardPath;

  const currentLabel = useMemo(() => monthLabel(currentDate), [currentDate]);

  const goPrev = () => calendarRef.current?.getApi().prev();
  const goNext = () => calendarRef.current?.getApi().next();

  const onDatesSet = (arg: DatesSetArg) => {
    setCurrentDate(arg.view.currentStart);
  };

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <header className={styles.header}>
          <Link href={`${basePath}/menu`} className={styles.backLink}>
            <Image src="/iconos/flechaatras.svg" alt="Volver" width={20} height={20} className={styles.backIcon} />
          </Link>
          <div className={styles.headerCenter}>
            <h1 className={styles.title}>Calendario</h1>
            <p className={styles.subtitle}>Organizacion de eventos y pagos</p>
          </div>
          <span />
        </header>

        <div className={styles.content}>
          <div className={styles.calendarCard}>
            <div className={styles.calendarHead}>
              <button type="button" className={styles.navBtn} onClick={goPrev} aria-label="Mes anterior">
                <Image
                  src="/iconos/flechascalendario.svg"
                  alt=""
                  width={22}
                  height={22}
                  className={styles.navIcon}
                />
              </button>
              <h2 className={styles.monthTitle}>{currentLabel}</h2>
              <button type="button" className={styles.navBtn} onClick={goNext} aria-label="Mes siguiente">
                <Image
                  src="/iconos/flechascalendario.svg"
                  alt=""
                  width={22}
                  height={22}
                  className={`${styles.navIcon} ${styles.navIconNext}`}
                />
              </button>
            </div>

            <div className={styles.calendarWrap}>
              <FullCalendar
                ref={calendarRef}
                plugins={[dayGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                initialDate="2026-03-01"
                height="auto"
                contentHeight="auto"
                firstDay={1}
                headerToolbar={false}
                showNonCurrentDates={false}
                fixedWeekCount={false}
                events={calendarEvents}
                eventContent={renderCalendarEventContent}
                datesSet={onDatesSet}
                dayHeaderContent={(arg) => weekdayMap[arg.date.getDay()]}
                dayCellContent={(arg) => <span className={styles.dayNumber}>{arg.dayNumberText.replace(/\D/g, "")}</span>}
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

