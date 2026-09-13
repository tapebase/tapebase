"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { resetImportJob, runImportQueueBatch, type QueueBatchResult } from "@/lib/import-queue";

async function requireAdmin() {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin") throw new Error("Brak uprawnień administratora.");
}

export async function runQueueBatch(): Promise<QueueBatchResult> {
  await requireAdmin();
  const result = await runImportQueueBatch(3);
  revalidatePath("/admin/import"); revalidatePath("/admin/zgloszenia"); revalidatePath("/zglos");
  revalidatePath("/"); revalidatePath("/album"); revalidatePath("/artist"); revalidatePath("/rankingi");
  return result;
}

export async function retryImportJob(formData: FormData) {
  await requireAdmin();
  const jobId = Number(formData.get("jobId"));
  const kind = String(formData.get("releaseKind"));
  if (!Number.isSafeInteger(jobId) || jobId < 1) return;
  await resetImportJob(jobId, kind === "album" || kind === "ep" ? kind : undefined);
  revalidatePath("/admin/import");
}
