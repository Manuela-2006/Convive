"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { createPendingInvoiceExpenseAction } from "../../app/backend/endpoints/facturas/actions";
import type { AddInvoiceCategory, AddInvoiceFormOptions } from "../../lib/dashboard-types";
import { fileToDocumentUploadPayload } from "../../lib/document-upload-client";
import type {
  TicketScannerCategory,
  TicketScannerData,
} from "../../lib/ticket-scanner-types";
import { Button } from "../ui/button";
import { Calendar } from "../ui/calendar";
import { Card } from "../ui/card";
import { Checkbox } from "../ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { ProfileAvatar } from "../ui/profile-avatar";
import { TicketUploader } from "../ui/ticket-uploader";
import styles from "./facturas-add-screen.module.css";

type FacturasAddScreenProps = {
  houseCode: string;
  dashboardPath: string;
  formOptions: AddInvoiceFormOptions;
  defaultRentAmount?: string | null;
};

const scannerCategoryLabels: Record<TicketScannerCategory, string> = {
  luz: "Luz",
  agua: "Agua",
  wifi: "Wifi",
  gas: "Gas",
  alquiler: "Alquiler",
  otro: "Otra factura",
};

const scannerCategoryFallbacks: Partial<Record<TicketScannerCategory, string[]>> = {
  gas: ["gas", "suscripciones"],
  otro: ["otro", "suscripciones"],
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

function normalizeManualCategory(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeCategoryKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-");
}

function dedupeInvoiceCategories(categories: AddInvoiceCategory[]) {
  const byKey = new Map<string, AddInvoiceCategory>();

  for (const category of categories) {
    const key = normalizeCategoryKey(category.slug || category.name || category.category_id);
    if (!key || byKey.has(key)) continue;
    byKey.set(key, category);
  }

  return Array.from(byKey.values());
}

function isRentCategory(category?: AddInvoiceCategory | null) {
  if (!category) return false;
  const context = `${normalizeCategoryKey(category.slug)} ${normalizeCategoryKey(
    category.name
  )}`;
  return context.includes("alquiler") || context.includes("rent");
}

function normalizeMoneyInput(value?: string | null) {
  const normalized = (value ?? "").trim().replace(",", ".");
  if (!normalized) return "";
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount.toFixed(2) : "";
}

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
    if (parsedDates.length) return parsedDates[parsedDates.length - 1];
  }

  const monthlyChargeMatch =
    /\b(?:dia|d[ií]a)\s*(\d{1,2})\s*de cada mes\b/i.exec(normalized);
  if (!monthlyChargeMatch) return undefined;

  const requestedDay = Number(monthlyChargeMatch[1]);
  if (!Number.isFinite(requestedDay) || requestedDay <= 0) return undefined;

  const now = new Date();
  const maxDayInMonth = getLastDayOfMonth(now.getFullYear(), now.getMonth());
  const safeDay = Math.min(requestedDay, maxDayInMonth);
  const inferredDate = new Date(now.getFullYear(), now.getMonth(), safeDay);
  return Number.isNaN(inferredDate.getTime()) ? undefined : inferredDate;
}

export function FacturasAddScreen({
  houseCode,
  dashboardPath,
  formOptions,
  defaultRentAmount = null,
}: FacturasAddScreenProps) {
  const router = useRouter();
  const uniqueCategories = useMemo(
    () => dedupeInvoiceCategories(formOptions.categories),
    [formOptions.categories]
  );
  const [isPending, startTransition] = useTransition();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [title, setTitle] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    uniqueCategories[0]?.category_id ?? null
  );
  const [manualCategoryName, setManualCategoryName] = useState("");
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>(
    formOptions.members.map((member) => member.profile_id)
  );
  const [selectedDocumentFile, setSelectedDocumentFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const basePath = dashboardPath;
  const hasMembers = formOptions.members.length > 0;
  const normalizedDefaultRentAmount = useMemo(
    () => normalizeMoneyInput(defaultRentAmount),
    [defaultRentAmount]
  );

  const applyRentDefaultIfNeeded = (categoryId: string | null) => {
    const selectedCategory = uniqueCategories.find(
      (category) => category.category_id === categoryId
    );

    if (isRentCategory(selectedCategory) && normalizedDefaultRentAmount) {
      setTotalAmount((current) => current || normalizedDefaultRentAmount);
    }
  };

  useEffect(() => {
    setSelectedCategoryId((current) => {
      if (current && uniqueCategories.some((category) => category.category_id === current)) {
        return current;
      }
      return uniqueCategories[0]?.category_id ?? null;
    });
  }, [uniqueCategories]);

  useEffect(() => {
    applyRentDefaultIfNeeded(selectedCategoryId);
  }, [selectedCategoryId, normalizedDefaultRentAmount, uniqueCategories]);

  const toggleParticipant = (profileId: string) => {
    setSelectedParticipantIds((current) =>
      current.includes(profileId)
        ? current.filter((item) => item !== profileId)
        : [...current, profileId]
    );
  };

  const selectCategory = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setManualCategoryName("");
    applyRentDefaultIfNeeded(categoryId);
  };

  const selectScannedCategory = (category: TicketScannerCategory) => {
    const categoryKeys = [
      category,
      ...(scannerCategoryFallbacks[category] ?? []),
    ].map(normalizeCategoryKey);
    const matchedCategory = uniqueCategories.find((option) => {
      const optionKeys = [
        normalizeCategoryKey(option.slug),
        normalizeCategoryKey(option.name),
      ];
      return optionKeys.some((key) => categoryKeys.includes(key));
    });

    if (matchedCategory) {
      selectCategory(matchedCategory.category_id);
      return;
    }

    setSelectedCategoryId(null);
    setManualCategoryName(scannerCategoryLabels[category]);
  };

  const resetForm = () => {
    const initialCategoryId = uniqueCategories[0]?.category_id ?? null;
    const initialCategory = uniqueCategories.find(
      (category) => category.category_id === initialCategoryId
    );
    setDate(new Date());
    setTitle("");
    setTotalAmount(
      isRentCategory(initialCategory) && normalizedDefaultRentAmount
        ? normalizedDefaultRentAmount
        : ""
    );
    setNotes("");
    setSelectedCategoryId(initialCategoryId);
    setManualCategoryName("");
    setSelectedParticipantIds(
      formOptions.members.map((member) => member.profile_id)
    );
    setSelectedDocumentFile(null);
    setErrorMessage(null);
    setScanMessage(null);
  };

  const handleSaveInvoice = () => {
    const selectedCategory = uniqueCategories.find(
      (category) => category.category_id === selectedCategoryId
    );
    const normalizedManualCategory =
      normalizeManualCategory(manualCategoryName);
    const normalizedTitle =
      title.trim() || normalizedManualCategory || selectedCategory?.name || "";
    const invoiceDate = toIsoDate(date);
    const parsedTotalAmount = Number(totalAmount.replace(",", "."));
    const invoiceCategoryId = normalizedManualCategory
      ? null
      : selectedCategoryId;
    const customCategoryName = normalizedManualCategory || null;

    if (!normalizedTitle) {
      setErrorMessage("Introduce un título para la factura.");
      return;
    }
    if (!invoiceDate) {
      setErrorMessage("Selecciona la fecha de factura.");
      return;
    }
    if (!Number.isFinite(parsedTotalAmount) || parsedTotalAmount <= 0) {
      setErrorMessage("Introduce un importe total válido.");
      return;
    }
    if (!invoiceCategoryId && !customCategoryName) {
      setErrorMessage("Selecciona un tipo de factura o escribe uno manual.");
      return;
    }
    if (!hasMembers) {
      setErrorMessage("No hay participantes disponibles en este piso.");
      return;
    }
    if (!selectedParticipantIds.length) {
      setErrorMessage("Selecciona al menos un miembro del piso.");
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

      const result = await createPendingInvoiceExpenseAction({
        houseCode,
        dashboardPath: basePath,
        title: normalizedTitle,
        invoiceDate,
        totalAmount: parsedTotalAmount,
        participantProfileIds: selectedParticipantIds,
        invoiceCategoryId,
        customCategoryName,
        notes: notes.trim() ? notes : null,
        paidByProfileId: null,
        invoiceFilePath: null,
        document,
      });

      if (result.success) {
        resetForm();
        router.push(`${basePath}/facturas`);
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
      setScanMessage("No se detecto ticket ni factura en el archivo.");
      return;
    }

    const parsedDate = parseScannerDate(data.fecha) ?? inferInvoiceDate(data.periodo);
    if (parsedDate) {
      setDate(parsedDate);
    }

    if (data.categoria) {
      selectScannedCategory(data.categoria);
    }

    if (typeof data.importe_total === "number" && Number.isFinite(data.importe_total)) {
      setTotalAmount(data.importe_total.toFixed(2));
    }

    const inferredTitle =
      data.comercio?.trim() ||
      (data.categoria ? scannerCategoryLabels[data.categoria] : null);
    if (inferredTitle) {
      setTitle(inferredTitle);
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
            <h1 className={styles.title}>Facturas</h1>
            <p className={styles.subtitle}>
              Gestiona las facturas del piso de forma clara
            </p>
          </div>
          <span />
        </header>

        <div className={styles.content}>
          <Card className={styles.card}>
            <div className={styles.cardTop}>
              <Link
                href={`${basePath}/facturas`}
                className={styles.inlineBack}
                aria-label="Volver a facturas"
              >
                <Image src="/iconos/flechaatras.svg" alt="" width={32} height={32} />
              </Link>
              <h2 className={styles.cardTitle}>Añadir factura</h2>
            </div>

            <section className={styles.block}>
              <h3 className={styles.blockTitle}>1 - Adjunta la factura</h3>
              <TicketUploader
                onScanComplete={handleScanComplete}
                onFileSelected={setSelectedDocumentFile}
                className={styles.uploadBox}
                minHeight={190}
              />
              {scanMessage ? <p className={styles.scanMessage}>{scanMessage}</p> : null}
            </section>

            <section className={styles.block}>
              <h3 className={styles.blockTitle}>2 - Elige que tipo de factura es</h3>
              {uniqueCategories.length ? (
                <div className={styles.typesRow}>
                  {uniqueCategories.map((category) => (
                    <label key={category.category_id} className={styles.typeItem}>
                      <Checkbox
                        className={styles.checkbox}
                        checked={
                          selectedCategoryId === category.category_id &&
                          !manualCategoryName.trim()
                        }
                        onCheckedChange={() => selectCategory(category.category_id)}
                      />
                      {category.name}
                    </label>
                  ))}
                </div>
              ) : (
                <p className={styles.emptyCopy}>No hay categorias configuradas.</p>
              )}
              {!uniqueCategories.length && manualCategoryName ? (
                <p className={styles.scanMessage}>{manualCategoryName}</p>
              ) : null}
            </section>

            <section className={styles.block}>
              <h3 className={styles.blockTitle}>3 - Selecciona los miembros del piso</h3>
              {hasMembers ? (
                <div className={styles.membersCol}>
                  {formOptions.members.map((member) => (
                    <label key={member.profile_id} className={styles.memberRow}>
                      <Checkbox
                        className={styles.checkbox}
                        checked={selectedParticipantIds.includes(member.profile_id)}
                        onCheckedChange={() => toggleParticipant(member.profile_id)}
                      />
                      <ProfileAvatar
                        src={member.avatar_url}
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
              <h3 className={styles.blockTitle}>4 - Fecha de factura</h3>
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
                <Image
                  src="/iconos/euro.svg"
                  alt="Euro"
                  width={14}
                  height={14}
                  className={styles.totalCurrencyIcon}
                  style={{
                    filter:
                      "brightness(0) saturate(100%) invert(15%) sepia(25%) saturate(4849%) hue-rotate(329deg) brightness(84%) contrast(98%)",
                  }}
                />
              </div>
            </section>

            {errorMessage ? (
              <p className={styles.feedbackMessage}>{errorMessage}</p>
            ) : null}

            <div className={styles.saveWrap}>
              <Button
                className={styles.saveButton}
                onClick={handleSaveInvoice}
                disabled={isPending}
              >
                {isPending ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}

