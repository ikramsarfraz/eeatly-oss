import Link from "next/link";

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
      </nav>
      {children}
    </div>
  );
}
