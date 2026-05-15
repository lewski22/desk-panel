import type { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub:            string;
  email:          string;
  role:           UserRole;
  organizationId: string | null;
  impersonated?:  boolean;
  iat?:           number;
  exp?:           number;
}
