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
  loadCurrentUserExpenseStatesWithClient,
  loadHouseExpensesDashboardWithClient,
  loadHousePendingPaymentConfirmationsWithClient,
  loadHousePurchaseTicketsHistoryWithClient,
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
    return withMiniDoor(
      <CalendarioScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
      />,
      routeContext.dashboardPath,
      "calendario"
    );
  }

  if (sectionPath === "limpieza") {
    return withMiniDoor(
      <LimpiezaScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
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
    return withMiniDoor(
      <FacturasScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
      />,
      routeContext.dashboardPath,
      "facturas"
    );
  }

  if (sectionPath === "facturas/alquiler") {
    return withMiniDoor(
      <FacturasAlquilerScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
      />,
      routeContext.dashboardPath,
      "facturas"
    );
  }

  if (sectionPath === "facturas/suscripciones") {
    return withMiniDoor(
      <FacturasSuscripcionesScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
      />,
      routeContext.dashboardPath,
      "facturas"
    );
  }

  if (sectionPath === "facturas/wifi") {
    return withMiniDoor(
      <FacturasWifiScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
      />,
      routeContext.dashboardPath,
      "facturas"
    );
  }

  if (sectionPath === "facturas/agua") {
    return withMiniDoor(
      <FacturasAguaScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
      />,
      routeContext.dashboardPath,
      "facturas"
    );
  }

  if (sectionPath === "facturas/luz") {
    return withMiniDoor(
      <FacturasLuzScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
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
        tickets={expensesDashboard?.tickets ?? []}
        sharedExpenses={expensesDashboard?.shared_expenses ?? []}
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
