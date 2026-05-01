import type {
  AreaGrupalDashboardData,
  GroupExpenseComparisonItem,
  GroupExpenseDistributionItem,
  HouseShoppingListItem,
  MonthlyExpensesPoint,
  SharedFundsSummary,
} from "../../../../lib/dashboard-types";
import {
  loadActiveHouseInviteWithClient,
  loadAddInvoiceFormOptionsWithClient,
  loadHouseInvoiceHistoryWithClient,
  loadHouseSharedExpensesHistoryWithClient,
} from "../shared/dashboard-core";
import { loadProfileAvatarUrlMapWithClient } from "../shared/profile-avatar";
import { createClient } from "../shared/supabase-server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type BudgetRpcRow = {
  budget_month?: unknown;
  budget_amount?: unknown;
  can_edit?: unknown;
};

type ShoppingListRpcRow = {
  item_id?: unknown;
  text?: unknown;
  is_checked?: unknown;
  created_at?: unknown;
  created_by_profile_id?: unknown;
  created_by_name?: unknown;
  checked_at?: unknown;
};

function toNumber(value: unknown) {
  const numericValue =
    typeof value === "number" ? value : Number(String(value ?? 0));

  return Number.isFinite(numericValue) ? numericValue : 0;
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

function toNullableString(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = toStringValue(value).trim();
  return normalized || null;
}

function toBooleanValue(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    return ["true", "1", "t", "yes", "si", "sí"].includes(
      value.trim().toLowerCase()
    );
  }

  return false;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}`;
}

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function parseDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  if (!match) {
    return null;
  }

  const parsed = new Date(`${match[1]}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function readBudgetMonth(value: unknown) {
  const normalized = toNullableString(value);
  if (!normalized) {
    return monthKey(new Date());
  }

  return normalized.slice(0, 7);
}

function readDistributionCategory(input: {
  expenseType: string;
  sourceTicketId: string | null;
  invoiceCategorySlug: string | null;
  invoiceCategoryName: string | null;
}) {
  const slug = (input.invoiceCategorySlug ?? "").trim().toLowerCase();
  const name = (input.invoiceCategoryName ?? "").trim().toLowerCase();

  if (
    slug === "alquiler" ||
    slug === "rent" ||
    name.includes("alquiler") ||
    name.includes("rent")
  ) {
    return "Alquiler";
  }

  if (slug === "agua" || slug === "water" || name.includes("agua")) {
    return "Agua";
  }

  if (
    slug === "luz" ||
    slug === "electricity" ||
    slug === "power" ||
    name.includes("luz") ||
    name.includes("electric")
  ) {
    return "Luz";
  }

  if (
    slug === "wifi" ||
    slug === "internet" ||
    name.includes("wifi") ||
    name.includes("internet")
  ) {
    return "Wifi";
  }

  if (
    slug === "suscripciones" ||
    slug === "subscription" ||
    slug === "subscriptions" ||
    name.includes("suscrip")
  ) {
    return "Suscripciones";
  }

  if (
    input.sourceTicketId ||
    input.expenseType === "ticket" ||
    input.expenseType === "shared_purchase"
  ) {
    return "Compras";
  }

  return "Otros";
}

function buildChangeText(currentAmount: number, previousAmount: number) {
  if (currentAmount === previousAmount) {
    return null;
  }

  if (previousAmount <= 0) {
    return null;
  }

  return Math.round(((currentAmount - previousAmount) / previousAmount) * 100);
}

async function loadHouseMonthlyBudgetWithClient(
  supabase: SupabaseServerClient,
  houseCode: string
) {
  const { data, error } = await supabase.rpc("get_house_monthly_budget", {
    p_house_public_code: houseCode,
  });

  if (error) {
    return {
      budget_month: monthKey(new Date()),
      budget_amount: 0,
      can_edit_budget: false,
    } satisfies Omit<SharedFundsSummary, "spent_amount">;
  }

  const row =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as BudgetRpcRow)
      : {};

  return {
    budget_month: readBudgetMonth(row.budget_month),
    budget_amount: toNumber(row.budget_amount),
    can_edit_budget: toBooleanValue(row.can_edit),
  } satisfies Omit<SharedFundsSummary, "spent_amount">;
}

async function loadHouseShoppingListWithClient(
  supabase: SupabaseServerClient,
  houseCode: string
) {
  const { data, error } = await supabase.rpc("get_house_shopping_list", {
    p_house_public_code: houseCode,
  });

  if (error || !Array.isArray(data)) {
    return [] satisfies HouseShoppingListItem[];
  }

  return data.map((item) => {
    const row = item as ShoppingListRpcRow;

    return {
      item_id: toStringValue(row.item_id),
      text: toStringValue(row.text),
      is_checked: toBooleanValue(row.is_checked),
      created_at: toStringValue(row.created_at),
      created_by_profile_id: toNullableString(row.created_by_profile_id),
      created_by_name: toNullableString(row.created_by_name),
      checked_at: toNullableString(row.checked_at),
    } satisfies HouseShoppingListItem;
  });
}

export async function loadAreaGrupalDashboardWithClient(
  supabase: SupabaseServerClient,
  houseCode: string
): Promise<AreaGrupalDashboardData> {
  const [memberOptions, sharedExpensesHistory, invoiceHistory, monthlyBudget, shoppingList] =
    await Promise.all([
      loadAddInvoiceFormOptionsWithClient(supabase, houseCode),
      loadHouseSharedExpensesHistoryWithClient(supabase, houseCode, 500, 0),
      loadHouseInvoiceHistoryWithClient(supabase, houseCode, 500, 0),
      loadHouseMonthlyBudgetWithClient(supabase, houseCode),
      loadHouseShoppingListWithClient(supabase, houseCode),
    ]);

  const invoiceCategoryByExpenseId = new Map(
    invoiceHistory.map((invoice) => [
      invoice.expense_id,
      {
        slug: invoice.category_slug,
        name: invoice.category_name,
      },
    ])
  );

  const today = new Date();
  const currentMonth = monthStart(today);
  const previousMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() - 1,
    1
  );
  const monthlySeriesSource = Array.from({ length: 4 }, (_, index) => {
    const date = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() - (3 - index),
      1
    );

    return {
      month_key: monthKey(date),
      month_label: new Intl.DateTimeFormat("es-ES", { month: "short" })
        .format(date)
        .replace(".", "")
        .replace(/^./, (value) => value.toUpperCase()),
      total_amount: 0,
      is_current_month: monthKey(date) === monthKey(currentMonth),
    } satisfies MonthlyExpensesPoint;
  });
  const monthlySeriesMap = new Map(
    monthlySeriesSource.map((item) => [item.month_key, item])
  );
  const currentDistribution = new Map<string, number>();
  const currentComparisons = new Map<
    string,
    { currentAmount: number; previousAmount: number }
  >();

  let currentTotal = 0;
  let previousTotal = 0;

  for (const expense of sharedExpensesHistory) {
    const expenseDate = parseDate(expense.expense_date);
    if (!expenseDate) {
      continue;
    }

    const expenseMonthKey = monthKey(expenseDate);
    const amount = toNumber(expense.total_amount);
    const monthlyPoint = monthlySeriesMap.get(expenseMonthKey);

    if (monthlyPoint) {
      monthlyPoint.total_amount = toNumber(monthlyPoint.total_amount) + amount;
    }

    const invoiceCategory = invoiceCategoryByExpenseId.get(expense.expense_id);
    const category = readDistributionCategory({
      expenseType: expense.expense_type,
      sourceTicketId: expense.source_ticket_id,
      invoiceCategorySlug: invoiceCategory?.slug ?? null,
      invoiceCategoryName: invoiceCategory?.name ?? null,
    });

    if (expenseMonthKey === monthKey(currentMonth)) {
      currentTotal += amount;
      currentDistribution.set(category, (currentDistribution.get(category) ?? 0) + amount);
      const comparison = currentComparisons.get(category) ?? {
        currentAmount: 0,
        previousAmount: 0,
      };
      comparison.currentAmount += amount;
      currentComparisons.set(category, comparison);
    }

    if (expenseMonthKey === monthKey(previousMonth)) {
      previousTotal += amount;
      const comparison = currentComparisons.get(category) ?? {
        currentAmount: 0,
        previousAmount: 0,
      };
      comparison.previousAmount += amount;
      currentComparisons.set(category, comparison);
    }
  }

  const distribution = [...currentDistribution.entries()]
    .map(
      ([name, amount]) =>
        ({
          name,
          amount,
        }) satisfies GroupExpenseDistributionItem
    )
    .sort((first, second) => toNumber(second.amount) - toNumber(first.amount));

  const comparisons = [...currentComparisons.entries()]
    .filter(
      ([, value]) => value.currentAmount > 0 || value.previousAmount > 0
    )
    .map(
      ([name, value]) =>
        ({
          name,
          current_amount: value.currentAmount,
          previous_amount: value.previousAmount,
          percent_change: buildChangeText(value.currentAmount, value.previousAmount),
        }) satisfies GroupExpenseComparisonItem
    )
    .sort((first, second) => toNumber(second.current_amount) - toNumber(first.current_amount));
  const avatarUrlMap = await loadProfileAvatarUrlMapWithClient(
    supabase,
    memberOptions.members.map((member) => member.profile_id)
  );

  return {
    members: memberOptions.members.map((member) => ({
      profile_id: member.profile_id,
      display_name: member.display_name,
      role: member.role,
      avatar_url: avatarUrlMap.get(member.profile_id) ?? member.avatar_url,
    })),
    shopping_list: shoppingList,
    shared_funds: {
      budget_month: monthlyBudget.budget_month,
      budget_amount: monthlyBudget.budget_amount,
      spent_amount: currentTotal,
      can_edit_budget: monthlyBudget.can_edit_budget,
    },
    monthly_expenses: {
      current_total: currentTotal,
      previous_total: previousTotal,
      percent_change: buildChangeText(currentTotal, previousTotal),
      series: monthlySeriesSource,
    },
    distribution,
    comparisons,
  };
}

export { loadActiveHouseInviteWithClient };

