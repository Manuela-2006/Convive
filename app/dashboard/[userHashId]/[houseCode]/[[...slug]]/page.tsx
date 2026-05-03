import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { AjustesScreen } from "../../../../../components/ajustes/ajustes-screen";
import { HouseOnboardingScreen } from "../../../../../components/auth/house-onboarding-screen";
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
import { GastosRepartoScreen } from "../../../../../components/gastos/gastos-reparto-screen";
import { GastosScreen } from "../../../../../components/gastos/gastos-screen";
import { GastosSimplificarScreen } from "../../../../../components/gastos/gastos-simplificar-screen";
import { GastosTicketsScreen } from "../../../../../components/gastos/gastos-tickets-screen";
import { GastosValidacionesScreen } from "../../../../../components/gastos/gastos-validaciones-screen";
import { HerramientasEntraScreen } from "../../../../../components/herramientas/herramientas-entra-screen";
import { HerramientasScreen } from "../../../../../components/herramientas/herramientas-screen";
import { HomeBoard } from "../../../../../components/home/home-board";
import { LimpiezaScreen } from "../../../../../components/limpieza/limpieza-screen";
import { ElectricalMenu } from "../../../../../components/menu/electrical-menu";
import { MiniDoorLink, type MenuKey } from "../../../../../components/ui/mini-door-link";
import {
  getAccessibleHouseContext,
  loadProfileSettingsWithClient,
} from "../../../../backend/endpoints/auth/queries";
import {
  loadActiveHouseInviteWithClient,
  loadAreaGrupalDashboardWithClient,
} from "../../../../backend/endpoints/area-grupal/queries";
import { loadPersonalAreaDashboardWithClient } from "../../../../backend/endpoints/area-personal/queries";
import { loadCalendarScreenData } from "../../../../backend/endpoints/calendario/queries";
import {
  loadAddInvoiceFormOptionsWithClient,
  loadHouseInvoiceHistoryWithClient,
  loadHouseInvoicesDashboardWithClient,
} from "../../../../backend/endpoints/facturas/queries";
import {
  loadAddExpenseFormOptionsWithClient,
  loadHouseExpensesDashboardWithClient,
  loadHousePendingPaymentConfirmationsWithClient,
  loadHousePurchaseTicketsHistoryWithClient,
  loadHouseSharedExpensesHistoryWithClient,
  loadOpenHousePurchaseTicketsWithClient,
  loadOpenHouseSharedExpensesWithClient,
} from "../../../../backend/endpoints/gastos/queries";
import { getSharedExpenseSplitAction } from "../../../../backend/endpoints/gastos/actions";
import { loadHomeDashboardWithClient } from "../../../../backend/endpoints/home/queries";
import {
  loadAddCleaningTaskFormOptionsWithClient,
  loadHouseCleaningDashboardWithClient,
} from "../../../../backend/endpoints/limpieza/queries";

type HouseRoutePageProps = {
  params: Promise<{
    userHashId: string;
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

export default async function HouseRoutePage({ params }: HouseRoutePageProps) {
  const { userHashId, houseCode, slug } = await params;
  const routeContext = await getAccessibleHouseContext(userHashId, houseCode);
  const sectionPath = (slug ?? []).join("/");
  const isHouseAdmin =
    routeContext.memberRole === "admin" ||
    routeContext.house.created_by === routeContext.profile.id;

  if (!sectionPath) {
    const homeDashboard = await loadHomeDashboardWithClient(
      routeContext.supabase,
      routeContext.house.public_code,
      routeContext.profile.id
    );

    return (
      <HomeBoard
        houseCode={routeContext.house.public_code}
        houseName={routeContext.house.name}
        memberCount={homeDashboard.memberCount}
        dashboardPath={routeContext.dashboardPath}
        monthlyPayments={homeDashboard.monthlyPayments}
        nextPayment={homeDashboard.nextPayment}
        debtSummary={homeDashboard.debtSummary}
        recentActivity={homeDashboard.recentActivity}
      />
    );
  }

  if (sectionPath === "menu") {
    return (
      <ElectricalMenu
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
      />
    );
  }

  if (sectionPath === "completar-perfil") {
    const profileSettings = await loadProfileSettingsWithClient(
      routeContext.supabase,
      routeContext.house.public_code
    );

    return (
      <HouseOnboardingScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
        settings={profileSettings}
      />
    );
  }

  if (sectionPath === "area-personal") {
    const personalDashboard = await loadPersonalAreaDashboardWithClient(
      routeContext.supabase,
      routeContext.house.public_code,
      routeContext.profile.id,
      5
    );

    return withMiniDoor(
      <AreaPersonalScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
        data={personalDashboard}
      />,
      routeContext.dashboardPath,
      "area-personal"
    );
  }

  if (sectionPath === "area-personal/historial") {
    const personalDashboard = await loadPersonalAreaDashboardWithClient(
      routeContext.supabase,
      routeContext.house.public_code,
      routeContext.profile.id,
      100
    );

    return withMiniDoor(
      <AreaPersonalHistoryScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
        entries={personalDashboard.history}
      />,
      routeContext.dashboardPath,
      "area-personal"
    );
  }

  if (sectionPath === "area-grupal") {
    const [houseInvite, groupDashboard] = await Promise.all([
      loadActiveHouseInviteWithClient(
        routeContext.supabase,
        routeContext.house.public_code
      ),
      loadAreaGrupalDashboardWithClient(
        routeContext.supabase,
        routeContext.house.public_code
      ),
    ]);

    return withMiniDoor(
      <AreaGrupalScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
        inviteCode={houseInvite.inviteCode}
        canManageInvites={houseInvite.canManageInvites}
        canRemoveMembers={isHouseAdmin}
        currentProfileId={routeContext.profile.id}
        houseCreatedBy={routeContext.house.created_by}
        data={groupDashboard}
      />,
      routeContext.dashboardPath,
      "area-grupal"
    );
  }

  if (sectionPath === "calendario") {
    const calendarData = await loadCalendarScreenData(
      routeContext.supabase,
      routeContext.house.public_code
    );

    return withMiniDoor(
      <CalendarioScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
        tickets={calendarData.tickets}
        sharedExpenses={calendarData.sharedExpenses}
        invoices={calendarData.invoices}
        cleaningTasks={calendarData.cleaningTasks}
        pendingPayments={calendarData.pendingPayments}
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
    const profileSettings = await loadProfileSettingsWithClient(
      routeContext.supabase,
      routeContext.house.public_code
    );

    return withMiniDoor(
      <AjustesScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
        isAdmin={isHouseAdmin}
        settings={profileSettings}
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
  const pendingPaymentConfirmations =
    sectionPath === "gastos" ||
    sectionPath === "gastos/division" ||
    sectionPath === "gastos/validaciones"
    ? await loadHousePendingPaymentConfirmationsWithClient(
        routeContext.supabase,
        routeContext.house.public_code
      )
    : [];
  const canReviewExpensePayments = pendingPaymentConfirmations.some(
    (payment) => payment.can_review
  );
  const visiblePaymentSimplification =
    expensesDashboard?.payment_simplification.isSimplified
      ? expensesDashboard.payment_simplification.settlements
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
    sectionPath === "gastos/division" ||
    sectionPath.startsWith("gastos/division/reparto/")
      ? await loadHouseSharedExpensesHistoryWithClient(
          routeContext.supabase,
          routeContext.house.public_code,
          100,
          0
        )
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
        settlements={visiblePaymentSimplification}
        pendingPaymentConfirmations={pendingPaymentConfirmations}
        canReviewPayments={canReviewExpensePayments}
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
        pendingPaymentConfirmations={pendingPaymentConfirmations}
        currentProfileId={routeContext.profile.id}
      />
      ,
      routeContext.dashboardPath,
      "gastos"
    );
  }

  if (sectionPath.startsWith("gastos/division/reparto/")) {
    const expenseId = sectionPath.replace("gastos/division/reparto/", "");
    const splitResult = await getSharedExpenseSplitAction({
      houseCode: routeContext.house.public_code,
      expenseId,
    });

    return withMiniDoor(
      <GastosRepartoScreen
        dashboardPath={routeContext.dashboardPath}
        expense={splitResult.success ? splitResult.data.split : null}
      />,
      routeContext.dashboardPath,
      "gastos"
    );
  }

  if (sectionPath === "gastos/validaciones") {
    return withMiniDoor(
      <GastosValidacionesScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
        pendingPaymentConfirmations={pendingPaymentConfirmations}
      />,
      routeContext.dashboardPath,
      "gastos"
    );
  }

  if (sectionPath === "gastos/simplificar") {
    return withMiniDoor(
      <GastosSimplificarScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
        settlements={visiblePaymentSimplification}
        originalPaymentCount={
          expensesDashboard?.payment_simplification.originalPaymentCount ?? 0
        }
        optimizedPaymentCount={
          expensesDashboard?.payment_simplification.optimizedPaymentCount ?? 0
        }
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
        settlements={visiblePaymentSimplification}
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
