import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import App from "./App.tsx";
import AppErrorBoundary from "./components/AppErrorBoundary.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="coopaiba-theme" disableTransitionOnChange={false}>
      <App />
    </ThemeProvider>
  </AppErrorBoundary>,
);
