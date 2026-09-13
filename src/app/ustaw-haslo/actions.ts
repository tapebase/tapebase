"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validatePassword, type AuthFormState } from "@/lib/auth-validation";

export async function updatePassword(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const password = validatePassword(formData.get("password"));
  const confirmation = typeof formData.get("confirmation") === "string" ? String(formData.get("confirmation")) : "";
  const errors: AuthFormState["errors"] = {};
  if (!password) errors.password = "Hasło musi mieć min. 8 znaków, literę i cyfrę.";
  else if (password !== confirmation) errors.password = "Podane hasła nie są takie same.";
  if (Object.keys(errors).length) return { errors };

  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims?.sub) return { message: "Link wygasł. Wyślij nową wiadomość resetującą." };

  const { error } = await supabase.auth.updateUser({ password: password! });
  if (error) return { message: "Nie udało się zmienić hasła. Wyślij nowy link i spróbuj ponownie." };

  await supabase.auth.signOut({ scope: "global" });
  redirect("/login?reset=success");
}
