import Link from "next/link";
import type { Route } from "next";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b bg-card/60">
      <nav className="mx-auto flex max-w-7xl flex-wrap gap-x-6 gap-y-2 px-4 py-3 text-sm text-muted-foreground sm:px-6 lg:px-8">
        <Link className="font-medium text-foreground" href="/admin/analytics">
          Analytics
        </Link>
        <a className="hover:text-foreground" href="/admin/users">
          Users
        </a>
        <a className="hover:text-foreground" href="/admin/emails">
          Email
        </a>
        <a className="hover:text-foreground" href="/admin/feedback">
          Feedback
        </a>
        {/* `as Route` cast — Next typed-routes hasn't regenerated for
            this route yet. Same convention as /plans in app-sidebar. */}
        <Link className="hover:text-foreground" href={"/admin/features" as Route}>
          Features
        </Link>
      </nav>
      {children}
    </div>
  );
}
