export interface ComplaintComment {
  _id: string;
  message: string;
  authorName: string;
  authorRole: 'tenant' | 'owner' | 'superadmin';
  createdAt: string;
}

export interface Complaint {
  _id: string;
  tenantId: any;
  propertyId: any;
  roomId?: any;
  ownerId: any;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'resolved' | 'rejected' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  resolutionNotes?: string;
  category?: string;
  images?: string[];
  comments?: ComplaintComment[];
  resolvedAt?: string;
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
