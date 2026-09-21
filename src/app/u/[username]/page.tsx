import { notFound } from "next/navigation";
import { ProfileActivitySections, ProfileHero } from "@/components/profile-activity";
import { getPublicProfileByUsername } from "@/lib/profiles";
import { getViewer } from "@/lib/auth";
import { getRelationshipState } from "@/lib/follows";
import { ProfileConnections, ProfileFollowButton, ProfileFollowControls } from "@/components/profile-social";
import { getPublicUserLists } from "@/lib/user-lists";
import { UserListsSection } from "@/components/user-lists";
import { JsonLd } from "@/components/json-ld";
import { absoluteUrl, DEFAULT_SOCIAL_IMAGE, SITE_NAME } from "@/lib/seo";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props) {
  const { username } = await params;
  const activity = await getPublicProfileByUsername(username);
  if (!activity) return { title: "Profil użytkownika", robots: { index: false, follow: true } };
  const profilePath = `/u/${encodeURIComponent(activity.profile.username)}`;
  const activityCount = activity.ratingCount + activity.commentCount + activity.listenedCount + activity.addedAlbumCount + activity.addedBiographyCount;
  const description = `Profil muzyczny @${activity.profile.username} w TAPEBASE: ${activity.ratingCount} ocen, ${activity.commentCount} komentarzy i ${activity.listenedCount} przesłuchanych albumów.`;
  return {
    title: `@${activity.profile.username} – profil muzyczny`,
    description,
    alternates: activityCount > 0 ? { canonical: profilePath } : undefined,
    openGraph: {
      title: `@${activity.profile.username} w TAPEBASE`,
      description,
      url: profilePath,
      type: "profile" as const,
      siteName: SITE_NAME,
      locale: "pl_PL",
      images: activity.profile.avatar_url ? [{ url: activity.profile.avatar_url, alt: `Avatar użytkownika ${activity.profile.username}` }] : [{ url: DEFAULT_SOCIAL_IMAGE, alt: "TAPEBASE – społecznościowa baza muzyki" }],
    },
    twitter: { card: "summary_large_image" as const, title: `@${activity.profile.username} w TAPEBASE`, description, images: activity.profile.avatar_url ? [activity.profile.avatar_url] : [DEFAULT_SOCIAL_IMAGE] },
    robots: activityCount > 0 ? undefined : { index: false, follow: true },
  };
}

export default async function PublicProfilePage({ params }: Props) {
  const { username } = await params;
  const [activity, viewer] = await Promise.all([getPublicProfileByUsername(username), getViewer()]);
  if (!activity) notFound();
  const [relationship, userLists] = await Promise.all([
    viewer && viewer.id !== activity.profile.id ? getRelationshipState(activity.profile.id) : Promise.resolve(null),
    getPublicUserLists(activity.profile.id),
  ]);

  return <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
    <JsonLd data={{
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      "@id": `${absoluteUrl(`/u/${encodeURIComponent(activity.profile.username)}`)}#profile`,
      url: absoluteUrl(`/u/${encodeURIComponent(activity.profile.username)}`),
      dateCreated: activity.profile.created_at,
      mainEntity: {
        "@type": "Person",
        name: activity.profile.username,
        image: activity.profile.avatar_url || undefined,
        url: absoluteUrl(`/u/${encodeURIComponent(activity.profile.username)}`),
      },
    }} />
    <ProfileHero activity={activity} followAction={relationship ? <ProfileFollowButton targetUserId={activity.profile.id} username={activity.profile.username} relationship={relationship} /> : null} />
    {relationship && <ProfileFollowControls targetUserId={activity.profile.id} username={activity.profile.username} relationship={relationship} />}
    <ProfileConnections followers={activity.followers} following={activity.following} />
    <UserListsSection lists={userLists} />
    <ProfileActivitySections activity={activity} />
  </main>;
}
