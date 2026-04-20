"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Button } from "../ui/button";
import { Calendar } from "../ui/calendar";
import { Card } from "../ui/card";
import { Checkbox } from "../ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { TicketUploader } from "../ui/ticket-uploader";
import styles from "./facturas-add-screen.module.css";
import type { TicketScannerData } from "../../lib/ticket-scanner-types";

type FacturasAddScreenProps = {
  houseCode: string;
  dashboardPath: string;
};

function formatDate(date?: Date) {
  if (!date) {
    const now = new Date();
    const day = `${now.getDate()}`.padStart(2, "0");
    const month = `${now.getMonth() + 1}`.padStart(2, "0");
    const year = now.getFullYear();
    return `${day}/${month}/${year}`;
  }
  const day = `${date.getDate()}`.padStart(2, "0");
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

type BillType = "alquiler" | "suscripciones" | "wifi" | "agua" | "luz";

function parseScannerDate(value?: string | null): Date | undefined {
  if (!value) return undefined;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!match) return undefined;
  const [, dd, mm, yyyy] = match;
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

function getLastDayOfMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function inferInvoiceDate(periodo?: string | null): Date | undefined {
  if (!periodo) return undefined;

  const normalized = periodo.replace(/\s+/g, " ").trim();

  const dateMatches = normalized.match(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g);
  if (dateMatches?.length) {
    const parsedDates = dateMatches
      .map((rawDate) => parseScannerDate(rawDate))
      .filter((value): value is Date => !!value)
      .sort((a, b) => a.getTime() - b.getTime());

    if (parsedDates.length) {
      return parsedDates[parsedDates.length - 1];
    }
  }

  const monthlyChargeMatch =
    /\b(?:dia|d[ií]a)\s*(\d{1,2})\s*de cada mes\b/i.exec(normalized);
  if (!monthlyChargeMatch) {
    return undefined;
  }

  const requestedDay = Number(monthlyChargeMatch[1]);
  if (!Number.isFinite(requestedDay) || requestedDay <= 0) {
    return undefined;
  }

  const now = new Date();
  const maxDayInMonth = getLastDayOfMonth(now.getFullYear(), now.getMonth());
  const safeDay = Math.min(requestedDay, maxDayInMonth);
  const inferredDate = new Date(now.getFullYear(), now.getMonth(), safeDay);

  return Number.isNaN(inferredDate.getTime()) ? undefined : inferredDate;
}

export function FacturasAddScreen({
  houseCode,
  dashboardPath,
}: FacturasAddScreenProps) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [billType, setBillType] = useState<BillType>("alquiler");
  const [totalAmount, setTotalAmount] = useState("");
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const basePath = dashboardPath;

  const handleScanComplete = (data: TicketScannerData) => {
    if (data.tipo === "desconocido") {
      setScanMessage("No se detecto ticket ni factura en el archivo.");
      return;
    }

    const parsedDate = parseScannerDate(data.fecha) ?? inferInvoiceDate(data.periodo);
    setDate(parsedDate ?? new Date());

    if (data.tipo === "factura" && data.categoria) {
      const categoryMap: Record<string, BillType> = {
        alquiler: "alquiler",
        wifi: "wifi",
        agua: "agua",
        luz: "luz",
        gas: "suscripciones",
        otro: "suscripciones",
      };
      const mappedType = categoryMap[data.categoria];
      if (mappedType) {
        setBillType(mappedType);
      }
    }

    if (typeof data.importe_total === "number" && Number.isFinite(data.importe_total)) {
      setTotalAmount(data.importe_total.toFixed(2));
    }

    setScanMessage("Datos detectados y cargados en el formulario.");
  };

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <header className={styles.header}>
          <Link href={`${basePath}/facturas`} className={styles.backLink}>
            <Image src="/iconos/flechaatras.svg" alt="Volver" width={20} height={20} className={styles.backIcon} />
          </Link>
          <div className={styles.headerCenter}>
            <h1 className={styles.title}>Facturas</h1>
            <p className={styles.subtitle}>Gestiona las facturas del piso de forma clara</p>
          </div>
          <span />
        </header>

        <div className={styles.content}>
          <Card className={styles.card}>
            <div className={styles.cardTop}>
              <Link href={`${basePath}/facturas`} className={styles.inlineBack} aria-label="Volver a facturas">
                <Image src="/iconos/flechaatras.svg" alt="" width={32} height={32} />
              </Link>
              <h2 className={styles.cardTitle}>Añadir factura</h2>
            </div>

            <section className={styles.block}>
              <h3 className={styles.blockTitle}>1 - Adjunta la factura</h3>
              <TicketUploader
                onScanComplete={handleScanComplete}
                className={styles.uploadBox}
                minHeight={190}
              />
              {scanMessage ? <p className={styles.scanMessage}>{scanMessage}</p> : null}
            </section>

            <section className={styles.block}>
              <h3 className={styles.blockTitle}>2 - Elige que tipo de factura es</h3>
              <div className={styles.typesRow}>
                <label className={styles.typeItem}>
                  <Checkbox
                    className={styles.checkbox}
                    checked={billType === "alquiler"}
                    onCheckedChange={(checked) => {
                      if (checked) setBillType("alquiler");
                    }}
                  />
                  Alquiler
                </label>
                <label className={styles.typeItem}>
                  <Checkbox
                    className={styles.checkbox}
                    checked={billType === "suscripciones"}
                    onCheckedChange={(checked) => {
                      if (checked) setBillType("suscripciones");
                    }}
                  />
                  Suscripciones
                </label>
                <label className={styles.typeItem}>
                  <Checkbox
                    className={styles.checkbox}
                    checked={billType === "wifi"}
                    onCheckedChange={(checked) => {
                      if (checked) setBillType("wifi");
                    }}
                  />
                  Wifi
                </label>
                <label className={styles.typeItem}>
                  <Checkbox
                    className={styles.checkbox}
                    checked={billType === "agua"}
                    onCheckedChange={(checked) => {
                      if (checked) setBillType("agua");
                    }}
                  />
                  Agua
                </label>
                <label className={styles.typeItem}>
                  <Checkbox
                    className={styles.checkbox}
                    checked={billType === "luz"}
                    onCheckedChange={(checked) => {
                      if (checked) setBillType("luz");
                    }}
                  />
                  Luz
                </label>
              </div>
            </section>

            <section className={styles.block}>
              <h3 className={styles.blockTitle}>3 - Selecciona los miembros del piso</h3>
              <div className={styles.membersCol}>
                <label className={styles.memberRow}>
                  <Checkbox className={styles.checkbox} />
                  <Image src="/images/IconoperfilM.webp" alt="" width={22} height={22} />
                  Antonio
                </label>
                <label className={styles.memberRow}>
                  <Checkbox className={styles.checkbox} />
                  <Image src="/images/IconoperfilM.webp" alt="" width={22} height={22} />
                  Juan
                </label>
                <label className={styles.memberRow}>
                  <Checkbox className={styles.checkbox} />
                  <Image src="/images/IconoperfilM.webp" alt="" width={22} height={22} />
                  Alvaro
                </label>
              </div>
            </section>

            <section className={styles.block}>
              <h3 className={styles.blockTitle}>4 - Fecha de factura</h3>
              <Popover>
                <PopoverTrigger asChild>
                  <Button className={styles.dateTrigger}>
                    {formatDate(date)}
                    <Image src="/iconos/flechascalendario.svg" alt="" width={14} height={14} className={styles.dateArrow} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className={styles.calendarPopover}>
                  <Calendar mode="single" selected={date} onSelect={setDate} className={styles.calendar} />
                </PopoverContent>
              </Popover>
            </section>

            <section className={styles.block}>
              <h3 className={styles.blockTitle}>5 - Total de la factura o ticket</h3>
              <div className={styles.totalFieldWrap}>
                <input
                  className={styles.totalInput}
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={totalAmount}
                  onChange={(event) => setTotalAmount(event.target.value)}
                  placeholder="0,00"
                />
                <span className={styles.totalCurrency}>€</span>
              </div>
            </section>

            <div className={styles.saveWrap}>
              <Button className={styles.saveButton}>Guardar</Button>
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}


