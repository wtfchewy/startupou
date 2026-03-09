"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { StartupData } from "@/lib/stripe-data";
import StartupCard from "./StartupCard";

const REFRESH_INTERVAL = 300; // 5 minutes in seconds

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 10000) return `$${(value / 1000).toFixed(1)}k`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${value}`;
}

export default function Leaderboard() {
  const [startups, setStartups] = useState<StartupData[]>([]);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const countdownRef = useRef(REFRESH_INTERVAL);

  const fetchData = useCallback(() => {
    fetch("/api/leaderboard")
      .then((res) => res.json())
      .then((data) => {
        setStartups(data.startups || []);
        setLoading(false);
        countdownRef.current = REFRESH_INTERVAL;
        setCountdown(REFRESH_INTERVAL);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Countdown timer + auto-refresh
  useEffect(() => {
    const timer = setInterval(() => {
      countdownRef.current -= 1;
      setCountdown(countdownRef.current);
      if (countdownRef.current <= 0) {
        fetchData();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gray-800 border-t-transparent" />
          <p className="text-gray-500">Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  const sorted = [...startups].sort((a, b) => b.mrr - a.mrr);
  const totalMrr = startups.reduce((sum, s) => sum + s.mrr, 0);
  const totalThisMonth = startups.reduce(
    (sum, s) => sum + s.revenueThisMonth,
    0
  );
  const avgGrowth =
    startups.length > 0
      ? startups.reduce((sum, s) => sum + s.growthRate, 0) / startups.length
      : 0;
  const totalCustomers = startups.reduce((sum, s) => sum + s.customers, 0);

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;

  return (
    <div className="relative flex h-screen gap-[3vw] p-[2.5vh_3vw]">
      {/* Left Sidebar */}
      <div className="flex w-[22vw] shrink-0 flex-col justify-center">
        <h1 className="text-[3.5rem] font-bold leading-tight text-black">
          Startup OU
        </h1>

        <p className="mt-1 text-lg italic text-gray-600">
          The best place on campus to launch a startup.
        </p>

        {/* Aggregate metrics */}
        <div className="mt-[3vh] space-y-[2vh]">
          <div>
            <p className="text-xs font-medium tracking-wider text-gray-600">
              Combined MRR
            </p>
            <p className="text-[2rem] font-bold leading-tight text-black">
              {formatCurrency(totalMrr)}
              <span className="text-base font-normal text-gray-600">/mo</span>
            </p>
          </div>
          <div>
            <p className="text-xs font-medium tracking-wider text-gray-600">
              Earned This Month
            </p>
            <p className="text-[2rem] font-bold leading-tight text-black">
              {formatCurrency(totalThisMonth)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium tracking-wider text-gray-600">
              Avg Growth Rate
            </p>
            <p
              className={`text-[2rem] font-bold leading-tight ${avgGrowth > 0
                  ? "text-emerald-600"
                  : avgGrowth < 0
                    ? "text-red-500"
                    : "text-black"
                }`}
            >
              {avgGrowth > 0 ? "+" : ""}
              {avgGrowth.toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-xs font-medium tracking-wider text-gray-600">
              Total Customers
            </p>
            <p className="text-[2rem] font-bold leading-tight text-black">
              {totalCustomers.toLocaleString()}
            </p>
          </div>
          <p className="text-sm text-gray-600">
            Tracked across {startups.length} startups
          </p>
        </div>
      </div>

      {/* Right: Startup Cards Grid */}
      <div className="min-h-0 flex-1">
        <div className="grid h-full auto-rows-fr grid-cols-2 grid-rows-2 gap-[1.2vw]">
          {sorted.map((startup) => (
            <StartupCard key={startup.name} startup={startup} />
          ))}

          {/* CTA Card */}
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-white/50 p-[1.2vw] text-center">
            <p className="text-[1.3rem] font-bold text-gray-800">
              Want to be on the board?
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Email{" "}
              <span className="font-semibold text-black">wes@ou.edu</span>
            </p>
          </div>
        </div>
      </div>

      {/* Refresh timer */}
      <div className="absolute bottom-[2vh] left-[3vw] text-xs text-gray-400">
        Updating in {minutes}:{seconds.toString().padStart(2, "0")}
      </div>
    </div>
  );
}
