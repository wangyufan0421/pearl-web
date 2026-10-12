import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/tokens.css";
import "./styles/app.css";
import "./styles/chain.css";
import "./styles/valuation.css";
import "./styles/valuation-adjustments.css";
import "./styles/archive.css";
import "./styles/core-mechanism.css";
import "./styles/whitepaper.css";
import "./styles/articles.css";
import "./styles/people.css";
import "./styles/navigation.css";
import "./styles/community.css";
import "./styles/community-admin.css";
import "./styles/data-status.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
