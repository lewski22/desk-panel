/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_AZURE_CLIENT_ID: string;
  readonly VITE_AZURE_REDIRECT_URI?: string;
  readonly VITE_LOCATION_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
