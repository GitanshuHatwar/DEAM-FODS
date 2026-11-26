import { QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthProvider";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { queryClient } from "@/lib/queryClient";
import { AppRouter } from "@/routes/AppRouter";

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <BrowserRouter>
            <AuthProvider>
              <AppRouter />
            </AuthProvider>
          </BrowserRouter>
        </ToastProvider>
      </QueryClientProvider>
    </MotionConfig>
  );
}

export default App;
