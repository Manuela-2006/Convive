import { notFound, redirect } from "next/navigation";

import type {
  AddExpenseFormOptions,
  AddExpenseCatalogItem,
  AddExpenseMember,
  CurrentUserExpenseState,
  ExpenseTicket,
  ExpensesDashboardData,
  PendingPaymentConfirmation,
  Settlement,
  SharedExpense,
} from "./dashboard-types";
import { createClient } from "../utils/supabase/server";

type ProfileRecord = {
  id: string;
  email: string | null;
  full_name: string | null;
  public_code: string | null;
};

type HouseRecord = {
  id: string;
  name: string;
  public_code: string;
  created_by: string;
};

type HouseMembershipRecord = {
  role: string;
  house: HouseRecord | HouseRecord[] | null;
};

type AuthenticatedDashboardContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  profile: ProfileRecord & {
    public_code: string;
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
    total_amount: toNumericLikeValue(ticket.total_amount),
    my_share_amount:
      ticket.my_share_amount === null || ticket.my_share_amount === undefined
        ? null
        : toNumericLikeValue(ticket.my_share_amount, 0),
    currency: toStringValue(ticket.currency, "EUR"),
    ticket_file_path: toNullableStringValue(ticket.ticket_file_path),
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function takeSingleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export function buildDashboardPath(userCode: string, houseCode: string) {
  return `/dashboard/${userCode}/${houseCode}`;
}

export function readPublicCode(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  return normalizedValue;
}

export function readHousePublicCode(value: unknown) {
  return readPublicCode(value);
}

export function readInviteCode(value: unknown) {
  return readPublicCode(value);
}

export async function getAuthenticatedProfilePublicCode() {
  const { profile } = await getAuthenticatedProfileContext();
  return profile.public_code;
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
    return "Codigo de invitacion no valido";
  }

  return errorMessage?.trim() || "Codigo de invitacion no valido";
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

export async function getAuthenticatedProfileContext(): Promise<AuthenticatedDashboardContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, public_code")
    .eq("id", user.id)
    .single();

  if (error || !profile?.public_code) {
    notFound();
  }

  return {
    supabase,
    profile: profile as ProfileRecord & { public_code: string },
  };
}

export async function getAccessibleHouseContext(
  userCode: string,
  houseCode: string
): Promise<AccessibleHouseContext> {
  const context = await getAuthenticatedProfileContext();

  if (context.profile.public_code !== userCode) {
    notFound();
  }

  const { data: membership, error } = await context.supabase
    .from("house_members")
    .select(
      `
        role,
        house:houses!inner (
          id,
          name,
          public_code,
          created_by
        )
      `
    )
    .eq("profile_id", context.profile.id)
    .eq("is_active", true)
    .eq("houses.public_code", houseCode)
    .limit(1)
    .maybeSingle();

  const house = takeSingleRelation(
    (membership as HouseMembershipRecord | null)?.house
  );

  if (error || !house?.public_code) {
    notFound();
  }

  return {
    ...context,
    house,
    memberRole: (membership as HouseMembershipRecord | null)?.role ?? "member",
    dashboardPath: buildDashboardPath(userCode, house.public_code),
  };
}

export async function getDefaultDashboardPath() {
  const { supabase, profile } = await getAuthenticatedProfileContext();

  const { data: membership } = await supabase
    .from("house_members")
    .select(
      `
        joined_at,
        house:houses!inner (
          public_code
        )
      `
    )
    .eq("profile_id", profile.id)
    .eq("is_active", true)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const house = takeSingleRelation(
    (membership as { house: { public_code: string } | { public_code: string }[] | null } | null)
      ?.house
  );

  if (!house?.public_code) {
    return "/login?flow=join";
  }

  return buildDashboardPath(profile.public_code, house.public_code);
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

  return {
    house,
    tickets: asArray<Record<string, unknown>>(data.tickets).map(mapExpenseTicket),
    shared_expenses: asArray<Record<string, unknown>>(data.shared_expenses).map(
      mapSharedExpense
    ),
    settlements: asArray<Settlement>(data.settlements),
    pending_payment_confirmations: asArray<Record<string, unknown>>(
      data.pending_payment_confirmations
    ).map(
      (payment) =>
        ({
          payment_id: toStringValue(payment.payment_id),
          expense_id: toNullableStringValue(payment.expense_id),
          expense_title: toNullableStringValue(payment.expense_title),
          from_profile_id: toStringValue(payment.from_profile_id),
          from_name: toStringValue(payment.from_name),
          to_profile_id: toStringValue(payment.to_profile_id),
          to_name: toStringValue(payment.to_name),
          amount:
            typeof payment.amount === "number" || typeof payment.amount === "string"
              ? payment.amount
              : 0,
          payment_date: toStringValue(payment.payment_date),
          note: toNullableStringValue(payment.note),
          status: toStringValue(payment.status),
        }) satisfies PendingPaymentConfirmation
    ),
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

  return asArray<Record<string, unknown>>(data).map(mapExpenseTicket);
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

  return asArray<Record<string, unknown>>(data).map(mapSharedExpense);
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

  return asArray<Record<string, unknown>>(data).map(
    (payment) =>
      ({
        payment_id: toStringValue(payment.payment_id),
        expense_id: toNullableStringValue(payment.expense_id),
        expense_title: toNullableStringValue(payment.expense_title),
        from_profile_id: toStringValue(payment.from_profile_id),
        from_name: toStringValue(payment.from_name),
        to_profile_id: toStringValue(payment.to_profile_id),
        to_name: toStringValue(payment.to_name),
        amount: toNumericLikeValue(payment.amount),
        payment_date: toStringValue(payment.payment_date),
        note: toNullableStringValue(payment.note),
        status: toStringValue(payment.status),
      }) satisfies PendingPaymentConfirmation
  );
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

  return {
    members: asArray<Record<string, unknown>>(data.members).map(
      (member) =>
        ({
          profile_id: toStringValue(member.profile_id),
          display_name: toStringValue(member.display_name),
          role: toStringValue(member.role, "member"),
        }) satisfies AddExpenseMember
    ),
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
  houseId: string;
  profileId: string;
  expenseIds: string[];
};

export async function loadCurrentUserExpenseStatesWithClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  { houseId, profileId, expenseIds }: LoadCurrentUserExpenseStatesInput
) {
  if (!expenseIds.length) {
    return [] satisfies CurrentUserExpenseState[];
  }

  const [{ data: participants }, { data: pendingPayments }] = await Promise.all([
    supabase
      .from("expense_participants")
      .select("expense_id, profile_id, share_amount, status")
      .eq("profile_id", profileId)
      .in("expense_id", expenseIds),
    supabase
      .from("payments")
      .select("id, related_expense_id, amount, note")
      .eq("house_id", houseId)
      .eq("from_profile_id", profileId)
      .eq("status", "pending")
      .in("related_expense_id", expenseIds),
  ]);

  const pendingPaymentByExpenseId = new Map(
    (pendingPayments ?? [])
      .filter((payment) => payment.related_expense_id)
      .map((payment) => [
        String(payment.related_expense_id),
        {
          payment_id: String(payment.id),
          amount:
            typeof payment.amount === "number" || typeof payment.amount === "string"
              ? payment.amount
              : null,
          note:
            typeof payment.note === "string" || payment.note === null
              ? payment.note
              : null,
        },
      ])
  );

  return (participants ?? []).map(
    (participant) =>
      ({
        expense_id: String(participant.expense_id),
        profile_id: String(participant.profile_id),
        share_amount:
          typeof participant.share_amount === "number" ||
          typeof participant.share_amount === "string"
            ? participant.share_amount
            : 0,
        participant_status: toStringValue(participant.status, "pending"),
        pending_payment_id:
          pendingPaymentByExpenseId.get(String(participant.expense_id))
            ?.payment_id ?? null,
        pending_payment_amount:
          pendingPaymentByExpenseId.get(String(participant.expense_id))
            ?.amount ?? null,
        pending_payment_note:
          pendingPaymentByExpenseId.get(String(participant.expense_id))
            ?.note ?? null,
      }) satisfies CurrentUserExpenseState
  );
}
