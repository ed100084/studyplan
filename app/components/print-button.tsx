"use client";

export function PrintButton() {
  return (
    <button className="button primary print-hide" type="button" onClick={() => window.print()}>
      列印 / 另存 PDF
    </button>
  );
}
