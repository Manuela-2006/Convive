export type ExpenseTicket = {
  ticket_id: string;
  display_title: string;
  merchant: string;
  purchase_date: string;
  paid_by_name: string;
  total_amount: number | string;
  currency: string;
  ticket_file_path: string | null;
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
  currency: string;
  source_ticket_id: string | null;
};

export type Settlement = {
  from_profile_id: string;
  from_name: string;
  to_profile_id: string;
  to_name: string;
  amount: number | string;
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
};
