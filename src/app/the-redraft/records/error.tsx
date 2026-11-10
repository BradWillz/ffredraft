"use client";

import Link from "next/link";

export default function RecordsError({ reset }: { reset: () => void }) {
  return <main className="max-w-7xl mx-auto p-8" role="alert">
    <p className="eyebrow">The Record Book</p>
    <h1 className="text-4xl">The evidence locker couldn&apos;t be opened.</h1>
    <p className="my-4">League history could not be loaded. No partial records are being shown.</p>
    <button onClick={reset} className="border rounded px-4 py-2 mr-4 cursor-pointer">Try again</button>
    <Link href="/the-redraft">Back to Redraft headquarters</Link>
  </main>;
}
