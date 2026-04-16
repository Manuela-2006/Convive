"use server";

import { revalidatePath } from "next/cache";

import { getAuthenticatedProfileContext } from "../../lib/dashboard";

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

type CreatePendingTicketExpenseInput = {
  houseCode: string;
  dashboardPath: string;
  ticketKind: "purchase" | "unexpected";
  title: string;
  merchant: string;
  purchaseDate: string;
  totalAmount: number;
  itemNames: string[];
  participantProfileIds: string[];
  notes?: string;
  paidByProfileId?: string | null;
};

type RequestExpensePaymentConfirmationInput = {
  houseCode: string;
  dashboardPath: string;
  expenseId: string;
  note?: string;
  amount?: number | null;
};

type AdminReviewPaymentInput = {
  houseCode: string;
  dashboardPath: string;
  paymentId: string;
};

type AdminRejectPaymentInput = AdminReviewPaymentInput & {
  reason?: string;
};

function toActionError(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Ha ocurrido un error inesperado.";
}

function revalidateExpensePaths(dashboardPath: string) {
  const paths = [
    dashboardPath,
    `${dashboardPath}/gastos`,
    `${dashboardPath}/gastos/anadir-ticket`,
    `${dashboardPath}/gastos/tickets`,
    `${dashboardPath}/gastos/division`,
    `${dashboardPath}/gastos/simplificar`,
    `${dashboardPath}/gastos/simplificar/pago-simplificado`,
  ];

  for (const path of paths) {
    revalidatePath(path);
  }
}

export async function createPendingTicketExpenseAction(
  input: CreatePendingTicketExpenseInput
): Promise<ActionResult<{ expenseId: string; ticketId: string }>> {
  try {
    const { supabase } = await getAuthenticatedProfileContext();

    const { data, error } = await supabase.rpc("create_pending_ticket_expense", {
      p_house_public_code: input.houseCode,
      p_ticket_kind: input.ticketKind,
      p_title: input.title.trim(),
      p_merchant: input.merchant.trim(),
      p_purchase_date: input.purchaseDate,
      p_total_amount: input.totalAmount,
      p_item_names: input.itemNames,
      p_participant_profile_ids: input.participantProfileIds,
      p_notes: input.notes?.trim() ? input.notes.trim() : null,
      p_paid_by_profile_id: input.paidByProfileId ?? null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidateExpensePaths(input.dashboardPath);

    return {
      success: true,
      data: {
        expenseId:
          typeof data?.expense_id === "string"
            ? data.expense_id
            : String(data?.expense_id ?? ""),
        ticketId:
          typeof data?.ticket_id === "string"
            ? data.ticket_id
            : String(data?.ticket_id ?? ""),
      },
    };
  } catch (error) {
    return { success: false, error: toActionError(error) };
  }
}

export async function requestExpensePaymentConfirmationAction(
  input: RequestExpensePaymentConfirmationInput
): Promise<ActionResult<{ paymentId: string; status: string }>> {
  try {
    const { supabase } = await getAuthenticatedProfileContext();

    const { data, error } = await supabase.rpc(
      "request_expense_payment_confirmation",
      {
        p_house_public_code: input.houseCode,
        p_expense_id: input.expenseId,
        p_note: input.note?.trim() ? input.note.trim() : null,
        p_amount:
          typeof input.amount === "number" && Number.isFinite(input.amount)
            ? input.amount
            : null,
      }
    );

    if (error) {
      return { success: false, error: error.message };
    }

    revalidateExpensePaths(input.dashboardPath);

    return {
      success: true,
      data: {
        paymentId:
          typeof data?.payment_id === "string"
            ? data.payment_id
            : String(data?.payment_id ?? ""),
        status: typeof data?.status === "string" ? data.status : "pending",
      },
    };
  } catch (error) {
    return { success: false, error: toActionError(error) };
  }
}

export async function adminConfirmPaymentAction(
  input: AdminReviewPaymentInput
): Promise<ActionResult<{ paymentId: string; status: string }>> {
  try {
    const { supabase } = await getAuthenticatedProfileContext();

    const { data, error } = await supabase.rpc("admin_confirm_payment", {
      p_house_public_code: input.houseCode,
      p_payment_id: input.paymentId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidateExpensePaths(input.dashboardPath);

    return {
      success: true,
      data: {
        paymentId:
          typeof data?.payment_id === "string"
            ? data.payment_id
            : String(data?.payment_id ?? ""),
        status: typeof data?.status === "string" ? data.status : "completed",
      },
    };
  } catch (error) {
    return { success: false, error: toActionError(error) };
  }
}

export async function adminRejectPaymentAction(
  input: AdminRejectPaymentInput
): Promise<ActionResult<{ paymentId: string; status: string }>> {
  try {
    const { supabase } = await getAuthenticatedProfileContext();

    const { data, error } = await supabase.rpc("admin_reject_payment", {
      p_house_public_code: input.houseCode,
      p_payment_id: input.paymentId,
      p_reason: input.reason?.trim() ? input.reason.trim() : null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidateExpensePaths(input.dashboardPath);

    return {
      success: true,
      data: {
        paymentId:
          typeof data?.payment_id === "string"
            ? data.payment_id
            : String(data?.payment_id ?? ""),
        status: typeof data?.status === "string" ? data.status : "rejected",
      },
    };
  } catch (error) {
    return { success: false, error: toActionError(error) };
  }
}
