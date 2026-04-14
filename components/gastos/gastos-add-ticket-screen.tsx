"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Button } from "../ui/button";
import { Calendar } from "../ui/calendar";
import { Card } from "../ui/card";
import { Checkbox } from "../ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import styles from "./gastos-add-ticket-screen.module.css";

type GastosAddTicketScreenProps = {
  houseCode: string;
  dashboardPath?: string;
};

function formatDate(date?: Date) {
  if (!date) return "21/02/2026";
  const day = `${date.getDate()}`.padStart(2, "0");
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function GastosAddTicketScreen({
  houseCode,
  dashboardPath,
}: GastosAddTicketScreenProps) {
  const [date, setDate] = useState<Date | undefined>(new Date(2026, 1, 21));
  const basePath = dashboardPath ?? `/dashboard/${houseCode}`;

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <header className={styles.header}>
          <Link href={`${basePath}/gastos`} className={styles.backLink}>
            <Image src="/iconos/flechaatras.svg" alt="Volver" width={20} height={20} className={styles.backIcon} />
          </Link>
          <div className={styles.headerCenter}>
            <h1 className={styles.title}>Gastos</h1>
            <p className={styles.subtitle}>Compras, imprevistos y gastos compartidos</p>
          </div>
          <span />
        </header>

        <div className={styles.content}>
          <Card className={styles.card}>
            <div className={styles.cardTop}>
              <Link href={`${basePath}/gastos`} className={styles.inlineBack} aria-label="Volver a gastos">
                ←
              </Link>
              <h2 className={styles.cardTitle}>Añadir ticket</h2>
            </div>

            <section className={styles.block}>
              <h3 className={styles.blockTitle}>1 - Escanea el ticket</h3>
              <div className={styles.uploadBox}>
                <Image src="/iconos/Escanearimagen.svg" alt="Subir imagen" width={52} height={52} />
              </div>
            </section>

            <section className={styles.block}>
              <h3 className={styles.blockTitle}>2 - Elige que tipo de ticket es</h3>
              <RadioGroup defaultValue="compra" className={styles.radioRow}>
                <label className={styles.radioLabel}>
                  <RadioGroupItem id="ticket-compra" value="compra" className={styles.radioItem} />
                  Ticket de compra
                </label>
                <label className={styles.radioLabel}>
                  <RadioGroupItem id="ticket-imprevisto" value="imprevisto" className={styles.radioItem} />
                  Ticket de imprevisto
                </label>
              </RadioGroup>
            </section>

            <section className={styles.block}>
              <h3 className={styles.blockTitle}>3 - Selecciona los articulos del piso</h3>
              <div className={styles.checkCol}>
                <label className={styles.checkLabel}>
                  <Checkbox className={styles.checkbox} id="art-leche" /> Leche
                </label>
                <label className={styles.checkLabel}>
                  <Checkbox className={styles.checkbox} id="art-huevos" /> Huevos
                </label>
                <label className={styles.checkLabel}>
                  <Checkbox className={styles.checkbox} id="art-agua" /> Agua
                </label>
              </div>
            </section>

            <section className={styles.block}>
              <h3 className={styles.blockTitle}>4 - Selecciona los miembros del piso</h3>
              <div className={styles.membersCol}>
                <label className={styles.memberRow}>
                  <Checkbox className={styles.checkbox} id="m-antonio" />
                  <Image src="/images/IconoperfilM.webp" alt="" width={22} height={22} />
                  Antonio
                </label>
                <label className={styles.memberRow}>
                  <Checkbox className={styles.checkbox} id="m-juan" />
                  <Image src="/images/IconoperfilM.webp" alt="" width={22} height={22} />
                  Juan
                </label>
                <label className={styles.memberRow}>
                  <Checkbox className={styles.checkbox} id="m-alvaro" />
                  <Image src="/images/IconoperfilM.webp" alt="" width={22} height={22} />
                  Alvaro
                </label>
              </div>
            </section>

            <section className={styles.block}>
              <h3 className={styles.blockTitle}>5 - Fecha de compra</h3>
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


