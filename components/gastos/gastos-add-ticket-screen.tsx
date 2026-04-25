"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createPendingTicketExpenseAction } from "../../app/backend/endpoints/gastos/actions";
import type { AddExpenseFormOptions } from "../../lib/dashboard-types";
import { fileToDocumentUploadPayload } from "../../lib/document-upload-client";
import { Button } from "../ui/button";
import { Calendar } from "../ui/calendar";
import { Card } from "../ui/card";
import { Checkbox } from "../ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { TicketUploader } from "../ui/ticket-uploader";
import type { TicketScannerData } from "../../lib/ticket-scanner-types";
import styles from "./gastos-add-ticket-screen.module.css";

type GastosAddTicketScreenProps = {
  houseCode: string;
  dashboardPath: string;
  currentProfileId: string;
  formOptions: AddExpenseFormOptions;
};

function formatDate(date?: Date) {
  if (!date) return "Selecciona una fecha";
  const day = `${date.getDate()}`.padStart(2, "0");
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function toIsoDate(date?: Date) {
  if (!date) {
    return "";
  }

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeItemName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function parseScannerDate(value?: string | null): Date | undefined {
  if (!value) return undefined;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return undefined;
  const [, dd, mm, yyyy] = match;
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

const SUPERMARKET_KEYWORDS = [
  "mercadona",
  "carrefour",
  "dia",
  "lidl",
  "aldi",
  "eroski",
  "hipercor",
  "supercor",
  "el corte ingles",
  "alcampo",
  "simply",
  "masymas",
  "mas y mas",
  "consum",
  "bonarea",
  "bonpreu",
  "esclat",
  "caprabo",
  "froiz",
  "gadis",
  "bm supermercado",
  "coviran",
  "spar",
  "family cash",
  "supeco",
] as const;

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isSupermarketMerchant(merchant?: string | null) {
  if (!merchant) {
    return false;
  }

  const normalizedMerchant = normalizeSearchText(merchant);
  return SUPERMARKET_KEYWORDS.some((keyword) =>
    normalizedMerchant.includes(normalizeSearchText(keyword))
  );
}

export function GastosAddTicketScreen({
  houseCode,
  dashboardPath,
  currentProfileId,
  formOptions,
}: GastosAddTicketScreenProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const basePath = dashboardPath;
  const defaultPaidByProfileId = formOptions.members.some(
    (member) => member.profile_id === currentProfileId
  )
    ? currentProfileId
    : (formOptions.members[0]?.profile_id ?? "");
  const defaultParticipantIds = formOptions.members.map(
    (member) => member.profile_id
  );

  const [date, setDate] = useState<Date | undefined>(new Date());
  const [ticketKind, setTicketKind] = useState<"purchase" | "unexpected">(
    "purchase"
  );
  const [title, setTitle] = useState("");
  const [merchant, setMerchant] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [paidByProfileId, setPaidByProfileId] = useState(defaultPaidByProfileId);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>(
    defaultParticipantIds
  );
  const [detectedItemNames, setDetectedItemNames] = useState<string[]>([]);
  const [selectedItemNames, setSelectedItemNames] = useState<string[]>([]);
  const [manualItemName, setManualItemName] = useState("");
  const [selectedDocumentFile, setSelectedDocumentFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  const hasMembers = formOptions.members.length > 0;

  const toggleParticipant = (profileId: string) => {
    setSelectedParticipantIds((current) =>
      current.includes(profileId)
        ? current.filter((item) => item !== profileId)
        : [...current, profileId]
    );
  };

  const toggleItemName = (itemName: string) => {
    setSelectedItemNames((current) =>
      current.includes(itemName)
        ? current.filter((item) => item !== itemName)
        : [...current, itemName]
    );
  };

  const addManualItem = () => {
    const normalizedItemName = normalizeItemName(manualItemName);

    if (!normalizedItemName) {
      return;
    }

    setDetectedItemNames((current) =>
      current.includes(normalizedItemName)
        ? current
        : [...current, normalizedItemName]
    );

    setSelectedItemNames((current) =>
      current.includes(normalizedItemName)
        ? current
        : [...current, normalizedItemName]
    );
    setManualItemName("");
  };

  const resetForm = () => {
    setDate(new Date());
    setTicketKind("purchase");
    setTitle("");
    setMerchant("");
    setTotalAmount("");
    setNotes("");
    setPaidByProfileId(defaultPaidByProfileId);
    setSelectedParticipantIds(defaultParticipantIds);
    setDetectedItemNames([]);
    setSelectedItemNames([]);
    setManualItemName("");
    setSelectedDocumentFile(null);
    setErrorMessage(null);
    setScanMessage(null);
  };

  const handleSaveExpense = () => {
    const normalizedTitle = title.trim();
    const normalizedMerchant = merchant.trim();
    const parsedTotalAmount = Number(totalAmount.replace(",", "."));
    const purchaseDate = toIsoDate(date);

    if (!hasMembers) {
      setErrorMessage("No hay participantes disponibles en este piso.");
      return;
    }

    if (!normalizedTitle) {
      setErrorMessage("Introduce un título para el gasto.");
      return;
    }

    if (!purchaseDate) {
      setErrorMessage("Selecciona la fecha de compra.");
      return;
    }

    if (!Number.isFinite(parsedTotalAmount) || parsedTotalAmount <= 0) {
      setErrorMessage("Introduce un importe total válido.");
      return;
    }

    if (!selectedParticipantIds.length) {
      setErrorMessage("Selecciona al menos un participante.");
      return;
    }

    if (!paidByProfileId) {
      setErrorMessage("Selecciona quién ha pagado el gasto.");
      return;
    }

    setErrorMessage(null);

    startTransition(async () => {
      let document = null;

      if (selectedDocumentFile) {
        try {
          document = await fileToDocumentUploadPayload(selectedDocumentFile);
        } catch (error) {
          setErrorMessage(
            error instanceof Error ? error.message : "No se pudo preparar el archivo."
          );
          return;
        }
      }

      const result = await createPendingTicketExpenseAction({
        houseCode,
        dashboardPath: basePath,
        ticketKind,
        title: normalizedTitle,
        merchant: normalizedMerchant,
        purchaseDate,
        totalAmount: parsedTotalAmount,
        itemNames: selectedItemNames,
        participantProfileIds: selectedParticipantIds,
        notes,
        paidByProfileId,
        document,
      });

      if (result.success) {
        resetForm();
        router.push(`${basePath}/gastos`);
        router.refresh();
        return;
      }

      if ("error" in result) {
        setErrorMessage(result.error);
      }
    });
  };

  const handleScanComplete = (data: TicketScannerData) => {
    if (data.tipo === "desconocido") {
      setErrorMessage("No se detecto ticket ni factura en el archivo.");
      return;
    }

    if (typeof data.importe_total === "number" && Number.isFinite(data.importe_total)) {
      setTotalAmount(data.importe_total.toFixed(2));
    }

    if (data.comercio) {
      setMerchant(data.comercio);
    }

    const supermarketDetected = isSupermarketMerchant(data.comercio);
    if (supermarketDetected) {
      setTicketKind("purchase");
    }

    const parsedDate = parseScannerDate(data.fecha);
    if (parsedDate) {
      setDate(parsedDate);
    }

    if (data.tipo === "ticket" || supermarketDetected) {
      if (data.articulos?.length) {
        const normalizedNames = data.articulos
          .map((item) => normalizeItemName(item.nombre))
          .filter((itemName) => !!itemName);
        const uniqueNames = Array.from(new Set(normalizedNames));
        setDetectedItemNames(uniqueNames);
        setSelectedItemNames(uniqueNames);
      } else {
        setDetectedItemNames([]);
      }

      const firstItem = data.articulos?.[0]?.nombre?.trim();
      const fallbackTitle = data.comercio?.trim();
      if (firstItem) {
        setTitle(firstItem);
      } else if (fallbackTitle) {
        setTitle(`Compra en ${fallbackTitle}`);
      }
    } else if (data.tipo === "factura") {
      setTicketKind("unexpected");
      if (data.comercio) {
        setTitle(`Factura ${data.comercio}`);
      }
    }

    setErrorMessage(null);
    setScanMessage("Datos detectados y cargados en el formulario.");
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
            <h1 className={styles.title}>Gastos</h1>
            <p className={styles.subtitle}>
              Compras, imprevistos y gastos compartidos
            </p>
          </div>
          <span />
        </header>

        <div className={styles.content}>
          <Card className={styles.card}>
            <div className={styles.cardTop}>
              <Link
                href={`${basePath}/gastos`}
                className={styles.inlineBack}
                aria-label="Volver a gastos"
              >
                <Image
                  src="/iconos/flechaatras.svg"
                  alt=""
                  width={34}
                  height={34}
                />
              </Link>
              <h2 className={styles.cardTitle}>Añadir ticket</h2>
            </div>

            <section className={styles.block}>
              <h3 className={styles.blockTitle}>1 - Completa los datos del ticket</h3>
              <TicketUploader
                onScanComplete={handleScanComplete}
                onFileSelected={setSelectedDocumentFile}
                className={styles.uploadBox}
                minHeight={190}
                scanMode="vision"
              />
              {scanMessage ? (
                <p className={styles.scanMessage}>{scanMessage}</p>
              ) : null}
              <div className={styles.fieldsGrid}>
                <label className={styles.fieldGroup}>
                  <span className={styles.fieldLabel}>Título</span>
                  <input
                    className={styles.fieldInput}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Compra semanal"
                  />
                </label>

                <label className={styles.fieldGroup}>
                  <span className={styles.fieldLabel}>Comercio</span>
                  <input
                    className={styles.fieldInput}
                    value={merchant}
                    onChange={(event) => setMerchant(event.target.value)}
                    placeholder="Mercadona"
                  />
                </label>

                <label className={styles.fieldGroup}>
                  <span className={styles.fieldLabel}>Importe total</span>
                  <input
                    className={styles.fieldInput}
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={totalAmount}
                    onChange={(event) => setTotalAmount(event.target.value)}
                    placeholder="0,00"
                  />
                </label>
              </div>
            </section>

            <section className={styles.block}>
              <h3 className={styles.blockTitle}>2 - Elige qué tipo de ticket es</h3>
              <RadioGroup
                value={ticketKind}
                onValueChange={(value) =>
                  setTicketKind(value === "unexpected" ? "unexpected" : "purchase")
                }
                className={styles.radioRow}
              >
                <label className={styles.radioLabel}>
                  <RadioGroupItem
                    id="ticket-compra"
                    value="purchase"
                    className={styles.radioItem}
                  />
                  Ticket de compra
                </label>
                <label className={styles.radioLabel}>
                  <RadioGroupItem
                    id="ticket-imprevisto"
                    value="unexpected"
                    className={styles.radioItem}
                  />
                  Ticket de imprevisto
                </label>
              </RadioGroup>
            </section>

            <section className={styles.block}>
              <h3 className={styles.blockTitle}>3 - Añade los artículos del piso</h3>
              {detectedItemNames.length ? (
                <div className={styles.checkCol}>
                  {detectedItemNames.map((itemName) => (
                    <label key={itemName} className={styles.checkLabel}>
                      <Checkbox
                        className={styles.checkbox}
                        checked={selectedItemNames.includes(itemName)}
                        onCheckedChange={() => toggleItemName(itemName)}
                      />
                      {itemName}
                    </label>
                  ))}
                </div>
              ) : (
                <p className={styles.emptyCopy}>No hay articulos detectados.</p>
              )}

              <div className={styles.itemComposer}>
                <input
                  className={styles.fieldInput}
                  value={manualItemName}
                  onChange={(event) => setManualItemName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addManualItem();
                    }
                  }}
                  placeholder="Añadir artículo manual"
                />
                <Button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={addManualItem}
                >
                  Añadir artículo
                </Button>
              </div>
            </section>

            <section className={styles.block}>
              <h3 className={styles.blockTitle}>4 - Selecciona los miembros del piso</h3>
              {hasMembers ? (
                <div className={styles.membersCol}>
                  {formOptions.members.map((member) => (
                    <label key={member.profile_id} className={styles.memberRow}>
                      <Checkbox
                        className={styles.checkbox}
                        checked={selectedParticipantIds.includes(member.profile_id)}
                        onCheckedChange={() => toggleParticipant(member.profile_id)}
                      />
                      <Image
                        src="/images/IconoperfilM.webp"
                        alt=""
                        width={22}
                        height={22}
                      />
                      <span>{member.display_name}</span>
                      <span className={styles.memberRole}>{member.role}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className={styles.emptyCopy}>No hay participantes disponibles.</p>
              )}
            </section>

            <section className={styles.block}>
              <h3 className={styles.blockTitle}>5 - Indica quién ha pagado</h3>
              <select
                className={styles.fieldSelect}
                value={paidByProfileId}
                onChange={(event) => setPaidByProfileId(event.target.value)}
                disabled={!hasMembers}
              >
                <option value="">Selecciona una persona</option>
                {formOptions.members.map((member) => (
                  <option key={member.profile_id} value={member.profile_id}>
                    {member.display_name}
                  </option>
                ))}
              </select>
            </section>

            <section className={styles.block}>
              <h3 className={styles.blockTitle}>6 - Fecha de compra</h3>
              <Popover>
                <PopoverTrigger asChild>
                  <Button className={styles.dateTrigger}>
                    {formatDate(date)}
                    <Image
                      src="/iconos/flechascalendario.svg"
                      alt=""
                      width={14}
                      height={14}
                      className={styles.dateArrow}
                    />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className={styles.calendarPopover}>
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    className={styles.calendar}
                  />
                </PopoverContent>
              </Popover>
            </section>

            <section className={styles.block}>
              <h3 className={styles.blockTitle}>7 - Notas</h3>
              <textarea
                className={styles.fieldTextarea}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Añade un contexto útil para el resto del piso"
                rows={4}
              />
            </section>

            {errorMessage ? (
              <p className={styles.feedbackMessage}>{errorMessage}</p>
            ) : null}

            <div className={styles.saveWrap}>
              <Button
                className={styles.saveButton}
                type="button"
                onClick={handleSaveExpense}
                disabled={isPending}
              >
                {isPending ? "Guardando..." : "Guardar gasto"}
              </Button>
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}

