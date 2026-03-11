import React from "react";
import ReactDOM from "react-dom";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

ReactDOM.render(
  <React.StrictMode>
    <ThemeProvider>
      <SettingsProvider>
        <AuthProvider>
          <BrowserRouter>
            <App />
            <ToastContainer
              toastStyle={{
                border: "1.5px solid var(--border-color, #111)",
                borderRadius: "3px",
                boxShadow: "none",
                background: "var(--card-bg, #fff)",
                color: "var(--fg, #111)",
              }}
            />
          </BrowserRouter>
        </AuthProvider>
      </SettingsProvider>
    </ThemeProvider>
  </React.StrictMode>,
  document.getElementById("root")
);
