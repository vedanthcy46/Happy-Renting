export interface Complaint {
  _id: string;
  tenantId: string;
  propertyId: string;
  ownerId: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  resolutionNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ComplaintsResponse {
  success: boolean;
  count: number;
  complaints: Complaint[];
}

export interface ComplaintDetailResponse {
  success: boolean;
  complaint: Complaint;
}
