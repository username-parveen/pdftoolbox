import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { initializeDocumentAppearance } from "./lib/startupAppearance";
import "./styles.css";

initializeDocumentAppearance(document.documentElement);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
