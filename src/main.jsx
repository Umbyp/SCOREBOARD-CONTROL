import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import AuthGate from "./AuthGate.jsx";
import DisplayBoard from "./DisplayBoard.jsx";
import "./index.css";

// Arena/TV/OBS viewer links (?view=display&u=<uid>) must render with zero
// login — decide this BEFORE any auth listener ever mounts. isViewerMode is
// keyed on `view` alone (not on `u` being present) so a display link missing
// its uid still lands on DisplayBoard's own friendly "no game id" message
// instead of falling through to the login screen.
const params = new URLSearchParams(window.location.search);
const isViewerMode = params.get("view") === "display";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isViewerMode
      ? <DisplayBoard uid={params.get("u")} />
      : <AuthGate><App /></AuthGate>}
  </React.StrictMode>
);
