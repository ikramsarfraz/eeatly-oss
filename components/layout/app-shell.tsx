import Link from "next/link";
import type { Route } from "next";
import {
  BookOpen,
  ChefHat,
  Clock3,
  Home,
  MessageSquare,
  Settings,
  type LucideIcon
} from "lucide-react";
import { QuickLogDialog } from "@/components/dashboard/quick-log-dialog";
import { FeedbackDialog } from "@/components/feedback/feedback-dialog";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { AppUser } from "@/lib/auth/session";

const navItems: Array<{
  href: Route;
  label: string;
  icon: LucideIcon;
}> = [
  {
    href: "/dashboard",
    label: "Tonight",
    icon: Home
  },
  {
    href: "/history",
    label: "History",
    icon: Clock3
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings
  }
];

export function AppShell({
  user,
  canWrite,
  children
}: {
  user: AppUser;
  canWrite: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-background/88 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ChefHat className="h-5 w-5" />
            </span>
            <span className="text-lg font-semibold tracking-normal">CookLoop</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const Icon = item.icon;

              return (
                <Button key={item.href} asChild variant="ghost" size="sm">
                  <Link href={item.href}>
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </Button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden gap-2 sm:flex">
              <FeedbackDialog />
              <QuickLogDialog canWrite={canWrite} />
            </div>
            <UserMenu user={user} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/94 px-3 py-2 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium text-muted-foreground",
                  "hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          <QuickLogDialog
            canWrite={canWrite}
            trigger={
              <button className="flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
                <BookOpen className="h-4 w-4" />
                Log
              </button>
            }
          />
          <FeedbackDialog
            trigger={
              <button className="flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
                <MessageSquare className="h-4 w-4" />
                Feedback
              </button>
            }
          />
        </div>
      </nav>
      <Separator className="md:hidden" />
    </div>
  );
}
