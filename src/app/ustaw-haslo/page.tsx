import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { UpdatePasswordForm } from "./password-form";

export const metadata = { title: "Ustaw nowe hasło" };

export default async function UpdatePasswordPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/reset-hasla");
  return <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12">
    <UpdatePasswordForm />
  </main>;
}
