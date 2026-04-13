import { redirect } from "next/navigation";

import { getDefaultDashboardPath } from "../../lib/dashboard";

export default async function DashboardPage() {
  redirect(await getDefaultDashboardPath());
}
