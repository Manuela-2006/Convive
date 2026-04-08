"use client";

import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import type { DatesSetArg, EventInput } from "@fullcalendar/core";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import styles from "./calendario-screen.module.css";

type CalendarioScreenProps = {
  houseCode: string;
};

const weekdayMap = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

const calendarEvents: EventInput[] = [
  { title: "Compra", date: "2026-03-12", className: "mini-event" },
  { title: "Pagar alquiler", date: "2026-03-28", className: "rent-event" },
];

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" })
    .format(date)
    .toUpperCase();
}

export function CalendarioScreen({ houseCode }: CalendarioScreenProps) {
  const calendarRef = useRef<FullCalendar | null>(null);
  const [currentDate, setCurrentDate] = useState<Date>(new Date(2026, 2, 1));

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
          <Link href={`/dashboard/${houseCode}/menu`} className={styles.backLink}>
            <Image src="/iconos/flechaatras.svg" alt="Volver" width={20} height={20} className={styles.backIcon} />
          </Link>
          <div className={styles.headerCenter}>
            <h1 className={styles.title}>Calendario</h1>
            <p className={styles.subtitle}>Organización de eventos y pagos</p>
          </div>
          <span />
        </header>

        <div className={styles.content}>
          <div className={styles.calendarHead}>
            <button type="button" className={styles.navBtn} onClick={goPrev} aria-label="Mes anterior">
              ‹
            </button>
            <h2 className={styles.monthTitle}>{currentLabel}</h2>
            <button type="button" className={styles.navBtn} onClick={goNext} aria-label="Mes siguiente">
              ›
            </button>
          </div>

          <div className={styles.calendarWrap}>
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              initialDate="2026-03-01"
              headerToolbar={false}
              showNonCurrentDates={false}
              fixedWeekCount={false}
              events={calendarEvents}
              datesSet={onDatesSet}
              dayHeaderContent={(arg) => weekdayMap[arg.date.getDay()]}
              dayCellContent={(arg) => <span className={styles.dayNumber}>{arg.dayNumberText.replace(/\D/g, "")}</span>}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
