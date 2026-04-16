export type ExpenseTicket = {
  ticket_id: string;
  expense_id: string | null;
  display_title: string;
  merchant: string;
  purchase_date: string;
  paid_by_name: string;
  total_amount: number | string;
  my_share_amount?: number | string | null;
  currency: string;
  ticket_file_path: string | null;
  settlement_status?: string | null;
};

export type SharedExpense = {
  expense_id: string;
  title: string;
  expense_type: string;
  expense_date: string;
  paid_by_name: string;
  participants_text: string;
  participants_count: number;
  total_amount: number | string;
  my_share_amount?: number | string | null;
  my_status?: string | null;
  currency: string;
  source_ticket_id: string | null;
  settlement_status: string | null;
};

export type Settlement = {
  from_profile_id: string;
  from_name: string;
  to_profile_id: string;
  to_name: string;
  amount: number | string;
};

export type AddExpenseMember = {
  profile_id: string;
  display_name: string;
  role: string;
};

export type AddExpenseCatalogItem = {
  item_id: string;
  name: string;
};

export type AddExpenseFormOptions = {
  members: AddExpenseMember[];
  items: AddExpenseCatalogItem[];
};

export type PendingPaymentConfirmation = {
  payment_id: string;
  expense_id: string | null;
  expense_title: string | null;
  from_profile_id: string;
  from_name: string;
  to_profile_id: string;
  to_name: string;
  amount: number | string;
  payment_date: string;
  note: string | null;
  status: string;
};

export type CurrentUserExpenseState = {
  expense_id: string;
  profile_id: string;
  share_amount: number | string;
  participant_status: string;
  pending_payment_id: string | null;
  pending_payment_amount: number | string | null;
  pending_payment_note: string | null;
};

export type ExpensesDashboardData = {
  house: {
    id: string;
    name: string;
    public_code: string;
  } | null;
  tickets: ExpenseTicket[];
  shared_expenses: SharedExpense[];
  settlements: Settlement[];
  pending_payment_confirmations: PendingPaymentConfirmation[];
};
