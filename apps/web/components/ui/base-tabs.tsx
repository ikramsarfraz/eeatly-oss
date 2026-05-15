"use client";

import * as React from "react";
import { Tabs } from "@base-ui/react/tabs";
import { cn } from "@/lib/utils";

type BaseTabsProps = React.ComponentProps<typeof Tabs.Root>;

function BaseTabs({ className, ...props }: BaseTabsProps) {
  return <Tabs.Root className={cn("w-full", className)} {...props} />;
}

function BaseTabsList({
  className,
  ...props
}: React.ComponentProps<typeof Tabs.List>) {
  return (
    <Tabs.List
      className={cn(
        "relative grid w-full grid-cols-3 rounded-lg border bg-card p-1 text-sm shadow-sm",
        className
      )}
      {...props}
    />
  );
}

function BaseTabsTab({ className, ...props }: React.ComponentProps<typeof Tabs.Tab>) {
  return (
    <Tabs.Tab
      className={cn(
        "rounded-md px-3 py-2 font-medium text-muted-foreground outline-none transition-colors data-[selected]:bg-secondary data-[selected]:text-secondary-foreground focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      {...props}
    />
  );
}

function BaseTabsPanel({
  className,
  ...props
}: React.ComponentProps<typeof Tabs.Panel>) {
  return <Tabs.Panel className={cn("mt-4 outline-none", className)} {...props} />;
}

export { BaseTabs, BaseTabsList, BaseTabsTab, BaseTabsPanel };
