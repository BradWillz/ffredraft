// app/ladbrokes/qr-codes/page.tsx
"use client";

import { getAllQRCodeUrls } from "../userAuth";
import HomeButton from "@/components/HomeButton";

export default function QRCodesPage() {
  const qrCodes = getAllQRCodeUrls();

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <HomeButton />
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-6 sm:p-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-white flex items-center gap-3">
              <span className="text-4xl">📱</span>
              Ladbrokes QR Codes
            </h1>
            <p className="text-blue-100 mt-2">
              Unique access codes for each team owner
            </p>
          </div>

          <div className="p-6 sm:p-8">
            <div className="mb-6 bg-yellow-500/20 border border-yellow-500 rounded-lg p-4">
              <p className="text-yellow-200 text-sm">
                <strong>📋 Instructions:</strong> Print or share these QR codes with your league members. 
                Each code is unique and can only be used once. Users who scan the code will be automatically 
                authenticated and can place their bets.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 print:grid-cols-2">
              {qrCodes.map(({ user, url, qrCodeImageUrl }) => (
                <div
                  key={user.code}
                  className="bg-slate-900/50 rounded-lg border border-slate-700/50 p-4 text-center break-inside-avoid"
                >
                  <div className="mb-3">
                    <h3 className="text-xl font-bold text-white">
                      {user.displayName}
                    </h3>
                    <p className="text-sm text-slate-400">{user.username}</p>
                  </div>

                  {/* QR Code Image */}
                  <div className="bg-white p-4 rounded-lg inline-block mb-3">
                    <img
                      src={qrCodeImageUrl}
                      alt={`QR Code for ${user.displayName}`}
                      className="w-48 h-48"
                    />
                  </div>

                  {/* Access Code */}
                  <div className="bg-slate-800 rounded p-3 mb-3">
                    <p className="text-xs text-slate-400 mb-1">Access Code:</p>
                    <p className="text-lg font-mono font-bold text-emerald-400">
                      {user.code}
                    </p>
                  </div>

                  {/* URL for copying */}
                  <details className="text-left">
                    <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-300">
                      Show URL
                    </summary>
                    <div className="mt-2 bg-slate-800 rounded p-2">
                      <code className="text-xs text-slate-300 break-all">
                        {url}
                      </code>
                    </div>
                  </details>
                </div>
              ))}
            </div>

            <div className="mt-8 flex gap-4 justify-center print:hidden">
              <button
                onClick={() => window.print()}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition-colors"
              >
                🖨️ Print QR Codes
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
