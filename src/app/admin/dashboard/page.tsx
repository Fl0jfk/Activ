import { redirect } from "next/navigation";

export default function AdminDashboardPage() {
  redirect("/espace/bureau/contenu?onglet=association");
}
