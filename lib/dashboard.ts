import { notFound, redirect } from "next/navigation";

import type {
  ExpenseTicket,
  ExpensesDashboardData,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

export function buildProfilePath(userCode: string) {
  return `/dashboard/profile/${userCode}`;
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
    return buildProfilePath(profile.public_code);
  }

  return buildDashboardPath(profile.public_code, house.public_code);
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
    tickets: asArray<ExpenseTicket>(data.tickets),
    shared_expenses: asArray<SharedExpense>(data.shared_expenses),
    settlements: asArray<Settlement>(data.settlements),
  } satisfies ExpensesDashboardData;
}
