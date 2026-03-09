import { NextResponse } from "next/server";
import { STARTUPS } from "@/lib/startups";
import { fetchStartupData, StartupData } from "@/lib/stripe-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const results: StartupData[] = await Promise.all(
      STARTUPS.map((startup) => fetchStartupData(startup))
    );

    // Sort by MRR descending
    results.sort((a, b) => b.mrr - a.mrr);

    return NextResponse.json({ startups: results });
  } catch (error) {
    console.error("Error fetching leaderboard data:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard data" },
      { status: 500 }
    );
  }
}
