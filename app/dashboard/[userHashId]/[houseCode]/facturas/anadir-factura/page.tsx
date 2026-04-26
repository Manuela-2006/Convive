import { FacturasAddScreen } from "../../../../../../components/facturas/facturas-add-screen";
import { MiniDoorLink } from "../../../../../../components/ui/mini-door-link";
import {
  getAccessibleHouseContext,
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
  const formOptions = await loadAddInvoiceFormOptionsWithClient(
    routeContext.supabase,
    routeContext.house.public_code
  );

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
      />
    </>
  );
}
