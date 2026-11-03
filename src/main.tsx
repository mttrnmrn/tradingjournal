import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App";
import "@/index.css";

// Apply the last used theme immediately to avoid a flash; the saved setting takes over after login.
try {
  const t = localStorage.getItem("tj-theme");
  document.documentElement.classList.toggle("dark", t !== "light");
} catch {
  /* ignore */
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
