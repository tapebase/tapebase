import { notFound } from "next/navigation";
import { ProfileActivitySections, ProfileHero } from "@/components/profile-activity";
import { getPublicProfileByUsername } from "@/lib/profiles";

export const metadata = {
  title: "Profil użytkownika",
  description: "Oceny, komentarze i przesłuchane albumy użytkownika TAPEBASE.",
};

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const activity = await getPublicProfileByUsername(username);
  if (!activity) notFound();

  return <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
    <ProfileHero activity={activity} />
    <ProfileActivitySections activity={activity} />
  </main>;
}
