"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  safeNextPath,
  validateEmail,
  validatePassword,
  validateUsername,
  type AuthFormState,
} from "@/lib/auth-validation";
import { welcomePath } from "@/lib/onboarding";

export async function signIn(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = validateEmail(formData.get("email"));
  const password = typeof formData.get("password") === "string" ? String(formData.get("password")) : "";
  const next = safeNextPath(formData.get("next"), "/");
  const errors: AuthFormState["errors"] = {};
  if (!email) errors.email = "Podaj poprawny adres e-mail.";
  if (!password) errors.password = "Podaj hasło.";
  if (Object.keys(errors).length) return { errors };

  const supabase = await createClient();
  const { data: signInData, error } = await supabase.auth.signInWithPassword({ email: email!, password });
  if (error) {
    if (error.code === "email_not_confirmed") return { message: "Najpierw potwierdź adres e-mail." };
    return { message: "Nieprawidłowy e-mail lub hasło." };
  }
  const { data: profile } = await supabase.from("users").select("suspended_at,onboarding_completed_at").eq("id", signInData.user.id).maybeSingle();
  if (profile?.suspended_at) {
    await supabase.auth.signOut();
    return { message: "To konto zostało czasowo zawieszone. Skontaktuj się z administratorem." };
  }
  redirect(profile && !profile.onboarding_completed_at ? welcomePath(next) : next);
}

export async function signUp(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const username = validateUsername(formData.get("username"));
  const email = validateEmail(formData.get("email"));
  const password = validatePassword(formData.get("password"));
  const next = safeNextPath(formData.get("next"), "/profil");
  const errors: AuthFormState["errors"] = {};
  if (!username) errors.username = "Użyj 3–24 liter, cyfr lub znaku _.";
  if (!email) errors.email = "Podaj poprawny adres e-mail.";
  if (!password) errors.password = "Hasło musi mieć min. 8 znaków, literę i cyfrę.";
  if (Object.keys(errors).length) return { errors };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .ilike("username", username!)
    .limit(1);
  if (existing?.length) return { errors: { username: "Ta nazwa użytkownika jest zajęta." } };

  const { data, error } = await supabase.auth.signUp({
    email: email!,
    password: password!,
    options: { data: { username } },
  });
  if (error) {
    if (error.code === "user_already_exists") return { message: "Konto z tym adresem już istnieje." };
    if (error.code === "over_email_send_rate_limit") return { message: "Poczekaj chwilę przed kolejną próbą." };
    return { message: "Nie udało się utworzyć konta. Sprawdź dane i spróbuj ponownie." };
  }
  if (data.session) redirect(welcomePath(next));
  return { success: true, message: "Konto utworzone. Potwierdź e-mail z wiadomości od Supabase, a potem zaloguj się." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
