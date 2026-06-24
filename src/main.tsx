import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./theme-light.css";

const savedTheme = localStorage.getItem("song-project-theme");
document.documentElement.dataset.theme = savedTheme === "light" ? "light" : "dark";
document.documentElement.style.colorScheme = savedTheme === "light" ? "light" : "dark";

ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
