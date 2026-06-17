export interface Property {
  _id: string;
  name: string;
  address: string;
}

export interface Room {
  _id: string;
  roomNumber: string;
  floor: number;
  monthlyRent: number;
}

export interface Owner {
  _id: string;
  name: string;
  phone: string;
  upiId?: string;
  bankDetails?: string;
}

export interface Tenant {
  _id: string;
  userId: {
    _id: string;
    name: string;
    email: string;
  };
  propertyId: Property;
  roomId: Room;
  ownerId: Owner;
  status: 'active' | 'vacated';
  joinDate: string;
  moveInDate?: string;
  rentDueDay: number;
  securityDeposit: number;
  advancePaid: number;
  coOccupants?: any[];
}

export interface MyTenancyResponse {
  success: boolean;
  tenant: Tenant | null;
}
