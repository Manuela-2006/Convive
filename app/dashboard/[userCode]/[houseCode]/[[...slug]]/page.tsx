import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { AjustesScreen } from "../../../../../components/ajustes/ajustes-screen";
import { AreaGrupalScreen } from "../../../../../components/area-grupal/area-grupal-screen";
import { AreaPersonalScreen } from "../../../../../components/area-personal/area-personal-screen";
import { AreaPersonalHistoryScreen } from "../../../../../components/area-personal/history-screen";
import { CalendarioScreen } from "../../../../../components/calendario/calendario-screen";
import { FacturasAguaScreen } from "../../../../../components/facturas/facturas-agua-screen";
import { FacturasAlquilerScreen } from "../../../../../components/facturas/facturas-alquiler-screen";
import { FacturasLuzScreen } from "../../../../../components/facturas/facturas-luz-screen";
import { FacturasScreen } from "../../../../../components/facturas/facturas-screen";
import { FacturasSuscripcionesScreen } from "../../../../../components/facturas/facturas-suscripciones-screen";
import { FacturasWifiScreen } from "../../../../../components/facturas/facturas-wifi-screen";
import { FacturasHistoryScreen } from "../../../../../components/facturas/facturas-history-screen";
import { GastosAddTicketScreen } from "../../../../../components/gastos/gastos-add-ticket-screen";
import { GastosDivisionScreen } from "../../../../../components/gastos/gastos-division-screen";
import { GastosPagoSimplificadoScreen } from "../../../../../components/gastos/gastos-pago-simplificado-screen";
import { GastosScreen } from "../../../../../components/gastos/gastos-screen";
import { GastosSimplificarScreen } from "../../../../../components/gastos/gastos-simplificar-screen";
import { GastosTicketsScreen } from "../../../../../components/gastos/gastos-tickets-screen";
import { HerramientasEntraScreen } from "../../../../../components/herramientas/herramientas-entra-screen";
import { HerramientasScreen } from "../../../../../components/herramientas/herramientas-screen";
import { HomeBoard } from "../../../../../components/home/home-board";
import { LimpiezaScreen } from "../../../../../components/limpieza/limpieza-screen";
import { ElectricalMenu } from "../../../../../components/menu/electrical-menu";
import { MiniDoorLink, type MenuKey } from "../../../../../components/ui/mini-door-link";
import {
  getAccessibleHouseContext,
  loadActiveHouseInviteWithClient,
  loadAddExpenseFormOptionsWithClient,
  loadHouseInvoiceHistoryWithClient,
  loadHouseInvoicesDashboardWithClient,
  loadAddCleaningTaskFormOptionsWithClient,
  loadHouseCleaningDashboardWithClient,
  loadCurrentUserExpenseStatesWithClient,
  loadHouseExpensesDashboardWithClient,
  loadHousePendingPaymentConfirmationsWithClient,
  loadHousePurchaseTicketsHistoryWithClient,
  loadOpenHousePurchaseTicketsWithClient,
  loadOpenHouseSharedExpensesWithClient,
  loadHouseSharedExpensesHistoryWithClient,
} from "../../../../../lib/dashboard";
import { createClient } from "../../../../../utils/supabase/server";

type HouseRoutePageProps = {
  params: Promise<{
    userCode: string;
    houseCode: string;
    slug?: string[];
  }>;
};

function withMiniDoor(
  content: ReactNode,
  dashboardPath: string,
  currentScreen: MenuKey
) {
  return (
    <>
      <MiniDoorLink
        menuHref={`${dashboardPath}/menu`}
        dashboardPath={dashboardPath}
        currentScreen={currentScreen}
      />
      {content}
    </>
  );
}

async function loadMemberCount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  houseId: string
) {
  const { count } = await supabase
    .from("house_members")
    .select("id", { count: "exact", head: true })
    .eq("house_id", houseId)
    .eq("is_active", true);

  return count ?? 0;
}

export default async function HouseRoutePage({ params }: HouseRoutePageProps) {
  const { userCode, houseCode, slug } = await params;
  const routeContext = await getAccessibleHouseContext(userCode, houseCode);
  const sectionPath = (slug ?? []).join("/");
  const isHouseAdmin =
    routeContext.memberRole === "admin" ||
    routeContext.house.created_by === routeContext.profile.id;

  if (!sectionPath) {
    const memberCount = await loadMemberCount(
      routeContext.supabase,
      routeContext.house.id
    );

    return (
      <HomeBoard
        houseCode={routeContext.house.public_code}
        houseName={routeContext.house.name}
        memberCount={memberCount}
        dashboardPath={routeContext.dashboardPath}
      />
    );
  }

  if (sectionPath === "menu" || sectionPath === "notificaciones") {
    return (
      <ElectricalMenu
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
      />
    );
  }

  if (sectionPath === "area-personal") {
    return withMiniDoor(
      <AreaPersonalScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
      />,
      routeContext.dashboardPath,
      "area-personal"
    );
  }

  if (sectionPath === "area-personal/historial") {
    return withMiniDoor(
      <AreaPersonalHistoryScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
      />,
      routeContext.dashboardPath,
      "area-personal"
    );
  }

  if (sectionPath === "area-grupal") {
    const houseInvite = await loadActiveHouseInviteWithClient(
      routeContext.supabase,
      routeContext.house.public_code
    );

    return withMiniDoor(
      <AreaGrupalScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
        inviteCode={houseInvite.inviteCode}
        canManageInvites={houseInvite.canManageInvites}
      />,
      routeContext.dashboardPath,
      "area-grupal"
    );
  }

  if (sectionPath === "calendario") {
    const [
      ticketsHistory,
      sharedExpensesHistory,
      invoicesHistory,
      cleaningDashboard,
      pendingPaymentConfirmations,
    ] = await Promise.all([
      loadHousePurchaseTicketsHistoryWithClient(
        routeContext.supabase,
        routeContext.house.public_code,
        200,
        0
      ),
      loadHouseSharedExpensesHistoryWithClient(
        routeContext.supabase,
        routeContext.house.public_code,
        200,
        0
      ),
      loadHouseInvoiceHistoryWithClient(
        routeContext.supabase,
        routeContext.house.public_code,
        200,
        0
      ),
      loadHouseCleaningDashboardWithClient(
        routeContext.supabase,
        routeContext.house.public_code,
        200
      ),
      loadHousePendingPaymentConfirmationsWithClient(
        routeContext.supabase,
        routeContext.house.public_code
      ),
    ]);

    return withMiniDoor(
      <CalendarioScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
        tickets={ticketsHistory}
        sharedExpenses={sharedExpensesHistory}
        invoices={invoicesHistory}
        cleaningTasks={cleaningDashboard.zones.flatMap((zone) => zone.tasks)}
        pendingPayments={pendingPaymentConfirmations}
      />,
      routeContext.dashboardPath,
      "calendario"
    );
  }

  if (sectionPath === "limpieza") {
    const [cleaningDashboard, cleaningFormOptions] = await Promise.all([
      loadHouseCleaningDashboardWithClient(
        routeContext.supabase,
        routeContext.house.public_code,
        50
      ),
      loadAddCleaningTaskFormOptionsWithClient(
        routeContext.supabase,
        routeContext.house.public_code
      ),
    ]);

    return withMiniDoor(
      <LimpiezaScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
        zones={cleaningDashboard.zones}
        formOptions={cleaningFormOptions}
      />,
      routeContext.dashboardPath,
      "limpieza"
    );
  }

  if (sectionPath === "herramientas") {
    return withMiniDoor(
      <HerramientasScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
      />,
      routeContext.dashboardPath,
      "herramientas"
    );
  }

  if (sectionPath === "herramientas/entra-alguien") {
    return withMiniDoor(
      <HerramientasEntraScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
      />,
      routeContext.dashboardPath,
      "herramientas"
    );
  }

  if (sectionPath === "ajustes") {
    return withMiniDoor(
      <AjustesScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
      />,
      routeContext.dashboardPath,
      "ajustes"
    );
  }

  if (sectionPath === "facturas") {
    const invoicesDashboard = await loadHouseInvoicesDashboardWithClient(
      routeContext.supabase,
      routeContext.house.public_code,
      5
    );

    return withMiniDoor(
      <FacturasScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
        sections={invoicesDashboard.sections}
        canMarkInvoicesPaid={isHouseAdmin}
      />,
      routeContext.dashboardPath,
      "facturas"
    );
  }

  if (sectionPath === "facturas/alquiler") {
    const invoicesHistory = await loadHouseInvoiceHistoryWithClient(
      routeContext.supabase,
      routeContext.house.public_code,
      100,
      0
    );

    return withMiniDoor(
      <FacturasAlquilerScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
        invoices={invoicesHistory}
        canMarkInvoicesPaid={isHouseAdmin}
      />,
      routeContext.dashboardPath,
      "facturas"
    );
  }

  if (sectionPath === "facturas/suscripciones") {
    const invoicesHistory = await loadHouseInvoiceHistoryWithClient(
      routeContext.supabase,
      routeContext.house.public_code,
      100,
      0
    );

    return withMiniDoor(
      <FacturasSuscripcionesScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
        invoices={invoicesHistory}
        canMarkInvoicesPaid={isHouseAdmin}
      />,
      routeContext.dashboardPath,
      "facturas"
    );
  }

  if (sectionPath === "facturas/wifi") {
    const invoicesHistory = await loadHouseInvoiceHistoryWithClient(
      routeContext.supabase,
      routeContext.house.public_code,
      100,
      0
    );

    return withMiniDoor(
      <FacturasWifiScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
        invoices={invoicesHistory}
        canMarkInvoicesPaid={isHouseAdmin}
      />,
      routeContext.dashboardPath,
      "facturas"
    );
  }

  if (sectionPath === "facturas/agua") {
    const invoicesHistory = await loadHouseInvoiceHistoryWithClient(
      routeContext.supabase,
      routeContext.house.public_code,
      100,
      0
    );

    return withMiniDoor(
      <FacturasAguaScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
        invoices={invoicesHistory}
        canMarkInvoicesPaid={isHouseAdmin}
      />,
      routeContext.dashboardPath,
      "facturas"
    );
  }

  if (sectionPath === "facturas/luz") {
    const invoicesHistory = await loadHouseInvoiceHistoryWithClient(
      routeContext.supabase,
      routeContext.house.public_code,
      100,
      0
    );

    return withMiniDoor(
      <FacturasLuzScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
        invoices={invoicesHistory}
        canMarkInvoicesPaid={isHouseAdmin}
      />,
      routeContext.dashboardPath,
      "facturas"
    );
  }

  if (sectionPath.startsWith("facturas/")) {
    const categorySlug = sectionPath.replace(/^facturas\//, "");
    const invoicesHistory = await loadHouseInvoiceHistoryWithClient(
      routeContext.supabase,
      routeContext.house.public_code,
      100,
      0
    );
    const categoryName =
      invoicesHistory.find((invoice) => invoice.category_slug === categorySlug)
        ?.category_name ?? "Historial";

    return withMiniDoor(
      <FacturasHistoryScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
        title={`Facturas ${categoryName}`}
        invoices={invoicesHistory}
        categorySlug={categorySlug}
        canMarkInvoicesPaid={isHouseAdmin}
      />,
      routeContext.dashboardPath,
      "facturas"
    );
  }

  const expensesDashboard = sectionPath.startsWith("gastos")
    ? await loadHouseExpensesDashboardWithClient(
        routeContext.supabase,
        routeContext.house.public_code,
        50,
        50
      )
    : null;
  const pendingPaymentConfirmations = sectionPath === "gastos" || sectionPath === "gastos/division"
    ? await loadHousePendingPaymentConfirmationsWithClient(
        routeContext.supabase,
        routeContext.house.public_code
      )
    : [];
  const openHousePurchaseTickets =
    sectionPath === "gastos"
      ? await loadOpenHousePurchaseTicketsWithClient(
          routeContext.supabase,
          routeContext.house.public_code,
          50
        )
      : [];
  const openHouseSharedExpenses =
    sectionPath === "gastos"
      ? await loadOpenHouseSharedExpensesWithClient(
          routeContext.supabase,
          routeContext.house.public_code,
          50
        )
      : [];
  const ticketsHistory =
    sectionPath === "gastos/tickets"
      ? await loadHousePurchaseTicketsHistoryWithClient(
          routeContext.supabase,
          routeContext.house.public_code,
          100,
          0
        )
      : [];
  const sharedExpensesHistory =
    sectionPath === "gastos/division"
      ? await loadHouseSharedExpensesHistoryWithClient(
          routeContext.supabase,
          routeContext.house.public_code,
          100,
          0
        )
      : [];
  const currentUserExpenseStates =
    sectionPath === "gastos/division"
      ? await loadCurrentUserExpenseStatesWithClient(routeContext.supabase, {
          houseId: routeContext.house.id,
          profileId: routeContext.profile.id,
          expenseIds: sharedExpensesHistory.map((expense) => expense.expense_id),
        })
      : [];
  const addExpenseFormOptions =
    sectionPath === "gastos/anadir-ticket"
      ? await loadAddExpenseFormOptionsWithClient(
          routeContext.supabase,
          routeContext.house.public_code
        )
      : null;

  if (sectionPath === "gastos") {
    return withMiniDoor(
      <GastosScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
        tickets={openHousePurchaseTickets}
        sharedExpenses={openHouseSharedExpenses}
        settlements={expensesDashboard?.settlements ?? []}
        pendingPaymentConfirmations={pendingPaymentConfirmations}
        canReviewPayments={isHouseAdmin}
      />
      ,
      routeContext.dashboardPath,
      "gastos"
    );
  }

  if (sectionPath === "gastos/tickets") {
    return withMiniDoor(
      <GastosTicketsScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
        tickets={ticketsHistory}
      />
      ,
      routeContext.dashboardPath,
      "gastos"
    );
  }

  if (sectionPath === "gastos/division") {
    return withMiniDoor(
      <GastosDivisionScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
        sharedExpenses={sharedExpensesHistory}
        currentProfileId={routeContext.profile.id}
        currentUserExpenseStates={currentUserExpenseStates}
        pendingPaymentConfirmations={pendingPaymentConfirmations}
        canReviewPayments={isHouseAdmin}
      />
      ,
      routeContext.dashboardPath,
      "gastos"
    );
  }

  if (sectionPath === "gastos/simplificar") {
    return withMiniDoor(
      <GastosSimplificarScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
        settlements={expensesDashboard?.settlements ?? []}
      />,
      routeContext.dashboardPath,
      "gastos"
    );
  }

  if (sectionPath === "gastos/simplificar/pago-simplificado") {
    return withMiniDoor(
      <GastosPagoSimplificadoScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
        settlements={expensesDashboard?.settlements ?? []}
      />,
      routeContext.dashboardPath,
      "gastos"
    );
  }

  if (sectionPath === "gastos/anadir-ticket") {
    return withMiniDoor(
      <GastosAddTicketScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
        currentProfileId={routeContext.profile.id}
        formOptions={addExpenseFormOptions ?? { members: [], items: [] }}
      />
      ,
      routeContext.dashboardPath,
      "gastos"
    );
  }

  notFound();
}
