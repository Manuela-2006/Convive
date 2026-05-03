export type ExpenseTicket = {
  ticket_id: string;
  expense_id: string | null;
  display_title: string;
  merchant: string;
  purchase_date: string;
  paid_by_name: string;
  paid_by_profile_id: string | null;
  paid_by_avatar_url: string | null;
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
  participants: Array<{
    profile_id: string;
    display_name: string;
    avatar_url: string | null;
  }>;
  total_amount: number | string;
  my_share_amount?: number | string | null;
  my_status?: string | null;
  currency: string;
  source_ticket_id: string | null;
  settlement_status: string | null;
};

export type ExpenseSplitParticipant = {
  profile_id: string;
  display_name: string;
  avatar_url: string | null;
  share_amount: number | string;
  status: string | null;
};

export type ExpenseSplitDetail = {
  expense_id: string;
  title: string;
  expense_date: string;
  total_amount: number | string;
  currency: string;
  paid_by_profile_id: string | null;
  paid_by_name: string;
  description: string | null;
  settlement_status: string | null;
  participants: ExpenseSplitParticipant[];
};

export type Settlement = {
  from_profile_id: string;
  from_name: string;
  from_avatar_url: string | null;
  to_profile_id: string;
  to_name: string;
  to_avatar_url: string | null;
  amount: number | string;
};

export type PaymentSimplification = {
  settlements: Settlement[];
  originalPaymentCount: number;
  optimizedPaymentCount: number;
  isSimplified: boolean;
};

export type AddExpenseMember = {
  profile_id: string;
  display_name: string;
  role: string;
  avatar_url: string | null;
};

export type AddExpenseCatalogItem = {
  item_id: string;
  name: string;
};

export type AddExpenseFormOptions = {
  members: AddExpenseMember[];
  items: AddExpenseCatalogItem[];
};

export type Invoice = {
  expense_id: string;
  title: string;
  invoice_date: string;
  total_amount: number | string;
  currency: string;
  category_id: string | null;
  category_name: string;
  category_slug: string;
  invoice_file_path: string | null;
  settlement_status: string | null;
  can_mark_paid: boolean;
};

export type InvoiceCategorySection = {
  category_id: string | null;
  category_name: string;
  category_slug: string;
  invoices: Invoice[];
};

export type InvoicesDashboardData = {
  sections: InvoiceCategorySection[];
};

export type AddInvoiceCategory = {
  category_id: string;
  name: string;
  slug: string;
};

export type AddInvoiceMember = {
  profile_id: string;
  display_name: string;
  role: string;
  avatar_url: string | null;
};

export type AddInvoiceFormOptions = {
  categories: AddInvoiceCategory[];
  members: AddInvoiceMember[];
};

export type PendingPaymentConfirmation = {
  payment_id: string;
  expense_id: string | null;
  expense_title: string | null;
  from_profile_id: string;
  from_name: string;
  from_avatar_url: string | null;
  to_profile_id: string;
  to_name: string;
  to_avatar_url: string | null;
  amount: number | string;
  payment_date: string;
  note: string | null;
  status: string;
  can_review: boolean;
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
  payment_simplification: PaymentSimplification;
  pending_payment_confirmations: PendingPaymentConfirmation[];
};

export type CleaningTask = {
  task_id: string;
  title: string;
  due_date: string;
  assigned_to_profile_id: string | null;
  assigned_to_name: string;
  zone_id: string | null;
  zone_name: string;
  notes: string | null;
  status: string;
  completed_at: string | null;
  completed_by_profile_id: string | null;
};

export type CleaningZoneSection = {
  zone_id: string | null;
  zone_name: string;
  tasks: CleaningTask[];
};

export type CleaningDashboardData = {
  zones: CleaningZoneSection[];
};

export type AddCleaningZone = {
  zone_id: string;
  name: string;
};

export type AddCleaningMember = {
  profile_id: string;
  display_name: string;
  role: string;
  avatar_url: string | null;
};

export type AddCleaningTaskFormOptions = {
  zones: AddCleaningZone[];
  members: AddCleaningMember[];
};

export type PersonalAreaDebtItem = {
  expense_id: string;
  payment_id: string | null;
  person_name: string;
  person_avatar_url: string | null;
  title: string;
  item_date: string;
  amount: number | string;
  currency: string;
  status: string;
};

export type PersonalAreaReceivableItem = PersonalAreaDebtItem & {
  can_verify: boolean;
};

export type PersonalAreaHistoryItem = {
  item_type: string;
  item_id: string;
  title: string;
  subtitle: string;
  item_date: string;
  amount: number | string;
  currency: string;
  status: string;
  icon_type: string;
};

export type PersonalAreaCalendarEvent = {
  event_id: string;
  event_type: string;
  title: string;
  event_date: string;
  amount: number | string;
  currency: string;
  person_name: string;
  person_avatar_url: string | null;
};

export type PersonalAreaChartItem = {
  name: string;
  amount: number | string;
};

export type PersonalAreaDashboardData = {
  summary: {
    my_debts_total: number | string;
    my_debts_count: number;
    owed_to_me_total: number | string;
    owed_to_me_count: number;
    monthly_spending_total: number | string;
    previous_month_spending_total: number | string;
  };
  debts: PersonalAreaDebtItem[];
  receivables: PersonalAreaReceivableItem[];
  history: PersonalAreaHistoryItem[];
  calendar_events: PersonalAreaCalendarEvent[];
  chart: PersonalAreaChartItem[];
};

export type HouseMemberSummary = {
  profile_id: string;
  display_name: string;
  role: string;
  avatar_url: string | null;
};

export type HouseShoppingListItem = {
  item_id: string;
  text: string;
  is_checked: boolean;
  created_at: string;
  created_by_profile_id: string | null;
  created_by_name: string | null;
  checked_at: string | null;
};

export type SharedFundsSummary = {
  budget_month: string;
  budget_amount: number | string;
  spent_amount: number | string;
  can_edit_budget: boolean;
};

export type MonthlyExpensesPoint = {
  month_key: string;
  month_label: string;
  total_amount: number | string;
  is_current_month: boolean;
};

export type GroupExpenseDistributionItem = {
  name: string;
  amount: number | string;
};

export type GroupExpenseComparisonItem = {
  name: string;
  current_amount: number | string;
  previous_amount: number | string;
  percent_change: number | null;
};

export type AreaGrupalDashboardData = {
  members: HouseMemberSummary[];
  shopping_list: HouseShoppingListItem[];
  shared_funds: SharedFundsSummary;
  monthly_expenses: {
    current_total: number | string;
    previous_total: number | string;
    percent_change: number | null;
    series: MonthlyExpensesPoint[];
  };
  distribution: GroupExpenseDistributionItem[];
  comparisons: GroupExpenseComparisonItem[];
};

export type ProfileSettingsMemberOption = {
  profile_id: string;
  display_name: string;
  role: string;
};

export type ProfileSettingsData = {
  profile: {
    id: string;
    email: string | null;
    full_name: string | null;
    avatar_url: string | null;
    avatar_storage_path: string | null;
    user_hash_id: string;
  };
  house_member: {
    role: string;
    room_label: string | null;
    room_size: string | null;
    stay_start_date: string | null;
    stay_end_date: string | null;
    contract_file_path: string | null;
  };
  can_remove_members: boolean;
  removable_members: ProfileSettingsMemberOption[];
};
