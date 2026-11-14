import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

// No StrictMode: it runs effects twice in dev, which would start two intro animations at once.
createRoot(document.getElementById("root")).render(<App />);
