import React, { createContext, useContext } from 'react';

export interface AppUser {
  id:                  string;
  email:               string;
  firstName?:          string;
  lastName?:           string;
  role:                string;
  organizationId?:     string;
  enabledModules?:     string[];
  subscriptionStatus?: string | null;
  mustChangePassword?: boolean;
  impersonated?:       boolean;
}

interface UserContextValue {
  user:    AppUser | null;
  setUser: (u: AppUser | null) => void;
}

export const UserContext = createContext<UserContextValue>({
  user: null, setUser: () => {},
});

export const useUser    = () => useContext(UserContext);
export const useRole    = () => useContext(UserContext).user?.role ?? '';
export const useOrgUser = () => useContext(UserContext).user;
