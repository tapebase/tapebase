import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=%2Fadmin%2Fzgloszenia");
  if (viewer.role !== "admin") notFound();

  return children;
}
