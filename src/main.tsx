import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/main.css";

declare global {
  interface Window {
    __OFFLINE_GO_VERSION__?: string;
  }
}

const container = document.getElementById("root");

if (!container) {
  throw new Error("Failed to find root element");
}

const root = createRoot(container);

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
