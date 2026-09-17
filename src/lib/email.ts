import "server-only";

import { createClient } from "@supabase/supabase-js";
import { siteUrl } from "@/lib/site-url";

type FollowerEmailInput = {
  recipientUserId: string;
  actorUsername: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

function emailConfiguration() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseSecret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!apiKey || !from || !supabaseUrl || !supabaseSecret) return null;
  return { apiKey, from, supabaseUrl, supabaseSecret };
}

export async function sendNewFollowerEmail(input: FollowerEmailInput) {
  const configuration = emailConfiguration();
  if (!configuration) return { sent: false, reason: "not_configured" as const };

  const admin = createClient(configuration.supabaseUrl, configuration.supabaseSecret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await admin.auth.admin.getUserById(input.recipientUserId);
  const recipient = data.user?.email;
  if (error || !recipient) throw new Error("Nie udało się odczytać adresu odbiorcy powiadomienia.");

  const username = input.actorUsername.trim() || "Użytkownik";
  const profileUrl = `${siteUrl()}/u/${encodeURIComponent(username)}`;
  const safeUsername = escapeHtml(username);
  const safeProfileUrl = escapeHtml(profileUrl);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${configuration.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: configuration.from,
      to: [recipient],
      subject: `@${username} zaczął Cię obserwować w TAPEBASE`,
      text: `@${username} zaczął Cię obserwować w TAPEBASE. Otwórz profil: ${profileUrl}`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#18181b"><h1 style="font-size:22px">Masz nowego obserwującego</h1><p><strong>@${safeUsername}</strong> zaczął Cię obserwować w TAPEBASE.</p><p><a href="${safeProfileUrl}" style="display:inline-block;border-radius:10px;background:#18181b;color:#fff;padding:11px 16px;text-decoration:none;font-weight:700">Otwórz profil</a></p></div>`,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) throw new Error(`Resend odrzucił wiadomość (HTTP ${response.status}).`);
  return { sent: true as const };
}
