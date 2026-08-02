import { TABLES, getAllCacheRows, getCacheRow, mergeCacheRow, putCacheRow, deleteCacheRow } from '../db/cacheRepo';
import { ComplaintsResponse, ComplaintDetailResponse, Complaint } from '../types/complaint';

const TABLE = TABLES.complaints;

function toComplaint(data: unknown): Complaint {
  return data as Complaint;
}

function byCreatedDesc(a: Complaint, b: Complaint): number {
  return b.createdAt < a.createdAt ? -1 : b.createdAt > a.createdAt ? 1 : 0;
}

export async function readComplaintsCache(): Promise<ComplaintsResponse | null> {
  const rows = await getAllCacheRows(TABLE);
  if (rows.length === 0) return null;
  const complaints = rows.map((r) => toComplaint(r.data)).sort(byCreatedDesc);
  return { success: true, count: complaints.length, complaints };
}

export async function writeComplaintsCache(res: ComplaintsResponse): Promise<void> {
  for (const complaint of res.complaints) {
    await putCacheRow(TABLE, {
      id: complaint._id,
      data: complaint,
      updatedAt: complaint.updatedAt ?? complaint.createdAt ?? new Date().toISOString(),
    });
  }
}

/** Delta merge: upsert only changed complaints. Returns count actually written. */
export async function mergeComplaints(complaints: Complaint[]): Promise<number> {
  let written = 0;
  for (const complaint of complaints) {
    const ok = await mergeCacheRow(TABLE, {
      id: complaint._id,
      data: complaint,
      updatedAt: complaint.updatedAt ?? complaint.createdAt ?? new Date().toISOString(),
    });
    if (ok) written += 1;
  }
  return written;
}

export async function readComplaintDetailCache(id: string): Promise<ComplaintDetailResponse | null> {
  const row = await getCacheRow(TABLE, id);
  if (!row) return null;
  return { success: true, complaint: toComplaint(row.data) };
}

export async function writeComplaintDetailCache(detail: ComplaintDetailResponse): Promise<void> {
  await putCacheRow(TABLE, {
    id: detail.complaint._id,
    data: detail.complaint,
    updatedAt: detail.complaint.updatedAt ?? detail.complaint.createdAt ?? new Date().toISOString(),
  });
}

export async function mergeComplaint(complaint: Complaint): Promise<boolean> {
  return mergeCacheRow(TABLE, {
    id: complaint._id,
    data: complaint,
    updatedAt: complaint.updatedAt ?? complaint.createdAt ?? new Date().toISOString(),
  });
}

export async function pruneComplaintsCache(): Promise<void> {
  const rows = await getAllCacheRows(TABLE);
  for (const row of rows) {
    if (String(row.id).startsWith('local-')) await deleteCacheRow(TABLE, row.id);
  }
}
