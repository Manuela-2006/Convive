"use client";

import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import type {
  DatesSetArg,
  EventClickArg,
  EventContentArg,
  EventInput,
} from "@fullcalendar/core";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type {
  CleaningTask,
  ExpenseTicket,
  Invoice,
  PendingPaymentConfirmation,
  SharedExpense,
} from "../../lib/dashboard-types";
import styles from "./calendario-screen.module.css";

type CalendarioScreenProps = {
  houseCode: string;
  dashboardPath: string;
  tickets: ExpenseTicket[];
  sharedExpenses: SharedExpense[];
  invoices: Invoice[];
  cleaningTasks: CleaningTask[];
  pendingPayments: PendingPaymentConfirmation[];
};

type CalendarItemType = "ticket" | "gasto" | "factura" | "limpieza" | "pago";

type CalendarItem = {
  id: string;
  title: string;
  type: CalendarItemType;
  date: string;
  sourceId?: string | null;
  amount?: number | string | null;
  currency?: string | null;
  category?: string | null;
  person?: string | null;
  notes?: string | null;
  status?: string | null;
  completedAt?: string | null;
  visualStatus: "pending" | "completed";
};

const weekdayMap = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

const typeLabels: Record<CalendarItemType, string> = {
  ticket: "Ticket",
  gasto: "Gasto",
  factura: "Factura",
  limpieza: "Limpieza",
  pago: "Pago",
};

const spanishLabelByEnglish = new Map<string, string>([
  ["water bill", "Factura agua"],
  ["electricity bill", "Factura luz"],
  ["power bill", "Factura luz"],
  ["light bill", "Factura luz"],
  ["internet bill", "Factura wifi"],
  ["wifi bill", "Factura wifi"],
  ["gas bill", "Factura gas"],
  ["rent", "Alquiler"],
  ["rent payment", "Alquiler"],
  ["cleaning task", "Tarea de limpieza"],
  ["shared expense", "Gasto compartido"],
  ["pending payment", "Pago pendiente"],
]);

const completedStatuses = new Set([
  "paid",
  "pagada",
  "pagado",
  "completed",
  "complete",
  "completed_self",
  "settled",
  "liquidada",
  "liquidado",
  "closed",
  "done",
  "archived",
]);

const pendingStatuses = new Set([
  "pending",
  "open",
  "unpaid",
  "por pagar",
  "pendiente",
]);

const displayStatusLabels = new Map<string, string>([
  ["open", "Pendiente"],
  ["pending", "Pendiente"],
  ["unpaid", "Pendiente de pago"],
  ["por pagar", "Pendiente de pago"],
  ["pendiente", "Pendiente"],
  ["completed", "Completado"],
  ["complete", "Completado"],
  ["completed self", "Completado"],
  ["done", "Hecho"],
  ["paid", "Pagado"],
  ["pagada", "Pagado"],
  ["pagado", "Pagado"],
  ["partially paid", "Parcialmente pagado"],
  ["partial paid", "Parcialmente pagado"],
  ["settled", "Liquidado"],
  ["liquidada", "Liquidado"],
  ["liquidado", "Liquidado"],
  ["closed", "Cerrado"],
  ["cancelled", "Cancelado"],
  ["canceled", "Cancelado"],
  ["rejected", "Rechazado"],
  ["archived", "Archivado"],
]);

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" })
    .format(date)
    .toUpperCase();
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ");
}

function normalizeKey(value: string) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function toSpanishLabel(value: string) {
  const normalized = normalizeText(value);
  return spanishLabelByEnglish.get(normalized) ?? value;
}

function toSentenceCase(value: string) {
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned) return "";
  return `${cleaned.charAt(0).toUpperCase()}${cleaned.slice(1).toLowerCase()}`;
}

function formatDisplayStatus(status?: string | null) {
  if (!status?.trim()) {
    return null;
  }

  const normalized = normalizeText(status);
  return displayStatusLabels.get(normalized) ?? toSentenceCase(normalized);
}

function isEnglishFallback(value: string) {
  return spanishLabelByEnglish.has(normalizeText(value));
}

function pickSpanishText(first: string, second: string) {
  if (isEnglishFallback(first) && !isEnglishFallback(second)) {
    return second;
  }

  if (!isEnglishFallback(first) && isEnglishFallback(second)) {
    return first;
  }

  return first.length >= second.length ? first : second;
}

function normalizeAmountKey(value?: number | string | null) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const amount =
    typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(amount) ? amount.toFixed(2) : String(value).trim();
}

function isPresentId(value: string | null | undefined) {
  return !!value?.trim();
}

function resolveVisualStatus(
  status?: string | null,
  completedAt?: string | null
): "pending" | "completed" {
  if (completedAt?.trim()) {
    return "completed";
  }

  const normalizedStatus = normalizeText(status ?? "");
  if (completedStatuses.has(normalizedStatus)) {
    return "completed";
  }

  if (pendingStatuses.has(normalizedStatus) || !normalizedStatus) {
    return "pending";
  }

  return "pending";
}

function toCalendarDate(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const datePrefix = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);
  if (datePrefix) {
    return datePrefix[1];
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const year = parsed.getUTCFullYear();
  const month = `${parsed.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${parsed.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return value;
  }

  return `${`${day}`.padStart(2, "0")}/${`${month}`.padStart(2, "0")}/${year}`;
}

function formatAmount(value?: number | string | null, currency = "EUR") {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const amount = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(amount)) {
    return `${value} ${currency}`;
  }

  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
  }).format(amount);
}

function mergeCalendarItems(
  current: CalendarItem,
  incoming: CalendarItem
): CalendarItem {
  const typeRank: Record<CalendarItemType, number> = {
    factura: 5,
    gasto: 4,
    limpieza: 4,
    ticket: 3,
    pago: 2,
  };
  const preferredBase =
    typeRank[incoming.type] > typeRank[current.type] ? incoming : current;
  const title = pickSpanishText(current.title, incoming.title);
  const category =
    current.category && incoming.category
      ? pickSpanishText(current.category, incoming.category)
      : current.category ?? incoming.category;
  const visualStatus: CalendarItem["visualStatus"] =
    current.visualStatus === "completed" || incoming.visualStatus === "completed"
      ? "completed"
      : "pending";

  return {
    ...preferredBase,
    title,
    amount: current.amount ?? incoming.amount,
    currency: current.currency ?? incoming.currency,
    category,
    person: current.person ?? incoming.person,
    notes: current.notes ?? incoming.notes,
    status: current.status ?? incoming.status,
    completedAt: current.completedAt ?? incoming.completedAt,
    visualStatus,
  };
}

function getCalendarIdentityKeys(item: CalendarItem) {
  const keys: string[] = [];

  if (item.sourceId?.trim()) {
    keys.push(`source:${item.sourceId}:${item.date}`);
  }

  keys.push(
    [
      "content",
      item.date,
      normalizeAmountKey(item.amount),
      normalizeKey(toSpanishLabel(item.title)),
      item.category ? normalizeKey(toSpanishLabel(item.category)) : "",
    ].join("|")
  );

  return keys;
}

function dedupeCalendarItems(items: CalendarItem[]) {
  const canonicalItems = new Map<string, CalendarItem>();
  const identityAliases = new Map<string, string>();

  for (const rawItem of items) {
    const item = {
      ...rawItem,
      title: toSpanishLabel(rawItem.title),
      category: rawItem.category ? toSpanishLabel(rawItem.category) : rawItem.category,
    };
    const identityKeys = getCalendarIdentityKeys(item);
    const canonicalId =
      identityKeys.map((key) => identityAliases.get(key)).find(Boolean) ??
      identityKeys[0] ??
      item.id;
    const current = canonicalItems.get(canonicalId);
    const nextItem = current ? mergeCalendarItems(current, item) : item;

    canonicalItems.set(canonicalId, nextItem);
    for (const key of identityKeys) {
      identityAliases.set(key, canonicalId);
    }
  }

  return [...canonicalItems.values()].sort(
    (first, second) =>
      first.date.localeCompare(second.date) ||
      first.title.localeCompare(second.title, "es")
  );
}

function buildCalendarItems({
  tickets,
  sharedExpenses,
  invoices,
  cleaningTasks,
  pendingPayments,
}: Omit<CalendarioScreenProps, "houseCode" | "dashboardPath">) {
  const invoiceExpenseIds = new Set(
    invoices.map((invoice) => invoice.expense_id).filter(isPresentId)
  );
  const sharedExpenseIds = new Set(
    sharedExpenses.map((expense) => expense.expense_id).filter(isPresentId)
  );
  const representedExpenseIds = new Set([
    ...invoiceExpenseIds,
    ...sharedExpenseIds,
  ]);

  const ticketItems = tickets.flatMap((ticket): CalendarItem[] => {
    if (ticket.expense_id && representedExpenseIds.has(ticket.expense_id)) {
      return [];
    }

    const date = toCalendarDate(ticket.purchase_date);
    if (!date) return [];
    return [
      {
        id: `ticket-${ticket.ticket_id}`,
        title: toSpanishLabel(ticket.display_title || ticket.merchant || "Ticket"),
        type: "ticket",
        date,
        sourceId: ticket.expense_id ?? ticket.ticket_id,
        amount: ticket.total_amount,
        currency: ticket.currency,
        person: ticket.paid_by_name,
        status: ticket.settlement_status,
        visualStatus: resolveVisualStatus(ticket.settlement_status),
      },
    ];
  });

  const sharedExpenseItems = sharedExpenses.flatMap((expense): CalendarItem[] => {
    if (invoiceExpenseIds.has(expense.expense_id)) {
      return [];
    }

    const date = toCalendarDate(expense.expense_date);
    if (!date) return [];
    return [
      {
        id: `gasto-${expense.expense_id}`,
        title: toSpanishLabel(expense.title || "Gasto compartido"),
        type: "gasto",
        date,
        sourceId: expense.expense_id,
        amount: expense.total_amount,
        currency: expense.currency,
        category: toSpanishLabel(expense.expense_type),
        person: expense.paid_by_name,
        notes: expense.participants_text,
        status: expense.settlement_status ?? expense.my_status,
        visualStatus: resolveVisualStatus(
          expense.settlement_status ?? expense.my_status
        ),
      },
    ];
  });

  const invoiceItems = invoices.flatMap((invoice): CalendarItem[] => {
    const date = toCalendarDate(invoice.invoice_date);
    if (!date) return [];
    return [
      {
        id: `factura-${invoice.expense_id}`,
        title: toSpanishLabel(invoice.title || invoice.category_name || "Factura"),
        type: "factura",
        date,
        sourceId: invoice.expense_id,
        amount: invoice.total_amount,
        currency: invoice.currency,
        category: toSpanishLabel(invoice.category_name),
        status: invoice.settlement_status,
        visualStatus: resolveVisualStatus(invoice.settlement_status),
      },
    ];
  });

  const cleaningItems = cleaningTasks.flatMap((task): CalendarItem[] => {
    const date = toCalendarDate(task.due_date);
    if (!date) return [];
    return [
      {
        id: `limpieza-${task.task_id}`,
        title: toSpanishLabel(task.title || "Tarea de limpieza"),
        type: "limpieza",
        date,
        sourceId: task.task_id,
        category: toSpanishLabel(task.zone_name),
        person: task.assigned_to_name,
        notes: task.notes,
        status: task.status,
        completedAt: task.completed_at,
        visualStatus: resolveVisualStatus(task.status, task.completed_at),
      },
    ];
  });

  const paymentItems = pendingPayments.flatMap((payment): CalendarItem[] => {
    if (payment.expense_id && representedExpenseIds.has(payment.expense_id)) {
      return [];
    }

    const date = toCalendarDate(payment.payment_date);
    if (!date) return [];
    return [
      {
        id: `pago-${payment.payment_id}`,
        title: toSpanishLabel(payment.expense_title || "Pago pendiente"),
        type: "pago",
        date,
        sourceId: payment.expense_id ?? payment.payment_id,
        amount: payment.amount,
        currency: "EUR",
        person: `${payment.from_name} -> ${payment.to_name}`,
        notes: payment.note,
        status: payment.status,
        visualStatus: resolveVisualStatus(payment.status),
      },
    ];
  });

  return dedupeCalendarItems([
    ...ticketItems,
    ...sharedExpenseItems,
    ...invoiceItems,
    ...cleaningItems,
    ...paymentItems,
  ]);
}

function renderCalendarEventContent(arg: EventContentArg) {
  if (arg.event.classNames.includes("rent-event")) {
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
  tickets,
  sharedExpenses,
  invoices,
  cleaningTasks,
  pendingPayments,
}: CalendarioScreenProps) {
  const calendarRef = useRef<FullCalendar | null>(null);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
  const basePath = dashboardPath;

  const currentLabel = useMemo(() => monthLabel(currentDate), [currentDate]);
  const calendarItems = useMemo(
    () =>
      buildCalendarItems({
        tickets,
        sharedExpenses,
        invoices,
        cleaningTasks,
        pendingPayments,
      }),
    [tickets, sharedExpenses, invoices, cleaningTasks, pendingPayments]
  );
  const calendarEvents = useMemo<EventInput[]>(
    () =>
      calendarItems.map((item) => ({
        id: item.id,
        title: item.title,
        date: item.date,
        allDay: true,
        className:
          item.type === "factura" &&
          normalizeText(item.category ?? "") === "alquiler"
            ? ["rent-event", `event-${item.visualStatus}`]
            : ["mini-event", `event-${item.visualStatus}`],
        extendedProps: { item },
      })),
    [calendarItems]
  );

  const goPrev = () => calendarRef.current?.getApi().prev();
  const goNext = () => calendarRef.current?.getApi().next();

  const onDatesSet = (arg: DatesSetArg) => {
    setCurrentDate(arg.view.currentStart);
  };

  const onEventClick = (arg: EventClickArg) => {
    const item = arg.event.extendedProps.item as CalendarItem | undefined;
    if (item) {
      setSelectedItem(item);
    }
  };

  const selectedAmount = selectedItem
    ? formatAmount(selectedItem.amount, selectedItem.currency ?? "EUR")
    : null;
  const selectedStatus = selectedItem
    ? formatDisplayStatus(selectedItem.status)
    : null;

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
                initialDate={new Date()}
                height="auto"
                contentHeight="auto"
                firstDay={1}
                headerToolbar={false}
                showNonCurrentDates={false}
                fixedWeekCount={false}
                events={calendarEvents}
                eventContent={renderCalendarEventContent}
                eventClick={onEventClick}
                datesSet={onDatesSet}
                dayMaxEvents={3}
                moreLinkContent={(arg) => `+${arg.num}`}
                dayHeaderContent={(arg) => weekdayMap[arg.date.getDay()]}
                dayCellContent={(arg) => <span className={styles.dayNumber}>{arg.dayNumberText.replace(/\D/g, "")}</span>}
              />
            </div>

            {!calendarItems.length ? (
              <p className={styles.emptyText}>No hay eventos en el calendario.</p>
            ) : null}
          </div>
        </div>
      </section>

      {selectedItem ? (
        <div
          className={styles.modalOverlay}
          role="presentation"
          onClick={() => setSelectedItem(null)}
        >
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-event-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={styles.modalClose}
              onClick={() => setSelectedItem(null)}
              aria-label="Cerrar"
            >
              x
            </button>
            <p className={styles.modalType}>{typeLabels[selectedItem.type]}</p>
            <h2 id="calendar-event-title" className={styles.modalTitle}>
              {selectedItem.title}
            </h2>
            <dl className={styles.modalDetails}>
              <div>
                <dt>Fecha</dt>
                <dd>{formatDisplayDate(selectedItem.date)}</dd>
              </div>
              {selectedAmount ? (
                <div>
                  <dt>Importe</dt>
                  <dd>{selectedAmount}</dd>
                </div>
              ) : null}
              {selectedItem.category ? (
                <div>
                  <dt>Categoria</dt>
                  <dd>{selectedItem.category}</dd>
                </div>
              ) : null}
              {selectedItem.person ? (
                <div>
                  <dt>Persona</dt>
                  <dd>{selectedItem.person}</dd>
                </div>
              ) : null}
              {selectedStatus ? (
                <div>
                  <dt>Estado</dt>
                  <dd>{selectedStatus}</dd>
                </div>
              ) : null}
              {selectedItem.notes ? (
                <div>
                  <dt>Notas</dt>
                  <dd>{selectedItem.notes}</dd>
                </div>
              ) : null}
            </dl>
          </section>
        </div>
      ) : null}
    </main>
  );
}

