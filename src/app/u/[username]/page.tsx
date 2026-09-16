import { notFound } from "next/navigation";
import { ProfileActivitySections, ProfileHero } from "@/components/profile-activity";
import { getPublicProfileByUsername } from "@/lib/profiles";
import { getViewer } from "@/lib/auth";
import { getRelationshipState } from "@/lib/follows";
import { ProfileConnections, ProfileFollowButton, ProfileFollowControls } from "@/components/profile-social";

export const metadata = {
  title: "Profil użytkownika",
  description: "Oceny, komentarze i przesłuchane albumy użytkownika TAPEBASE.",
};

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const [activity, viewer] = await Promise.all([getPublicProfileByUsername(username), getViewer()]);
  if (!activity) notFound();
  const relationship = viewer && viewer.id !== activity.profile.id
    ? await getRelationshipState(activity.profile.id)
    : null;

  return <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
    <ProfileHero activity={activity} followAction={relationship ? <ProfileFollowButton targetUserId={activity.profile.id} username={activity.profile.username} relationship={relationship} /> : null} />
    {relationship && <ProfileFollowControls targetUserId={activity.profile.id} username={activity.profile.username} relationship={relationship} />}
    <ProfileConnections followers={activity.followers} following={activity.following} />
    <ProfileActivitySections activity={activity} />
  </main>;
}
