import { ToastProvider } from "@/components/providers/toast-provider";

export const dynamic = "force-dynamic";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <main
        id="main"
        tabIndex={-1}
        className="grid min-h-screen place-items-center px-4 py-8"
      >
        {children}
      </main>
    </ToastProvider>
  );
}
