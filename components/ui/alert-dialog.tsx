"use client";

import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import type * as React from "react";

import { cn } from "../../lib/utils";

function AlertDialog({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />;
}

function AlertDialogTrigger({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
  return (
    <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
  );
}

function AlertDialogPortal({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
  return (
    <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
  );
}

function AlertDialogOverlay({
  className,
  style,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
  return (
    <AlertDialogPrimitive.Overlay
      data-slot="alert-dialog-overlay"
      className={cn(className)}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.48)",
        zIndex: 90,
        ...style,
      }}
      {...props}
    />
  );
}

function AlertDialogContent({
  className,
  style,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        className={cn(className)}
        style={{
          position: "fixed",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(92vw, 420px)",
          background: "#f0eae4",
          border: "1px solid #8b1a2f",
          borderRadius: "12px",
          padding: "1rem",
          zIndex: 91,
          boxShadow: "0 14px 35px rgba(0,0,0,0.24)",
          ...style,
        }}
        {...props}
      />
    </AlertDialogPortal>
  );
}

function AlertDialogHeader({
  className,
  style,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn(className)}
      style={{
        display: "grid",
        gap: "0.4rem",
        ...style,
      }}
      {...props}
    />
  );
}

function AlertDialogFooter({
  className,
  style,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(className)}
      style={{
        display: "flex",
        justifyContent: "flex-end",
        gap: "0.5rem",
        marginTop: "0.9rem",
        ...style,
      }}
      {...props}
    />
  );
}

function AlertDialogTitle({
  className,
  style,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn(className)}
      style={{
        margin: 0,
        color: "#8b1a2f",
        fontFamily: "Poppins, sans-serif",
        fontWeight: 700,
        fontSize: "1.08rem",
        ...style,
      }}
      {...props}
    />
  );
}

function AlertDialogDescription({
  className,
  style,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn(className)}
      style={{
        margin: 0,
        color: "#3d3733",
        fontFamily: "Poppins, sans-serif",
        fontSize: "0.95rem",
        lineHeight: 1.35,
        ...style,
      }}
      {...props}
    />
  );
}

function AlertDialogAction({
  className,
  style,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Action>) {
  return (
    <AlertDialogPrimitive.Action
      data-slot="alert-dialog-action"
      className={cn(className)}
      style={{
        border: "none",
        borderRadius: "8px",
        minHeight: "36px",
        padding: "0.35rem 0.85rem",
        background: "#8b1a2f",
        color: "#f0eae4",
        fontFamily: "Poppins, sans-serif",
        fontWeight: 500,
        cursor: "pointer",
        ...style,
      }}
      {...props}
    />
  );
}

function AlertDialogCancel({
  className,
  style,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return (
    <AlertDialogPrimitive.Cancel
      data-slot="alert-dialog-cancel"
      className={cn(className)}
      style={{
        border: "1px solid #8b1a2f",
        borderRadius: "8px",
        minHeight: "36px",
        padding: "0.35rem 0.85rem",
        background: "transparent",
        color: "#8b1a2f",
        fontFamily: "Poppins, sans-serif",
        fontWeight: 500,
        cursor: "pointer",
        ...style,
      }}
      {...props}
    />
  );
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
};
