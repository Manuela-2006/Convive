"use client";

import type { HTMLAttributes } from "react";
import { createContext, useContext, useMemo, useState } from "react";

type TabsContextValue = {
  value: string;
  setValue: (next: string) => void;
};

const TabsContext = createContext<TabsContextValue | null>(null);

type TabsProps = HTMLAttributes<HTMLDivElement> & {
  defaultValue: string;
};

export function Tabs({ defaultValue, className = "", children, ...props }: TabsProps) {
  const [value, setValue] = useState(defaultValue);
  const contextValue = useMemo(() => ({ value, setValue }), [value]);

  return (
    <TabsContext.Provider value={contextValue}>
      <div className={className} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

type TabsListProps = HTMLAttributes<HTMLDivElement>;

export function TabsList({ className = "", ...props }: TabsListProps) {
  return <div className={className} role="tablist" {...props} />;
}

type TabsTriggerProps = HTMLAttributes<HTMLButtonElement> & {
  value: string;
};

export function TabsTrigger({ value, className = "", children, ...props }: TabsTriggerProps) {
  const context = useContext(TabsContext);

  if (!context) {
    throw new Error("TabsTrigger must be used inside Tabs");
  }

  const isActive = context.value === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      data-state={isActive ? "active" : "inactive"}
      className={className}
      onClick={() => context.setValue(value)}
      {...props}
    >
      {children}
    </button>
  );
}

type TabsContentProps = HTMLAttributes<HTMLDivElement> & {
  value: string;
};

export function TabsContent({ value, className = "", children, ...props }: TabsContentProps) {
  const context = useContext(TabsContext);

  if (!context) {
    throw new Error("TabsContent must be used inside Tabs");
  }

  const isActive = context.value === value;

  return (
    <div
      role="tabpanel"
      className={className}
      hidden={!isActive}
      aria-hidden={!isActive}
      style={{ display: isActive ? undefined : "none" }}
      {...props}
    >
      {children}
    </div>
  );
}
