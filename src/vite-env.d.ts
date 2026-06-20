/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FRAPPE_URL?: string;
  readonly VITE_CATALOG_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
