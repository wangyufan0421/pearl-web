import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/tokens.css";
import "./styles/app.css";
import "./styles/chain.css";
import "./styles/valuation.css";
import "./styles/valuation-adjustments.css";
import "./styles/archive.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
