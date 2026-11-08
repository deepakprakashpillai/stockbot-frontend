/// <reference types="vite/client" />

interface Window {
  __STOCKBOT_CONFIG__?: {
    apiBaseUrl?: string;
    websocketUrl?: string;
  };
}
