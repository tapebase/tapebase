import { redirect } from "next/navigation";
import { NotificationsPanel } from "@/components/notifications-panel";
import { NotificationsReadReceipt } from "@/components/notifications-read-receipt";
import { getViewer } from "@/lib/auth";
import { getNotifications } from "@/lib/notifications";

export const metadata = { title: "Powiadomienia", robots: { index: false, follow: false } };

export default async function NotificationsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=%2Fpowiadomienia");
  const notifications = await getNotifications(viewer.id);
  const hasUnread = notifications.some(item => !item.read_at);
  return <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
    {hasUnread && <NotificationsReadReceipt />}
    <NotificationsPanel notifications={notifications} />
  </main>;
}
