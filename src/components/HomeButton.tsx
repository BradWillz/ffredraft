import Link from "next/link";

export default function HomeButton() {
  return (
    <Link 
      href="/"
      className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-6 sm:py-3 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 hover:border-slate-600 rounded-lg sm:rounded-xl transition-all duration-200 text-slate-300 hover:text-white font-semibold text-sm sm:text-base"
    >
      <svg 
        className="w-4 h-4 sm:w-5 sm:h-5" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" 
        />
      </svg>
      Home
    </Link>
  );
}
