export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
}

export interface UserSession {
  token: string;
  user: UserProfile;
}
