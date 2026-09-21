import { ResetPasswordForm } from "./reset-form";

export const metadata = { title: "Resetowanie hasła", robots: { index: false, follow: false } };

export default function ResetPasswordPage() {
  return <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12">
    <ResetPasswordForm />
  </main>;
}
