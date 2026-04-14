import { redirect } from "next/navigation";

import { FacturasAddScreen } from "../../../../../../components/facturas/facturas-add-screen";
import { getAccessibleHouseContext } from "../../../../../../lib/dashboard";
import { createClient } from "../../../../../../utils/supabase/server";

type FacturasAddPageProps = {
  params: Promise<{
    userCode: string;
    houseCode: string;
  }>;
};

export default async function FacturasAddPage({ params }: FacturasAddPageProps) {
  const { userCode, houseCode } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const routeContext = await getAccessibleHouseContext(userCode, houseCode);

  return (
    <FacturasAddScreen
      houseCode={routeContext.house.public_code}
      dashboardPath={routeContext.dashboardPath}
    />
  );
}
