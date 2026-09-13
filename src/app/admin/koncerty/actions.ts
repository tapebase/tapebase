"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { syncTicketmasterConcerts } from "@/lib/concert-sync";

export type ConcertSyncActionState = { success?: boolean; message?: string };

export async function runConcertSync(state: ConcertSyncActionState): Promise<ConcertSyncActionState> {
  void state;
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin") return { success: false, message: "Brak uprawnień administratora." };
  try {
    const result = await syncTicketmasterConcerts({ startedBy: viewer.id, batchSize: 20 });
    revalidatePath("/artist/[slug]", "page");
    revalidatePath("/admin/koncerty");
    const ending = result.cycleComplete ? " Sprawdzono cały katalog." : " Kolejne uruchomienie przejdzie do następnej partii.";
    const failures = result.artistsFailed ? ` Nie udało się sprawdzić ${result.artistsFailed} artystów; szczegóły są w historii.` : "";
    return { success: true, message: `Sprawdzono ${result.artistsChecked} artystów, znaleziono ${result.eventsFound} wydarzeń i zapisano ${result.eventsSaved}.${failures}${ending}` };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Synchronizacja nie powiodła się." };
  }
}
