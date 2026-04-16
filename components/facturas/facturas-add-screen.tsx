"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Button } from "../ui/button";
import { Calendar } from "../ui/calendar";
import { Card } from "../ui/card";
import { Checkbox } from "../ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import styles from "./facturas-add-screen.module.css";

type FacturasAddScreenProps = {
  houseCode: string;
  dashboardPath: string;
};

function formatDate(date?: Date) {
  if (!date) return "21/02/2026";
  const day = `${date.getDate()}`.padStart(2, "0");
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function FacturasAddScreen({
  houseCode,
  dashboardPath,
}: FacturasAddScreenProps) {
  const [date, setDate] = useState<Date | undefined>(new Date(2026, 1, 21));
  const basePath = dashboardPath;

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
              <div className={styles.uploadBox}>
                <Image src="/iconos/Escanearimagen.svg" alt="Subir imagen" width={48} height={48} />
              </div>
            </section>

            <section className={styles.block}>
              <h3 className={styles.blockTitle}>2 - Elige que tipo de factura es</h3>
              <div className={styles.typesRow}>
                <label className={styles.typeItem}>
                  <Checkbox className={styles.checkbox} /> Alquiler
                </label>
                <label className={styles.typeItem}>
                  <Checkbox className={styles.checkbox} /> Suscripciones
                </label>
                <label className={styles.typeItem}>
                  <Checkbox className={styles.checkbox} /> Wifi
                </label>
                <label className={styles.typeItem}>
                  <Checkbox className={styles.checkbox} /> Agua
                </label>
                <label className={styles.typeItem}>
                  <Checkbox className={styles.checkbox} /> Luz
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

            <div className={styles.saveWrap}>
              <Button className={styles.saveButton}>Guardar</Button>
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}


