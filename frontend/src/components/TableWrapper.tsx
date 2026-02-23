import React from "react";

interface TableWrapperProps {
  children: React.ReactNode;
  className?: string;
}

export default function TableWrapper({ children, className }: TableWrapperProps) {
  return (
    <div
      style={{
        width: "100%",
        overflowX: "auto",
        WebkitOverflowScrolling: "touch",
        borderRadius: "10px",
        border: "1px solid var(--border, #e5e7eb)",
        marginBottom: "16px",
      }}
      className={className}
    >
      {children}
    </div>
  );
}
