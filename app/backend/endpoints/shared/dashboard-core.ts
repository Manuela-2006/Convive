import { notFound, redirect } from "next/navigation";

import type {
  AddExpenseFormOptions,
  AddExpenseCatalogItem,
  AddExpenseMember,
  AddInvoiceCategory,
  AddInvoiceFormOptions,
  AddInvoiceMember,
  AddCleaningMember,
  AddCleaningTaskFormOptions,
  AddCleaningZone,
  CleaningDashboardData,
  CleaningTask,
  CleaningZoneSection,
  CurrentUserExpenseState,
  ExpenseTicket,
  ExpensesDashboardData,
  Invoice,
  InvoiceCategorySection,
  InvoicesDashboardData,
  PendingPaymentConfirmation,
  PersonalAreaDashboardData,
  PersonalAreaDebtItem,
  PersonalAreaHistoryItem,
  PersonalAreaReceivableItem,
  ProfileSettingsData,
  ProfileSettingsMemberOption,
  Settlement,
  SharedExpense,
} from "./dashboard-types";
import { createClient } from "./supabase-server";
import { loadProfileAvatarUrlMapWithClient } from "./profile-avatar";

type ProfileRecord = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  user_hash_id: string | null;
};

type HouseRecord = {
  id: string;
  name: string;
  public_code: string;
  created_by: string;
};

type AuthenticatedDashboardContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  profile: ProfileRecord & {
    user_hash_id: string;
  };
};

type AccessibleHouseContext = AuthenticatedDashboardContext & {
  house: HouseRecord;
  memberRole: string;
  dashboardPath: string;
};

type HouseInviteRecord = {
  inviteCode: string | null;
  canManageInvites: boolean;
};

function toNumericLikeValue(value: unknown, fallback: number | string = 0) {
  if (typeof value === "number" || typeof value === "string") {
    return value;
  }

  return fallback;
}

function mapExpenseTicket(ticket: Record<string, unknown>): ExpenseTicket {
  return {
    ticket_id: toStringValue(ticket.ticket_id),
    expense_id: toNullableStringValue(ticket.expense_id),
    display_title: toStringValue(ticket.display_title),
    merchant: toStringValue(ticket.merchant),
    purchase_date: toStringValue(ticket.purchase_date),
    paid_by_name: toStringValue(ticket.paid_by_name),
    paid_by_profile_id: toNullableStringValue(ticket.paid_by_profile_id),
    paid_by_avatar_url: toNullableStringValue(ticket.paid_by_avatar_url),
    total_amount: toNumericLikeValue(ticket.total_amount),
    my_share_amount:
      ticket.my_share_amount === null || ticket.my_share_amount === undefined
        ? null
        : toNumericLikeValue(ticket.my_share_amount, 0),
    currency: toStringValue(ticket.currency, "EUR"),
    ticket_file_path: toNullableStringValue(ticket.ticket_file_path) ? "stored" : null,
    settlement_status: toNullableStringValue(ticket.settlement_status),
  };
}

function mapSharedExpense(expense: Record<string, unknown>): SharedExpense {
  return {
    expense_id: toStringValue(expense.expense_id),
    title: toStringValue(expense.title),
    expense_type: toStringValue(expense.expense_type),
    expense_date: toStringValue(expense.expense_date),
    paid_by_name: toStringValue(expense.paid_by_name),
    participants_text: toStringValue(expense.participants_text),
    participants_count:
      typeof expense.participants_count === "number"
        ? expense.participants_count
        : Number(expense.participants_count ?? 0),
    participants: [],
    total_amount: toNumericLikeValue(expense.total_amount),
    my_share_amount:
      expense.my_share_amount === null || expense.my_share_amount === undefined
        ? null
        : toNumericLikeValue(expense.my_share_amount, 0),
    my_status: toNullableStringValue(expense.my_status),
    currency: toStringValue(expense.currency, "EUR"),
    source_ticket_id: toNullableStringValue(expense.source_ticket_id),
    settlement_status: toNullableStringValue(expense.settlement_status),
  };
}

function readInvoiceCategoryName(invoice: Record<string, unknown>) {
  return (
    toStringValue(invoice.category_name) ||
    toStringValue(invoice.invoice_category) ||
    toStringValue(invoice.invoice_category_name) ||
    toStringValue(invoice.category) ||
    toStringValue(invoice.custom_category_name) ||
    "Sin categoria"
  );
}

type InvoiceCategoryOverride = {
  category_id?: string | null;
  category_name?: string | null;
  category_slug?: string | null;
};

function mapInvoice(
  invoice: Record<string, unknown>,
  categoryOverride: InvoiceCategoryOverride = {}
): Invoice {
  const categoryName =
    categoryOverride.category_name?.trim() || readInvoiceCategoryName(invoice);
  const invoiceFilePath =
    toNullableStringValue(invoice.invoice_file_path) ??
    toNullableStringValue(invoice.file_path);

  return {
    expense_id:
      toStringValue(invoice.expense_id) ||
      toStringValue(invoice.shared_expense_id) ||
      toStringValue(invoice.invoice_id) ||
      toStringValue(invoice.id),
    title:
      toStringValue(invoice.title) ||
      toStringValue(invoice.display_title) ||
      "Factura",
    invoice_date:
      toStringValue(invoice.invoice_date) ||
      toStringValue(invoice.expense_date) ||
      toStringValue(invoice.created_at) ||
      toStringValue(invoice.date),
    total_amount: toNumericLikeValue(
      invoice.total_amount ?? invoice.amount ?? invoice.total
    ),
    currency: toStringValue(invoice.currency, "EUR"),
    category_id:
      categoryOverride.category_id ??
      toNullableStringValue(invoice.category_id) ??
      toNullableStringValue(invoice.invoice_category_id) ??
      toNullableStringValue(invoice.invoice_category),
    category_name: categoryName,
    category_slug: slugifyInvoiceCategory(
      categoryOverride.category_slug ||
        toStringValue(invoice.category_slug) ||
        toStringValue(invoice.invoice_category_slug) ||
        toStringValue(invoice.category_key) ||
        categoryName
    ),
    invoice_file_path: invoiceFilePath ? "stored" : null,
    settlement_status:
      toNullableStringValue(invoice.settlement_status) ??
      toNullableStringValue(invoice.invoice_status) ??
      toNullableStringValue(invoice.status),
    can_mark_paid:
      toBooleanValue(invoice.can_mark_paid) ||
      toBooleanValue(invoice.can_admin_mark_paid) ||
      toBooleanValue(invoice.can_mark_invoice_paid) ||
      toBooleanValue(invoice.user_can_mark_paid) ||
      toBooleanValue(invoice.user_can_mark_invoice_paid),
  };
}

function mapInvoiceCategory(category: Record<string, unknown>): AddInvoiceCategory {
  const name =
    toStringValue(category.name) ||
    toStringValue(category.category_name) ||
    toStringValue(category.invoice_category_name) ||
    toStringValue(category.title);

  return {
    category_id:
      toStringValue(category.category_id) ||
      toStringValue(category.invoice_category_id) ||
      toStringValue(category.id),
    name,
    slug: slugifyInvoiceCategory(
      toStringValue(category.slug) || toStringValue(category.category_slug) || name
    ),
  };
}

function mapInvoiceMember(member: Record<string, unknown>): AddInvoiceMember {
  return {
    profile_id:
      toStringValue(member.profile_id) ||
      toStringValue(member.id) ||
      toStringValue(member.profileId),
    display_name:
      toStringValue(member.display_name) ||
      toStringValue(member.full_name) ||
      toStringValue(member.name),
    role: toStringValue(member.role, "member"),
    avatar_url: toNullableStringValue(member.avatar_url),
  };
}

async function addSharedExpenseParticipantAvatarsWithClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  expenses: SharedExpense[]
) {
  const expenseIds = expenses.map((expense) => expense.expense_id).filter(Boolean);

  if (!expenseIds.length) {
    return expenses;
  }

  const { data: participantRows, error: participantError } = await supabase
    .from("expense_participants")
    .select("expense_id, profile_id")
    .in("expense_id", expenseIds)
    .eq("is_waived", false);

  if (participantError || !Array.isArray(participantRows)) {
    return expenses;
  }

  const profileIds = Array.from(
    new Set(
      participantRows
        .map((row) => toStringValue((row as { profile_id?: unknown }).profile_id))
        .filter(Boolean)
    )
  );

  if (!profileIds.length) {
    return expenses;
  }

  const [{ data: profileRows }, avatarUrlMap] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email").in("id", profileIds),
    loadProfileAvatarUrlMapWithClient(supabase, profileIds),
  ]);
  const profileNameMap = new Map(
    Array.isArray(profileRows)
      ? profileRows.map((profile) => {
          const row = profile as { id?: unknown; full_name?: unknown; email?: unknown };
          const profileId = toStringValue(row.id);
          return [
            profileId,
            toStringValue(row.full_name) ||
              toStringValue(row.email) ||
              "Participante",
          ] as const;
        })
      : []
  );
  const participantsByExpenseId = new Map<
    string,
    Array<{ profile_id: string; display_name: string; avatar_url: string | null }>
  >();

  for (const participant of participantRows) {
    const row = participant as { expense_id?: unknown; profile_id?: unknown };
    const expenseId = toStringValue(row.expense_id);
    const profileId = toStringValue(row.profile_id);

    if (!expenseId || !profileId) continue;

    const current = participantsByExpenseId.get(expenseId) ?? [];
    current.push({
      profile_id: profileId,
      display_name: profileNameMap.get(profileId) ?? "Participante",
      avatar_url: avatarUrlMap.get(profileId) ?? null,
    });
    participantsByExpenseId.set(expenseId, current);
  }

  return expenses.map((expense) => ({
    ...expense,
    participants: participantsByExpenseId.get(expense.expense_id) ?? [],
  }));
}

async function addTicketPayerAvatarsWithClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tickets: ExpenseTicket[]
) {
  const ticketIds = tickets.map((ticket) => ticket.ticket_id).filter(Boolean);

  if (!ticketIds.length) {
    return tickets;
  }

  const { data, error } = await supabase
    .from("purchase_tickets")
    .select("id, paid_by_profile_id")
    .in("id", ticketIds);

  if (error || !Array.isArray(data)) {
    return tickets;
  }

  const payerByTicketId = new Map(
    data.map((ticket) => [
      toStringValue((ticket as { id?: unknown }).id),
      toNullableStringValue(
        (ticket as { paid_by_profile_id?: unknown }).paid_by_profile_id
      ),
    ])
  );
  const avatarUrlMap = await loadProfileAvatarUrlMapWithClient(
    supabase,
    Array.from(payerByTicketId.values()).filter((value): value is string => !!value)
  );

  return tickets.map((ticket) => {
    const paidByProfileId =
      ticket.paid_by_profile_id ?? payerByTicketId.get(ticket.ticket_id) ?? null;

    return {
      ...ticket,
      paid_by_profile_id: paidByProfileId,
      paid_by_avatar_url: paidByProfileId
        ? avatarUrlMap.get(paidByProfileId) ?? ticket.paid_by_avatar_url
        : ticket.paid_by_avatar_url,
    };
  });
}

function readCleaningZoneName(value: Record<string, unknown>) {
  return (
    toStringValue(value.zone_name) ||
    toStringValue(value.cleaning_zone_name) ||
    toStringValue(value.name) ||
    toStringValue(value.title) ||
    "Sin zona"
  );
}

function mapCleaningZone(zone: Record<string, unknown>): AddCleaningZone {
  return {
    zone_id:
      toStringValue(zone.zone_id) ||
      toStringValue(zone.cleaning_zone_id) ||
      toStringValue(zone.id),
    name: readCleaningZoneName(zone),
  };
}

function mapCleaningMember(member: Record<string, unknown>): AddCleaningMember {
  return {
    profile_id:
      toStringValue(member.profile_id) ||
      toStringValue(member.id) ||
      toStringValue(member.profileId),
    display_name:
      toStringValue(member.display_name) ||
      toStringValue(member.full_name) ||
      toStringValue(member.name),
    role: toStringValue(member.role, "member"),
    avatar_url: toNullableStringValue(member.avatar_url),
  };
}

function mapCleaningTask(
  task: Record<string, unknown>,
  zoneOverride: { zone_id?: string | null; zone_name?: string | null } = {}
): CleaningTask {
  const zoneName = zoneOverride.zone_name?.trim() || readCleaningZoneName(task);

  return {
    task_id:
      toStringValue(task.task_id) ||
      toStringValue(task.cleaning_task_id) ||
      toStringValue(task.id),
    title:
      toStringValue(task.title) ||
      toStringValue(task.task_title) ||
      toStringValue(task.name) ||
      "Tarea",
    due_date:
      toStringValue(task.due_date) ||
      toStringValue(task.task_due_date) ||
      toStringValue(task.date),
    assigned_to_profile_id:
      toNullableStringValue(task.assigned_to_profile_id) ??
      toNullableStringValue(task.assigned_profile_id) ??
      toNullableStringValue(task.profile_id),
    assigned_to_name:
      toStringValue(task.assigned_to_name) ||
      toStringValue(task.assigned_name) ||
      toStringValue(task.display_name) ||
      toStringValue(task.full_name),
    zone_id:
      zoneOverride.zone_id ??
      toNullableStringValue(task.zone_id) ??
      toNullableStringValue(task.cleaning_zone_id),
    zone_name: zoneName,
    notes:
      toNullableStringValue(task.notes) ??
      toNullableStringValue(task.note) ??
      toNullableStringValue(task.description),
    status: toStringValue(task.status, "pending"),
    completed_at:
      toNullableStringValue(task.completed_at) ??
      toNullableStringValue(task.completedAt),
    completed_by_profile_id:
      toNullableStringValue(task.completed_by_profile_id) ??
      toNullableStringValue(task.completed_by),
  };
}

function mapCleaningSection(section: Record<string, unknown>): CleaningZoneSection {
  const zoneId =
    toNullableStringValue(section.zone_id) ??
    toNullableStringValue(section.cleaning_zone_id) ??
    toNullableStringValue(section.id);
  const zoneName = readCleaningZoneName(section);
  const tasks = asArray<Record<string, unknown>>(
    section.tasks ?? section.cleaning_tasks ?? section.items ?? section.rows
  ).map((task) =>
    mapCleaningTask(task, {
      zone_id: zoneId,
      zone_name: zoneName,
    })
  );

  return {
    zone_id: zoneId,
    zone_name: zoneName,
    tasks,
  };
}

function groupCleaningTasksByZone(tasks: CleaningTask[]) {
  const sectionsByZone = new Map<string, CleaningZoneSection>();

  for (const task of tasks) {
    const key = task.zone_id ?? task.zone_name;
    const currentSection = sectionsByZone.get(key);

    if (currentSection) {
      currentSection.tasks.push(task);
      continue;
    }

    sectionsByZone.set(key, {
      zone_id: task.zone_id,
      zone_name: task.zone_name,
      tasks: [task],
    });
  }

  return [...sectionsByZone.values()];
}

function orderInvoiceSections(sections: InvoiceCategorySection[]) {
  const preferredOrder = ["alquiler", "suscripciones", "wifi", "agua", "luz"];
  return [...sections].sort((first, second) => {
    const firstIndex = preferredOrder.indexOf(first.category_slug);
    const secondIndex = preferredOrder.indexOf(second.category_slug);

    if (firstIndex !== -1 || secondIndex !== -1) {
      return (firstIndex === -1 ? 999 : firstIndex) - (secondIndex === -1 ? 999 : secondIndex);
    }

    return first.category_name.localeCompare(second.category_name, "es");
  });
}

function isOpenInvoice(invoice: Invoice) {
  const normalizedStatus = (invoice.settlement_status ?? "").trim().toLowerCase();

  if (!normalizedStatus) {
    return true;
  }

  return ![
    "paid",
    "pagada",
    "completed",
    "complete",
    "settled",
    "liquidada",
    "liquidado",
    "closed",
  ].includes(normalizedStatus);
}

function groupInvoicesByCategory(invoices: Invoice[]) {
  const sectionsByCategory = new Map<string, InvoiceCategorySection>();

  for (const invoice of invoices) {
    const key = invoice.category_id ?? invoice.category_slug;
    const currentSection = sectionsByCategory.get(key);

    if (currentSection) {
      currentSection.invoices.push(invoice);
      continue;
    }

    sectionsByCategory.set(key, {
      category_id: invoice.category_id,
      category_name: invoice.category_name,
      category_slug: invoice.category_slug,
      invoices: [invoice],
    });
  }

  return orderInvoiceSections([...sectionsByCategory.values()]);
}

function canonicalInvoiceCategoryKey(section: {
  category_id?: string | null;
  category_name?: string | null;
  category_slug?: string | null;
}) {
  const name = slugifyInvoiceCategory(section.category_name || "");
  const slug = slugifyInvoiceCategory(section.category_slug || "");
  const combined = `${name} ${slug}`;

  if (combined.includes("alquiler")) return "alquiler";
  if (combined.includes("suscrip") || combined.includes("subscription")) return "suscripciones";
  if (combined.includes("wifi") || combined.includes("internet")) return "wifi";
  if (combined.includes("agua") || combined.includes("water")) return "agua";
  if (combined.includes("luz") || combined.includes("elect")) return "luz";

  if (name) {
    return name;
  }

  if (
    slug &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(slug)
  ) {
    return slug;
  }

  return slugifyInvoiceCategory(section.category_id || "sin-categoria");
}

function dedupeInvoiceSections(sections: InvoiceCategorySection[]) {
  const byCategory = new Map<string, InvoiceCategorySection>();

  for (const section of sections) {
    const key = canonicalInvoiceCategoryKey(section);
    const existing = byCategory.get(key);

    if (!existing) {
      const seen = new Set<string>();
      const uniqueInvoices = section.invoices.filter((invoice) => {
        if (seen.has(invoice.expense_id)) return false;
        seen.add(invoice.expense_id);
        return true;
      });

      byCategory.set(key, {
        ...section,
        category_slug: key,
        invoices: uniqueInvoices,
      });
      continue;
    }

    const seen = new Set(existing.invoices.map((invoice) => invoice.expense_id));
    const mergedInvoices = [...existing.invoices];

    for (const invoice of section.invoices) {
      if (seen.has(invoice.expense_id)) continue;
      seen.add(invoice.expense_id);
      mergedInvoices.push(invoice);
    }

    byCategory.set(key, {
      ...existing,
      invoices: mergedInvoices,
    });
  }

  return orderInvoiceSections(Array.from(byCategory.values()));
}

function dedupeInvoiceCategories(categories: AddInvoiceCategory[]) {
  const byCategory = new Map<string, AddInvoiceCategory>();

  for (const category of categories) {
    const key = canonicalInvoiceCategoryKey({
      category_id: category.category_id,
      category_name: category.name,
      category_slug: category.slug,
    });
    if (byCategory.has(key)) continue;
    byCategory.set(key, { ...category, slug: key });
  }

  return Array.from(byCategory.values());
}

function readInvoiceSection(
  section: Record<string, unknown>,
  options: { onlyOpen?: boolean } = {}
) {
  const categoryName =
    toStringValue(section.category_name) ||
    toStringValue(section.invoice_category_name) ||
    toStringValue(section.name) ||
    toStringValue(section.title) ||
    "Sin categoria";
  const categoryId =
    toNullableStringValue(section.category_id) ??
    toNullableStringValue(section.invoice_category_id) ??
    toNullableStringValue(section.id);
  const categorySlug = slugifyInvoiceCategory(
    toStringValue(section.category_slug) ||
      toStringValue(section.slug) ||
      toStringValue(section.category_key) ||
      categoryName
  );
  const rawInvoices =
    section.invoices ??
    section.active_invoices ??
    section.items ??
    section.rows ??
    [];

  const invoices = asArray<Record<string, unknown>>(rawInvoices).map((invoice) =>
    mapInvoice(invoice, {
      category_id: categoryId,
      category_name: categoryName,
      category_slug: categorySlug,
    })
  );

  return {
    category_id: categoryId,
    category_name: categoryName,
    category_slug: categorySlug,
    invoices: options.onlyOpen ? invoices.filter(isOpenInvoice) : invoices,
  } satisfies InvoiceCategorySection;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStringValue(value: unknown, fallback = "") {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return fallback;
}

function toNullableStringValue(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  return toStringValue(value);
}

function toBooleanValue(value: unknown, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase();
    if (["true", "t", "yes", "1", "si", "sí"].includes(normalizedValue)) {
      return true;
    }
    if (["false", "f", "no", "0"].includes(normalizedValue)) {
      return false;
    }
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  return fallback;
}

function slugifyInvoiceCategory(value: string) {
  const normalizedValue = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalizedValue || "sin-categoria";
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function buildDashboardPath(userHashId: string, houseCode: string) {
  return `/dashboard/${userHashId}/${houseCode}`;
}

function readPublicIdentifier(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  return normalizedValue;
}

export function readUserHashId(value: unknown) {
  return readPublicIdentifier(value);
}

export function readHousePublicCode(value: unknown) {
  return readPublicIdentifier(value);
}

export function readInviteCode(value: unknown) {
  return readPublicIdentifier(value);
}

export async function getAuthenticatedProfileHashId() {
  const { profile } = await getAuthenticatedProfileContext();
  return profile.user_hash_id;
}

export function getJoinHouseErrorMessage(errorMessage?: string | null) {
  const normalizedError = errorMessage?.trim().toLowerCase() ?? "";

  if (
    normalizedError.includes("no existe") ||
    normalizedError.includes("invita") ||
    normalizedError.includes("caduc") ||
    normalizedError.includes("expir") ||
    normalizedError.includes("agot") ||
    normalizedError.includes("full") ||
    normalizedError.includes("used")
  ) {
    return "Código de invitación no válido";
  }

  return errorMessage?.trim() || "Código de invitación no válido";
}

export function formatCurrency(amount: number | string, currency = "EUR") {
  const numericAmount = typeof amount === "number" ? amount : Number(amount);

  if (!Number.isFinite(numericAmount)) {
    return `0 ${currency}`;
  }

  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    minimumFractionDigits: Number.isInteger(numericAmount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(numericAmount);
}

export function formatShortDate(dateValue: string) {
  const parsedDate = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return dateValue;
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsedDate);
}

export function formatMonthLabel(dateValue: string) {
  const parsedDate = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Sin fecha";
  }

  const formatted = new Intl.DateTimeFormat("es-ES", {
    month: "long",
    year: "numeric",
  }).format(parsedDate);

  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function readProfileRecord(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  const userHashId = readUserHashId(value.user_hash_id);
  if (!userHashId) {
    return null;
  }

  return {
    id: toStringValue(value.id),
    email: toNullableStringValue(value.email),
    full_name: toNullableStringValue(value.full_name),
    avatar_url: toNullableStringValue(value.avatar_url),
    user_hash_id: userHashId,
  } satisfies ProfileRecord & { user_hash_id: string };
}

function readHouseRecord(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  const publicCode = readHousePublicCode(value.public_code);
  if (!publicCode) {
    return null;
  }

  return {
    id: toStringValue(value.id),
    name: toStringValue(value.name),
    public_code: publicCode,
    created_by: toStringValue(value.created_by),
  } satisfies HouseRecord;
}

export async function getAuthenticatedProfileContext(): Promise<AuthenticatedDashboardContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase.rpc("get_authenticated_profile_context");
  const profile = readProfileRecord(data);

  if (error || !profile) {
    notFound();
  }

  return {
    supabase,
    profile,
  };
}

export async function getAccessibleHouseContext(
  userHashId: string,
  houseCode: string
): Promise<AccessibleHouseContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase.rpc("get_accessible_house_context", {
    p_user_hash_id: userHashId,
    p_house_public_code: houseCode,
  });

  const profile = isRecord(data) ? readProfileRecord(data.profile) : null;
  const house = isRecord(data) ? readHouseRecord(data.house) : null;

  if (error || !profile || !house) {
    notFound();
  }

  return {
    supabase,
    profile,
    house,
    memberRole: isRecord(data) ? toStringValue(data.member_role, "member") : "member",
    dashboardPath: buildDashboardPath(userHashId, house.public_code),
  };
}

export async function loadProfileSettingsWithClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  houseCode: string
) {
  const { data, error } = await supabase.rpc("get_profile_settings", {
    p_house_public_code: houseCode,
  });

  if (error || !isRecord(data)) {
    notFound();
  }

  const profile = isRecord(data.profile) ? data.profile : {};
  const houseMember = isRecord(data.house_member) ? data.house_member : {};

  return {
    profile: {
      id: toStringValue(profile.id),
      email: toNullableStringValue(profile.email),
      full_name: toNullableStringValue(profile.full_name),
      avatar_url: toNullableStringValue(profile.avatar_url),
      avatar_storage_path: toNullableStringValue(profile.avatar_storage_path),
      user_hash_id: toStringValue(profile.user_hash_id),
    },
    house_member: {
      role: toStringValue(houseMember.role, "member"),
      room_label: toNullableStringValue(houseMember.room_label),
      room_size: toNullableStringValue(houseMember.room_size),
      stay_start_date: toNullableStringValue(houseMember.stay_start_date),
      stay_end_date: toNullableStringValue(houseMember.stay_end_date),
    },
    can_remove_members: data.can_remove_members === true,
    removable_members: asArray<Record<string, unknown>>(
      data.removable_members
    ).map(
      (member) =>
        ({
          profile_id: toStringValue(member.profile_id),
          display_name: toStringValue(member.display_name),
          role: toStringValue(member.role, "member"),
        }) satisfies ProfileSettingsMemberOption
    ),
  } satisfies ProfileSettingsData;
}

export async function getDefaultDashboardPath() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase.rpc("get_default_dashboard_context");

  if (error) {
    notFound();
  }

  if (!isRecord(data)) {
    return "/login?flow=join";
  }

  const userHashId = readUserHashId(data.user_hash_id);
  const housePublicCode = readHousePublicCode(data.house_public_code);

  if (!userHashId || !housePublicCode) {
    return "/login?flow=join";
  }

  return buildDashboardPath(userHashId, housePublicCode);
}

export async function loadActiveHouseInviteWithClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  houseCode: string
): Promise<HouseInviteRecord> {
  const { data, error } = await supabase.rpc("get_active_house_invite_code", {
    p_house_public_code: houseCode,
  });

  if (error) {
    return {
      inviteCode: null,
      canManageInvites: false,
    };
  }

  return {
    inviteCode: readInviteCode(data),
    canManageInvites: true,
  };
}

export async function loadHouseExpensesDashboard(
  houseCode: string,
  ticketLimit = 5,
  expenseLimit = 5
) {
  const { supabase } = await getAuthenticatedProfileContext();
  return loadHouseExpensesDashboardWithClient(
    supabase,
    houseCode,
    ticketLimit,
    expenseLimit
  );
}

export async function loadHouseExpensesDashboardWithClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  houseCode: string,
  ticketLimit = 5,
  expenseLimit = 5
) {
  const { data, error } = await supabase.rpc("get_house_expenses_dashboard", {
    p_house_public_code: houseCode,
    p_ticket_limit: ticketLimit,
    p_expense_limit: expenseLimit,
  });

  if (error) {
    notFound();
  }

  if (!isRecord(data)) {
    return {
      house: null,
      tickets: [],
      shared_expenses: [],
      settlements: [],
      pending_payment_confirmations: [],
    } satisfies ExpensesDashboardData;
  }

  const house = isRecord(data.house)
    ? {
        id: String(data.house.id ?? ""),
        name: String(data.house.name ?? ""),
        public_code: String(data.house.public_code ?? houseCode),
      }
    : null;
  const rawSettlements = asArray<Record<string, unknown>>(data.settlements);
  const rawPendingPaymentConfirmations = asArray<Record<string, unknown>>(
    data.pending_payment_confirmations
  );
  const avatarUrlMap = await loadProfileAvatarUrlMapWithClient(
    supabase,
    [
      ...rawSettlements.flatMap((settlement) => [
        toStringValue(settlement.from_profile_id),
        toStringValue(settlement.to_profile_id),
      ]),
      ...rawPendingPaymentConfirmations.flatMap((payment) => [
        toStringValue(payment.from_profile_id),
        toStringValue(payment.to_profile_id),
      ]),
    ]
  );

  const tickets = await addTicketPayerAvatarsWithClient(
    supabase,
    asArray<Record<string, unknown>>(data.tickets).map(mapExpenseTicket)
  );
  const sharedExpenses = await addSharedExpenseParticipantAvatarsWithClient(
    supabase,
    asArray<Record<string, unknown>>(data.shared_expenses).map(mapSharedExpense)
  );

  return {
    house,
    tickets,
    shared_expenses: sharedExpenses,
    settlements: rawSettlements.map((settlement) => {
      const fromProfileId = toStringValue(settlement.from_profile_id);
      const toProfileId = toStringValue(settlement.to_profile_id);

      return {
        from_profile_id: fromProfileId,
        from_name: toStringValue(settlement.from_name),
        from_avatar_url: avatarUrlMap.get(fromProfileId) ?? null,
        to_profile_id: toProfileId,
        to_name: toStringValue(settlement.to_name),
        to_avatar_url: avatarUrlMap.get(toProfileId) ?? null,
        amount: toNumericLikeValue(settlement.amount),
      } satisfies Settlement;
    }),
    pending_payment_confirmations: rawPendingPaymentConfirmations.map((payment) => {
      const fromProfileId = toStringValue(payment.from_profile_id);
      const toProfileId = toStringValue(payment.to_profile_id);

      return {
          payment_id: toStringValue(payment.payment_id),
          expense_id: toNullableStringValue(payment.expense_id),
          expense_title: toNullableStringValue(payment.expense_title),
          from_profile_id: fromProfileId,
          from_name: toStringValue(payment.from_name),
          from_avatar_url: avatarUrlMap.get(fromProfileId) ?? null,
          to_profile_id: toProfileId,
          to_name: toStringValue(payment.to_name),
          to_avatar_url: avatarUrlMap.get(toProfileId) ?? null,
          amount:
            typeof payment.amount === "number" || typeof payment.amount === "string"
              ? payment.amount
              : 0,
          payment_date: toStringValue(payment.payment_date),
          note: toNullableStringValue(payment.note),
          status: toStringValue(payment.status),
          can_review: payment.can_review === true,
        } satisfies PendingPaymentConfirmation;
    }),
  } satisfies ExpensesDashboardData;
}

export async function loadHousePurchaseTicketsHistoryWithClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  houseCode: string,
  limit = 100,
  offset = 0
) {
  const { data, error } = await supabase.rpc("get_house_purchase_tickets_history", {
    p_house_public_code: houseCode,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    notFound();
  }

  return addTicketPayerAvatarsWithClient(
    supabase,
    asArray<Record<string, unknown>>(data).map(mapExpenseTicket)
  );
}

export async function loadOpenHousePurchaseTicketsWithClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  houseCode: string,
  limit = 50
) {
  const { data, error } = await supabase.rpc("get_house_purchase_tickets", {
    p_house_public_code: houseCode,
    p_limit: limit,
  });

  if (error) {
    notFound();
  }

  return addTicketPayerAvatarsWithClient(
    supabase,
    asArray<Record<string, unknown>>(data).map(mapExpenseTicket)
  );
}

export async function loadHouseSharedExpensesHistoryWithClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  houseCode: string,
  limit = 100,
  offset = 0
) {
  const { data, error } = await supabase.rpc("get_house_shared_expenses_history", {
    p_house_public_code: houseCode,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    notFound();
  }

  return addSharedExpenseParticipantAvatarsWithClient(
    supabase,
    asArray<Record<string, unknown>>(data).map(mapSharedExpense)
  );
}

export async function loadOpenHouseSharedExpensesWithClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  houseCode: string,
  limit = 50
) {
  const { data, error } = await supabase.rpc("get_house_shared_expenses", {
    p_house_public_code: houseCode,
    p_limit: limit,
  });

  if (error) {
    notFound();
  }

  return addSharedExpenseParticipantAvatarsWithClient(
    supabase,
    asArray<Record<string, unknown>>(data).map(mapSharedExpense)
  );
}

export async function loadHouseInvoicesDashboardWithClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  houseCode: string,
  limit = 5
) {
  const attempts = [
    { p_house_public_code: houseCode, p_limit_per_category: limit },
    { p_house_public_code: houseCode, p_limit: limit },
    { p_house_public_code: houseCode, p_invoice_limit: limit },
    { house_public_code: houseCode, invoice_limit: limit },
    { house_public_code: houseCode, limit },
  ];
  let data: unknown = null;
  let lastError: unknown = null;

  for (const args of attempts) {
    const result = await supabase.rpc("get_house_invoices_dashboard", args);

    if (!result.error) {
      data = result.data;
      lastError = null;
      break;
    }

    lastError = result.error;
  }

  if (lastError) {
    console.error("get_house_invoices_dashboard failed", lastError);
    return { sections: [] } satisfies InvoicesDashboardData;
  }

  if (isRecord(data) && Array.isArray(data.sections)) {
    return {
      sections: dedupeInvoiceSections(
        asArray<Record<string, unknown>>(data.sections).map((section) =>
          readInvoiceSection(section, { onlyOpen: true })
        )
      ),
    } satisfies InvoicesDashboardData;
  }

  if (isRecord(data) && Array.isArray(data.categories)) {
    const categorySections = asArray<Record<string, unknown>>(data.categories)
      .filter(
        (category) =>
          Array.isArray(category.invoices) ||
          Array.isArray(category.active_invoices) ||
          Array.isArray(category.items) ||
          Array.isArray(category.rows)
      )
      .map((section) => readInvoiceSection(section, { onlyOpen: true }));

    if (categorySections.length) {
      return {
        sections: dedupeInvoiceSections(categorySections),
      } satisfies InvoicesDashboardData;
    }
  }

  if (Array.isArray(data)) {
    const rows = asArray<Record<string, unknown>>(data);
    const sectionRows = rows.filter(
      (row) =>
        Array.isArray(row.invoices) ||
        Array.isArray(row.active_invoices) ||
        Array.isArray(row.items) ||
        Array.isArray(row.rows)
    );

    if (sectionRows.length === rows.length && sectionRows.length > 0) {
      return {
        sections: dedupeInvoiceSections(
          sectionRows.map((section) => readInvoiceSection(section, { onlyOpen: true }))
        ),
      } satisfies InvoicesDashboardData;
    }

    return {
      sections: dedupeInvoiceSections(
        groupInvoicesByCategory(
        rows.map((invoice) => mapInvoice(invoice)).filter(isOpenInvoice)
        )
      ),
    } satisfies InvoicesDashboardData;
  }

  if (isRecord(data)) {
    const invoices = asArray<Record<string, unknown>>(
      data.invoices ?? data.active_invoices ?? data.items ?? data.rows
    )
      .map((invoice) => mapInvoice(invoice))
      .filter(isOpenInvoice);
    const sections = groupInvoicesByCategory(invoices);

    for (const category of [
      ...asArray<Record<string, unknown>>(
        data.categories ?? data.invoice_categories
      ),
      ...asArray<Record<string, unknown>>(data.global_categories),
      ...asArray<Record<string, unknown>>(data.custom_categories),
    ].map(mapInvoiceCategory)) {
      const exists = sections.some(
        (section) =>
          section.category_id === category.category_id ||
          section.category_slug === category.slug
      );

      if (!exists) {
        sections.push({
          category_id: category.category_id,
          category_name: category.name,
          category_slug: category.slug,
          invoices: [],
        });
      }
    }

    return {
      sections: dedupeInvoiceSections(sections),
    } satisfies InvoicesDashboardData;
  }

  return { sections: [] } satisfies InvoicesDashboardData;
}

export async function loadHouseInvoiceHistoryWithClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  houseCode: string,
  limit = 100,
  offset = 0
) {
  const attempts = [
    { p_house_public_code: houseCode, p_limit: limit, p_offset: offset },
    { house_public_code: houseCode, limit, offset },
    { p_house_public_code: houseCode },
    { house_public_code: houseCode },
  ];
  let data: unknown = null;
  let lastError: unknown = null;

  for (const args of attempts) {
    const result = await supabase.rpc("get_house_invoice_history", args);

    if (!result.error) {
      data = result.data;
      lastError = null;
      break;
    }

    lastError = result.error;
  }

  if (lastError) {
    console.error("get_house_invoice_history failed", lastError);
    return [];
  }

  if (isRecord(data) && Array.isArray(data.sections)) {
    return asArray<Record<string, unknown>>(data.sections).flatMap((section) =>
      readInvoiceSection(section).invoices
    );
  }

  if (isRecord(data) && Array.isArray(data.categories)) {
    const categorySections = asArray<Record<string, unknown>>(data.categories)
      .filter(
        (category) =>
          Array.isArray(category.invoices) ||
          Array.isArray(category.active_invoices) ||
          Array.isArray(category.items) ||
          Array.isArray(category.rows)
      )
      .flatMap((section) => readInvoiceSection(section).invoices);

    if (categorySections.length) {
      return categorySections;
    }
  }

  if (Array.isArray(data)) {
    const rows = asArray<Record<string, unknown>>(data);
    const sectionRows = rows.filter(
      (row) =>
        Array.isArray(row.invoices) ||
        Array.isArray(row.active_invoices) ||
        Array.isArray(row.items) ||
        Array.isArray(row.rows)
    );

    if (sectionRows.length === rows.length && sectionRows.length > 0) {
      return sectionRows.flatMap((section) => readInvoiceSection(section).invoices);
    }

    return rows.map((invoice) => mapInvoice(invoice));
  }

  const invoices = isRecord(data)
    ? asArray<Record<string, unknown>>(
        data.invoices ?? data.history ?? data.items ?? data.rows
      )
    : [];

  return invoices.map((invoice) => mapInvoice(invoice));
}

export async function loadHouseCleaningDashboardWithClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  houseCode: string,
  limit = 50
) {
  const attempts = [
    { p_house_public_code: houseCode, p_limit_per_zone: limit },
    { house_public_code: houseCode, limit },
  ];
  let data: unknown = null;
  let lastError: unknown = null;

  for (const args of attempts) {
    const result = await supabase.rpc("get_house_cleaning_dashboard", args);

    if (!result.error) {
      data = result.data;
      lastError = null;
      break;
    }

    lastError = result.error;
  }

  if (lastError) {
    console.error("get_house_cleaning_dashboard failed", lastError);
    return { zones: [] } satisfies CleaningDashboardData;
  }

  if (isRecord(data)) {
    const rawSections = asArray<Record<string, unknown>>(
      data.zones ?? data.sections ?? data.cleaning_zones ?? data.rooms
    );

    if (rawSections.length) {
      return {
        zones: rawSections.map(mapCleaningSection),
      } satisfies CleaningDashboardData;
    }

    const tasks = asArray<Record<string, unknown>>(
      data.tasks ?? data.cleaning_tasks ?? data.items ?? data.rows
    ).map((task) => mapCleaningTask(task));

    return {
      zones: groupCleaningTasksByZone(tasks),
    } satisfies CleaningDashboardData;
  }

  if (Array.isArray(data)) {
    const rows = asArray<Record<string, unknown>>(data);
    const sectionRows = rows.filter(
      (row) =>
        Array.isArray(row.tasks) ||
        Array.isArray(row.cleaning_tasks) ||
        Array.isArray(row.items) ||
        Array.isArray(row.rows)
    );

    if (sectionRows.length === rows.length && sectionRows.length > 0) {
      return {
        zones: sectionRows.map(mapCleaningSection),
      } satisfies CleaningDashboardData;
    }

    return {
      zones: groupCleaningTasksByZone(rows.map((task) => mapCleaningTask(task))),
    } satisfies CleaningDashboardData;
  }

  return { zones: [] } satisfies CleaningDashboardData;
}

export async function loadAddCleaningTaskFormOptionsWithClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  houseCode: string
) {
  const attempts = [
    { p_house_public_code: houseCode },
    { house_public_code: houseCode },
  ];
  let data: unknown = null;
  let lastError: unknown = null;

  for (const args of attempts) {
    const result = await supabase.rpc("get_add_cleaning_task_form_options", args);

    if (!result.error) {
      data = result.data;
      lastError = null;
      break;
    }

    lastError = result.error;
  }

  if (lastError) {
    console.error("get_add_cleaning_task_form_options failed", lastError);
  }

  if (lastError || !isRecord(data)) {
    return {
      zones: [],
      members: [],
    } satisfies AddCleaningTaskFormOptions;
  }

  const members = asArray<Record<string, unknown>>(
    data.members ?? data.house_members
  ).map(mapCleaningMember);
  const avatarUrlMap = await loadProfileAvatarUrlMapWithClient(
    supabase,
    members.map((member) => member.profile_id)
  );

  return {
    zones: asArray<Record<string, unknown>>(
      data.zones ?? data.cleaning_zones ?? data.rooms
    ).map(mapCleaningZone),
    members: members.map((member) => ({
      ...member,
      avatar_url: avatarUrlMap.get(member.profile_id) ?? member.avatar_url,
    })),
  } satisfies AddCleaningTaskFormOptions;
}

export async function loadHouseCleaningTaskHistoryWithClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  houseCode: string,
  limit = 100,
  offset = 0,
  zoneId: string | null = null,
  zoneName: string | null = null
) {
  const zoneScopedAttempts = zoneId
    ? [
        {
          args: {
            p_house_public_code: houseCode,
            p_zone_id: zoneId,
            p_limit: limit,
            p_offset: offset,
          },
          scopedByZone: true,
        },
        {
          args: {
            p_house_public_code: houseCode,
            p_cleaning_zone_id: zoneId,
            p_limit: limit,
            p_offset: offset,
          },
          scopedByZone: true,
        },
      ]
    : [];
  const attempts = [
    ...zoneScopedAttempts,
    {
      args: {
        p_house_public_code: houseCode,
        p_zone_id: null,
        p_limit: limit,
        p_offset: offset,
      },
      scopedByZone: false,
    },
    {
      args: { p_house_public_code: houseCode, p_limit: limit, p_offset: offset },
      scopedByZone: false,
    },
    { args: { house_public_code: houseCode, limit, offset }, scopedByZone: false },
  ];
  let data: unknown = null;
  let lastError: unknown = null;
  let scopedByZone = false;

  for (const attempt of attempts) {
    const result = await supabase.rpc(
      "get_house_cleaning_task_history",
      attempt.args
    );

    if (!result.error) {
      data = result.data;
      lastError = null;
      scopedByZone = attempt.scopedByZone;
      break;
    }

    lastError = result.error;
  }

  if (lastError) {
    console.error("get_house_cleaning_task_history failed", lastError);
    throw lastError;
  }

  const tasks = isRecord(data)
    ? asArray<Record<string, unknown>>(
        data.tasks ??
          data.cleaning_tasks ??
          data.history ??
          data.items ??
          data.rows ??
          data.data
      ).map((task) => mapCleaningTask(task))
    : asArray<Record<string, unknown>>(data).map((task) => mapCleaningTask(task));

  if (zoneId && scopedByZone && tasks.length === 0 && zoneName) {
    return loadHouseCleaningTaskHistoryWithClient(
      supabase,
      houseCode,
      limit,
      offset,
      null,
      zoneName
    );
  }

  if (zoneId && !scopedByZone) {
    return tasks.filter((task) => task.zone_id === zoneId);
  }

  if (zoneName && !scopedByZone) {
    return tasks.filter(
      (task) => task.zone_name.toLowerCase() === zoneName.toLowerCase()
    );
  }

  return tasks;
}

export async function loadAddInvoiceFormOptionsWithClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  houseCode: string
) {
  const attempts = [
    { p_house_public_code: houseCode },
    { house_public_code: houseCode },
  ];
  let data: unknown = null;
  let lastError: unknown = null;

  for (const args of attempts) {
    const result = await supabase.rpc("get_add_invoice_form_options", args);

    if (!result.error) {
      data = result.data;
      lastError = null;
      break;
    }

    lastError = result.error;
  }

  if (lastError) {
    console.error("get_add_invoice_form_options failed", lastError);
  }

  if (lastError || !isRecord(data)) {
    return {
      categories: [],
      members: [],
    } satisfies AddInvoiceFormOptions;
  }

  const members = asArray<Record<string, unknown>>(
    data.members ?? data.house_members
  ).map(mapInvoiceMember);
  const avatarUrlMap = await loadProfileAvatarUrlMapWithClient(
    supabase,
    members.map((member) => member.profile_id)
  );

  return {
    categories: dedupeInvoiceCategories(
      [
        ...asArray<Record<string, unknown>>(
          data.categories ?? data.invoice_categories
        ),
        ...asArray<Record<string, unknown>>(data.global_categories),
        ...asArray<Record<string, unknown>>(data.custom_categories),
      ].map(mapInvoiceCategory)
    ),
    members: members.map((member) => ({
      ...member,
      avatar_url: avatarUrlMap.get(member.profile_id) ?? member.avatar_url,
    })),
  } satisfies AddInvoiceFormOptions;
}

export async function loadHousePendingPaymentConfirmationsWithClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  houseCode: string
) {
  const { data, error } = await supabase.rpc(
    "get_house_pending_payment_confirmations",
    {
      p_house_public_code: houseCode,
    }
  );

  if (error) {
    return [] satisfies PendingPaymentConfirmation[];
  }

  const payments = asArray<Record<string, unknown>>(data);
  const avatarUrlMap = await loadProfileAvatarUrlMapWithClient(
    supabase,
    payments.flatMap((payment) => [
      toStringValue(payment.from_profile_id),
      toStringValue(payment.to_profile_id),
    ])
  );

  return payments.map((payment) => {
    const fromProfileId = toStringValue(payment.from_profile_id);
    const toProfileId = toStringValue(payment.to_profile_id);

    return {
        payment_id: toStringValue(payment.payment_id),
        expense_id: toNullableStringValue(payment.expense_id),
        expense_title: toNullableStringValue(payment.expense_title),
        from_profile_id: fromProfileId,
        from_name: toStringValue(payment.from_name),
        from_avatar_url: avatarUrlMap.get(fromProfileId) ?? null,
        to_profile_id: toProfileId,
        to_name: toStringValue(payment.to_name),
        to_avatar_url: avatarUrlMap.get(toProfileId) ?? null,
        amount: toNumericLikeValue(payment.amount),
        payment_date: toStringValue(payment.payment_date),
        note: toNullableStringValue(payment.note),
        status: toStringValue(payment.status),
        can_review: payment.can_review === true,
      } satisfies PendingPaymentConfirmation;
  });
}

export async function loadAddExpenseFormOptionsWithClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  houseCode: string
) {
  const { data, error } = await supabase.rpc("get_add_expense_form_options", {
    p_house_public_code: houseCode,
  });

  if (error || !isRecord(data)) {
    return {
      members: [],
      items: [],
    } satisfies AddExpenseFormOptions;
  }

  const members = asArray<Record<string, unknown>>(data.members).map(
    (member) =>
      ({
          profile_id: toStringValue(member.profile_id),
          display_name: toStringValue(member.display_name),
          role: toStringValue(member.role, "member"),
          avatar_url: toNullableStringValue(member.avatar_url),
        }) satisfies AddExpenseMember
  );
  const avatarUrlMap = await loadProfileAvatarUrlMapWithClient(
    supabase,
    members.map((member) => member.profile_id)
  );

  return {
    members: members.map((member) => ({
      ...member,
      avatar_url: avatarUrlMap.get(member.profile_id) ?? member.avatar_url,
    })),
    items: asArray<Record<string, unknown>>(data.items).map(
      (item) =>
        ({
          item_id: toStringValue(item.item_id),
          name: toStringValue(item.name),
        }) satisfies AddExpenseCatalogItem
    ),
  } satisfies AddExpenseFormOptions;
}

type LoadCurrentUserExpenseStatesInput = {
  houseCode: string;
  expenseIds: string[];
};

export async function loadCurrentUserExpenseStatesWithClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  { houseCode, expenseIds }: LoadCurrentUserExpenseStatesInput
) {
  if (!expenseIds.length) {
    return [] satisfies CurrentUserExpenseState[];
  }

  const { data, error } = await supabase.rpc("get_current_user_expense_states", {
    p_house_public_code: houseCode,
    p_expense_ids: expenseIds,
  });

  if (error) {
    return [] satisfies CurrentUserExpenseState[];
  }

  return asArray<Record<string, unknown>>(data).map(
    (state) =>
      ({
        expense_id: toStringValue(state.expense_id),
        profile_id: toStringValue(state.profile_id),
        share_amount: toNumericLikeValue(state.share_amount),
        participant_status: toStringValue(state.participant_status, "pending"),
        pending_payment_id: toNullableStringValue(state.pending_payment_id),
        pending_payment_amount:
          state.pending_payment_amount === null ||
          state.pending_payment_amount === undefined
            ? null
            : toNumericLikeValue(state.pending_payment_amount),
        pending_payment_note: toNullableStringValue(state.pending_payment_note),
      }) satisfies CurrentUserExpenseState
  );
}

export async function loadHouseMemberCountWithClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  houseCode: string
) {
  const { data, error } = await supabase.rpc("get_house_member_count", {
    p_house_public_code: houseCode,
  });

  if (error) {
    return 0;
  }

  const count = typeof data === "number" ? data : Number(data ?? 0);
  return Number.isFinite(count) ? count : 0;
}

function mapPersonalAreaDebtItem(item: Record<string, unknown>) {
  return {
    expense_id: toStringValue(item.expense_id),
    payment_id: toNullableStringValue(item.payment_id),
    person_name: toStringValue(item.person_name, "Companero"),
    person_avatar_url: toNullableStringValue(item.person_avatar_url),
    title: toStringValue(item.title, "Gasto"),
    item_date: toStringValue(item.item_date),
    amount: toNumericLikeValue(item.amount),
    currency: toStringValue(item.currency, "EUR"),
    status: toStringValue(item.status, "pending"),
  } satisfies PersonalAreaDebtItem;
}

function mapPersonalAreaHistoryItem(item: Record<string, unknown>) {
  return {
    item_type: toStringValue(item.item_type),
    item_id: toStringValue(item.item_id),
    title: toStringValue(item.title, "Movimiento"),
    subtitle: toStringValue(item.subtitle),
    item_date: toStringValue(item.item_date),
    amount: toNumericLikeValue(item.amount),
    currency: toStringValue(item.currency, "EUR"),
    status: toStringValue(item.status),
    icon_type: toStringValue(item.icon_type, "expense"),
  } satisfies PersonalAreaHistoryItem;
}

const emptyPersonalAreaDashboard = {
  summary: {
    my_debts_total: 0,
    my_debts_count: 0,
    owed_to_me_total: 0,
    owed_to_me_count: 0,
    monthly_spending_total: 0,
    previous_month_spending_total: 0,
  },
  debts: [],
  receivables: [],
  history: [],
  calendar_events: [],
  chart: [],
} satisfies PersonalAreaDashboardData;

function toNumberValue(value: number | string | null | undefined) {
  const numericValue =
    typeof value === "number" ? value : Number(String(value ?? 0));

  return Number.isFinite(numericValue) ? numericValue : 0;
}

function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function applySettlementBalances(
  data: PersonalAreaDashboardData,
  settlements: Settlement[],
  currentProfileId: string
) {
  const itemDate = todayDateKey();
  const settlementDebts = settlements
    .filter((settlement) => settlement.from_profile_id === currentProfileId)
    .map(
      (settlement) =>
        ({
          expense_id: `settlement-${settlement.to_profile_id}`,
          payment_id: null,
          person_name: settlement.to_name,
          person_avatar_url: settlement.to_avatar_url,
          title: "Pago simplificado",
          item_date: itemDate,
          amount: settlement.amount,
          currency: "EUR",
          status: "settlement",
        }) satisfies PersonalAreaDebtItem
    );
  const settlementReceivables = settlements
    .filter((settlement) => settlement.to_profile_id === currentProfileId)
    .map(
      (settlement) =>
        ({
          expense_id: `settlement-${settlement.from_profile_id}`,
          payment_id: null,
          person_name: settlement.from_name,
          person_avatar_url: settlement.from_avatar_url,
          title: "Pago simplificado",
          item_date: itemDate,
          amount: settlement.amount,
          currency: "EUR",
          status: "settlement",
          can_verify: false,
        }) satisfies PersonalAreaReceivableItem
    );

  return {
    ...data,
    summary: {
      ...data.summary,
      my_debts_total: settlementDebts.reduce(
        (sum, debt) => sum + toNumberValue(debt.amount),
        0
      ),
      my_debts_count: settlementDebts.length,
      owed_to_me_total: settlementReceivables.reduce(
        (sum, receivable) => sum + toNumberValue(receivable.amount),
        0
      ),
      owed_to_me_count: settlementReceivables.length,
    },
    debts: settlementDebts,
    receivables: settlementReceivables,
    calendar_events: [
      ...data.calendar_events,
      ...settlementDebts.map((debt) => ({
        event_id: `settlement-debt:${debt.expense_id}`,
        event_type: "deuda",
        title: debt.title,
        event_date: debt.item_date,
        amount: debt.amount,
        currency: debt.currency,
        person_name: debt.person_name,
        person_avatar_url: debt.person_avatar_url,
      })),
      ...settlementReceivables.map((receivable) => ({
        event_id: `settlement-receivable:${receivable.expense_id}`,
        event_type: "me_deben",
        title: receivable.title,
        event_date: receivable.item_date,
        amount: receivable.amount,
        currency: receivable.currency,
        person_name: receivable.person_name,
        person_avatar_url: receivable.person_avatar_url,
      })),
    ],
  } satisfies PersonalAreaDashboardData;
}

export async function loadPersonalAreaDashboardWithClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  houseCode: string,
  currentProfileId: string,
  historyLimit = 20
) {
  const [personalResult, expensesDashboard] = await Promise.all([
    supabase.rpc("get_personal_area_dashboard", {
      p_house_public_code: houseCode,
      p_history_limit: historyLimit,
    }),
    loadHouseExpensesDashboardWithClient(supabase, houseCode, 5, 5),
  ]);
  const { data, error } = personalResult;

  if (error || !isRecord(data)) {
    return applySettlementBalances(
      emptyPersonalAreaDashboard,
      expensesDashboard.settlements,
      currentProfileId
    );
  }

  const summary = isRecord(data.summary) ? data.summary : {};

  const personalData = {
    summary: {
      my_debts_total: toNumericLikeValue(summary.my_debts_total),
      my_debts_count: Number(summary.my_debts_count ?? 0),
      owed_to_me_total: toNumericLikeValue(summary.owed_to_me_total),
      owed_to_me_count: Number(summary.owed_to_me_count ?? 0),
      monthly_spending_total: toNumericLikeValue(summary.monthly_spending_total),
      previous_month_spending_total: toNumericLikeValue(
        summary.previous_month_spending_total
      ),
    },
    debts: asArray<Record<string, unknown>>(data.debts).map(
      mapPersonalAreaDebtItem
    ),
    receivables: asArray<Record<string, unknown>>(data.receivables).map(
      (item) =>
        ({
          ...mapPersonalAreaDebtItem(item),
          can_verify: toBooleanValue(item.can_verify),
        }) satisfies PersonalAreaReceivableItem
    ),
    history: asArray<Record<string, unknown>>(data.history).map(
      mapPersonalAreaHistoryItem
    ),
    calendar_events: asArray<Record<string, unknown>>(data.calendar_events).map(
      (event) => ({
        event_id: toStringValue(event.event_id),
        event_type: toStringValue(event.event_type),
        title: toStringValue(event.title, "Evento"),
        event_date: toStringValue(event.event_date),
        amount: toNumericLikeValue(event.amount),
        currency: toStringValue(event.currency, "EUR"),
        person_name: toStringValue(event.person_name),
        person_avatar_url: toNullableStringValue(event.person_avatar_url),
      })
    ),
    chart: asArray<Record<string, unknown>>(data.chart).map((item) => ({
      name: toStringValue(item.name, "Otros"),
      amount: toNumericLikeValue(item.amount),
    })),
  } satisfies PersonalAreaDashboardData;

  return applySettlementBalances(
    personalData,
    expensesDashboard.settlements,
    currentProfileId
  );
}

