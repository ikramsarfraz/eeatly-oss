"use client";

import Link from "next/link";
import { Fragment } from "react";
import type { Route } from "next";
import { usePathname } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useBreadcrumbLabels } from "@/components/breadcrumb-label-provider";
import { cn } from "@/lib/utils";

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Tonight",
  history: "History",
  settings: "Settings",
};

function humanizeSegment(segment: string): string {
  return segment
    .split("-")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function labelForSegment(segment: string): string {
  return SEGMENT_LABELS[segment] ?? humanizeSegment(segment);
}

type Crumb = { href: string; label: string; isCurrent: boolean };

function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return [{ href: "/dashboard", label: "Tonight", isCurrent: true }];
  }

  const crumbs: Crumb[] = [];
  let path = "";
  for (let i = 0; i < segments.length; i++) {
    path += `/${segments[i]}`;
    const label = labelForSegment(segments[i]);
    const isCurrent = i === segments.length - 1;
    crumbs.push({ href: path, label, isCurrent });
  }

  return crumbs;
}

export function AppBreadcrumb() {
  const pathname = usePathname() ?? "/";
  const crumbs = buildCrumbs(pathname);
  const { labels } = useBreadcrumbLabels();

  const hideCrumbOnMobile = (i: number) =>
    crumbs.length >= 2 && i < crumbs.length - 2;

  const hideSeparatorAfterOnMobile = (i: number) =>
    crumbs.length >= 2 && i < crumbs.length - 2;

  return (
    <Breadcrumb className="min-w-0 flex-1">
      <BreadcrumbList>
        {crumbs.map((crumb, i) => (
          <Fragment key={`${crumb.href}-${i}`}>
            <BreadcrumbItem
              className={cn(hideCrumbOnMobile(i) && "hidden md:inline-flex")}
            >
              {crumb.isCurrent ? (
                <BreadcrumbPage>
                  {labels[crumb.href] ?? crumb.label}
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={crumb.href as Route}>
                    {labels[crumb.href] ?? crumb.label}
                  </Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {i < crumbs.length - 1 ? (
              <BreadcrumbSeparator
                className={cn(
                  hideSeparatorAfterOnMobile(i) && "hidden md:flex",
                )}
              />
            ) : null}
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
