import { redirect } from "next/navigation";

import { getDefaultDashboardPath } from "../../../../lib/dashboard";

export default async function LegacyProfileDashboardPage() {
  redirect(await getDefaultDashboardPath());
}
