import Link from "next/link";
import { markNotificationRead, markNotificationsRead } from "@/app/actions/notifications";

export type NotificationView = {
  id: number;
  kind: "submission_approved" | "submission_imported" | "submission_rejected" | "comment_reply" | "comment_like" | "new_follower";
  message: string;
  read_at: string | null;
  created_at: string;
  href: string;
  statusLabel: string;
  rejectionReason: string | null;
};

const statusStyles = {
  submission_approved: "bg-amber-50 text-amber-800",
  submission_imported: "bg-emerald-50 text-emerald-800",
  submission_rejected: "bg-red-50 text-red-700",
  comment_reply: "bg-blue-50 text-blue-800",
  comment_like: "bg-pink-50 text-pink-800",
  new_follower: "bg-violet-50 text-violet-800",
};

export function NotificationsPanel({ notifications }: { notifications: NotificationView[] }) {
  const unread = notifications.some(item => !item.read_at);
  return <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-3xl font-black">Powiadomienia</h1><p className="mt-1 text-sm text-zinc-500">Nowi obserwujący, odpowiedzi, polubienia oraz informacje o zgłoszeniach katalogu.</p></div>
      {unread && <form action={markNotificationsRead}><button className="rounded-xl border border-zinc-300 px-3 py-2 text-sm font-bold hover:bg-zinc-50">Oznacz wszystkie jako przeczytane</button></form>}
    </div>
    {notifications.length ? <ul className="mt-6 space-y-3">{notifications.map(item => <li id={`powiadomienie-${item.id}`} key={item.id} className={`rounded-2xl border p-5 ${item.read_at ? "border-zinc-100" : "border-emerald-300 bg-emerald-50"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${statusStyles[item.kind]}`}>{item.statusLabel}</span><p className="mt-3 font-semibold">{item.message}</p>{item.rejectionReason && <p className="mt-2 text-sm text-red-700">Powód: {item.rejectionReason}</p>}<p className="mt-2 text-xs text-zinc-500">{new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.created_at))}</p></div>
        {!item.read_at && <form action={markNotificationRead}><input type="hidden" name="notificationId" value={item.id} /><button className="text-xs font-bold text-zinc-600 underline">Oznacz jako przeczytane</button></form>}
      </div>
      <Link href={item.href} className="mt-4 inline-flex rounded-xl bg-zinc-950 px-4 py-2 text-sm font-bold text-white">{item.kind === "new_follower" ? "Otwórz profil" : item.kind === "comment_reply" || item.kind === "comment_like" ? "Otwórz dyskusję" : item.kind === "submission_imported" ? "Otwórz w katalogu" : "Otwórz zgłoszenie"}</Link>
    </li>)}</ul> : <p className="mt-6 text-zinc-500">Brak powiadomień.</p>}
  </section>;
}
