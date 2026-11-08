import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";

import { AppErrorBoundary } from "../components/AppErrorBoundary";
import { AuthGate } from "../components/AuthGate";
import { ThemeProvider } from "../components/theme";
import { AppRouter } from "./router";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

export function App() {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthGate>
            <BrowserRouter>
              <AppRouter />
            </BrowserRouter>
          </AuthGate>
        </ThemeProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}
