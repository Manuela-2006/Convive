import { FacturasAddScreen } from "../../../../../../components/facturas/facturas-add-screen";
import { MiniDoorLink } from "../../../../../../components/ui/mini-door-link";
import {
  getAccessibleHouseContext,
  loadProfileSettingsWithClient,
} from "../../../../../backend/endpoints/auth/queries";
import { loadAddInvoiceFormOptionsWithClient } from "../../../../../backend/endpoints/facturas/queries";

type FacturasAddPageProps = {
  params: Promise<{
    userHashId: string;
    houseCode: string;
  }>;
};

export default async function FacturasAddPage({ params }: FacturasAddPageProps) {
  const { userHashId, houseCode } = await params;
  const routeContext = await getAccessibleHouseContext(userHashId, houseCode);
  const [formOptions, profileSettings] = await Promise.all([
    loadAddInvoiceFormOptionsWithClient(
      routeContext.supabase,
      routeContext.house.public_code
    ),
    loadProfileSettingsWithClient(
      routeContext.supabase,
      routeContext.house.public_code
    ),
  ]);

  return (
    <>
      <MiniDoorLink
        menuHref={`${routeContext.dashboardPath}/menu`}
        dashboardPath={routeContext.dashboardPath}
        currentScreen="facturas"
      />
      <FacturasAddScreen
        houseCode={routeContext.house.public_code}
        dashboardPath={routeContext.dashboardPath}
        formOptions={formOptions}
        defaultRentAmount={profileSettings.house_member.room_label}
      />
    </>
  );
}
