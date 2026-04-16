import { notFound } from "next/navigation";

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
import {
  getAccessibleHouseContext,
  loadActiveHouseInviteWithClient,
  loadAddExpenseFormOptionsWithClient,
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
    return (
      <AreaPersonalScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
      />
    );
  }

  if (sectionPath === "area-personal/historial") {
    return (
      <AreaPersonalHistoryScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
      />
    );
  }

  if (sectionPath === "area-grupal") {
    const houseInvite = await loadActiveHouseInviteWithClient(
      routeContext.supabase,
      routeContext.house.public_code
    );

    return (
      <AreaGrupalScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
        inviteCode={houseInvite.inviteCode}
        canManageInvites={houseInvite.canManageInvites}
      />
    );
  }

  if (sectionPath === "calendario") {
    return (
      <CalendarioScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
      />
    );
  }

  if (sectionPath === "limpieza") {
    return (
      <LimpiezaScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
      />
    );
  }

  if (sectionPath === "herramientas") {
    return (
      <HerramientasScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
      />
    );
  }

  if (sectionPath === "herramientas/entra-alguien") {
    return (
      <HerramientasEntraScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
      />
    );
  }

  if (sectionPath === "ajustes") {
    return (
      <AjustesScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
      />
    );
  }

  if (sectionPath === "facturas") {
    return (
      <FacturasScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
      />
    );
  }

  if (sectionPath === "facturas/alquiler") {
    return (
      <FacturasAlquilerScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
      />
    );
  }

  if (sectionPath === "facturas/suscripciones") {
    return (
      <FacturasSuscripcionesScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
      />
    );
  }

  if (sectionPath === "facturas/wifi") {
    return (
      <FacturasWifiScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
      />
    );
  }

  if (sectionPath === "facturas/agua") {
    return (
      <FacturasAguaScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
      />
    );
  }

  if (sectionPath === "facturas/luz") {
    return (
      <FacturasLuzScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
      />
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
    return (
      <GastosScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
        tickets={openHousePurchaseTickets}
        sharedExpenses={openHouseSharedExpenses}
        settlements={expensesDashboard?.settlements ?? []}
        pendingPaymentConfirmations={pendingPaymentConfirmations}
        canReviewPayments={isHouseAdmin}
      />
    );
  }

  if (sectionPath === "gastos/tickets") {
    return (
      <GastosTicketsScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
        tickets={ticketsHistory}
      />
    );
  }

  if (sectionPath === "gastos/division") {
    return (
      <GastosDivisionScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
        sharedExpenses={sharedExpensesHistory}
        currentProfileId={routeContext.profile.id}
        currentUserExpenseStates={currentUserExpenseStates}
        pendingPaymentConfirmations={pendingPaymentConfirmations}
        canReviewPayments={isHouseAdmin}
      />
    );
  }

  if (sectionPath === "gastos/simplificar") {
    return (
      <GastosSimplificarScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
        settlements={expensesDashboard?.settlements ?? []}
      />
    );
  }

  if (sectionPath === "gastos/simplificar/pago-simplificado") {
    return (
      <GastosPagoSimplificadoScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
        settlements={expensesDashboard?.settlements ?? []}
      />
    );
  }

  if (sectionPath === "gastos/anadir-ticket") {
    return (
      <GastosAddTicketScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
        currentProfileId={routeContext.profile.id}
        formOptions={addExpenseFormOptions ?? { members: [], items: [] }}
      />
    );
  }

  notFound();
}
