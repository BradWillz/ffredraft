import HomeButton from "@/components/HomeButton";
import LadbrokesClient from "./LadbrokesClient";

export default function LadbrokesPage() {
  return (
    <main className="redraft-tool min-h-screen p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8 flex items-center gap-3">
          <HomeButton />
        </div>

        <div className="tool-feature">
          <div className="tool-feature__header p-6 sm:p-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-white flex items-center gap-3">
              <span className="text-4xl">🎰</span>
              Ladbrokes
            </h1>
            <p className="text-emerald-100 mt-2">
              Place your bets on this week's matchups
            </p>
          </div>

          <LadbrokesClient />
        </div>
      </div>
    </main>
  );
}

