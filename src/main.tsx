import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Desktop app specific configurations
if (typeof window !== 'undefined') {
  // Disable text selection for a more native feel in production
  if (process.env.NODE_ENV === 'production') {
    document.addEventListener('selectstart', e => e.preventDefault());
    document.addEventListener('contextmenu', e => e.preventDefault());
  }

  // Set app title
  document.title = "ORDER Multisig Dashboard";
}

createRoot(document.getElementById("root")!).render(<App />);
