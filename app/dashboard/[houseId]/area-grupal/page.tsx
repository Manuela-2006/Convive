import { redirect } from "next/navigation";

import { AreaGrupalScreen } from "../../../../components/area-grupal/area-grupal-screen";
import { createClient } from "../../../../utils/supabase/server";

type AreaGrupalPageProps = {
  params: Promise<{
    houseId: string;
  }>;
};

export default async function AreaGrupalPage({ params }: AreaGrupalPageProps) {
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

  return <AreaGrupalScreen houseCode={house.public_code} />;
}

