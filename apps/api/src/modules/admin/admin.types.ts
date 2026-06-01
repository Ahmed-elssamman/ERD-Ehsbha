export interface AdminJwtPayload {
  iss: 'ehsbha.admin';
  aud: 'admin-app';
  sub: string;                  // admin_user_id
  email: string;
  displayName: string;
  roles: string[];
  permissions: string[];
  permissionsVersion: number;
  mfaPassed: boolean;
  jti: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedAdmin {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  permissions: string[];
  permissionsVersion: number;
  mfaPassed: boolean;
}
