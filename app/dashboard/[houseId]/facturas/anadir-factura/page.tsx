import { redirect } from "next/navigation";

import { FacturasAddScreen } from "../../../../../components/facturas/facturas-add-screen";
import { createClient } from "../../../../../utils/supabase/server";

type FacturasAddPageProps = {
  params: Promise<{
    houseId: string;
  }>;
};

export default async function FacturasAddPage({ params }: FacturasAddPageProps) {
  const { houseId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: house } = await supabase
    .from("houses")
    .select("public_code")
    .eq("public_code", houseId)
    .single();

  if (!house) {
    redirect("/dashboard");
  }

  return <FacturasAddScreen houseCode={house.public_code} />;
}
