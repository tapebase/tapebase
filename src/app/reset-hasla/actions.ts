"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { validateEmail, type AuthFormState } from "@/lib/auth-validation";
import { siteUrl } from "@/lib/site-url";

export async function requestPasswordReset(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = validateEmail(formData.get("email"));
  if (!email) return { errors: { email: "Podaj poprawny adres e-mail." } };

  const supabase = await createClient();
  const requestOrigin = (await headers()).get("origin");
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl(requestOrigin)}/auth/callback?next=/ustaw-haslo`,
  });

  if (error?.code === "over_email_send_rate_limit") {
    return {
      success: true,
      message:
        "Link był już niedawno wysyłany. Sprawdź skrzynkę i folder spam. Jeśli wiadomości nie ma, spróbuj ponownie za godzinę.",
    };
  }
  if (error) return { message: "Nie udało się wysłać wiadomości. Spróbuj ponownie." };

  return {
    success: true,
    message: "Jeśli konto istnieje, wysłaliśmy wiadomość z linkiem do ustawienia nowego hasła.",
  };
}
