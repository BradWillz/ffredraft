"use client";

export default function PrintReportButton() {
  return (
    <button type="button" onClick={() => window.print()} className="newsletter-print-button">
      Print or save PDF
    </button>
  );
}