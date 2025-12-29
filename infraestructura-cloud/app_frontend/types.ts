
export type AlertStatus = "UNKNOWN" | "MATCH";

export interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  photoUrl: string;
  active: boolean;
}

export interface SecurityAlert {
  id: string;
  status: AlertStatus;
  matchedWith: string | null; // Employee ID or Name
  distance: number;
  imageUrl: string;
  croppedFaceUrl: string;
  createdAt: any; // Firestore Timestamp
  reviewed: boolean;
}

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}
