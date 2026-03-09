import Stripe from "stripe";
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  format,
  eachMonthOfInterval,
} from "date-fns";
import { StartupConfig, Founder } from "./startups";

export interface MonthlyRevenue {
  month: string; // "Jan", "Feb", etc.
  revenue: number; // in dollars
}

export interface StartupData {
  name: string;
  description: string;
  domain: string;
  logo: string;
  founded: string;
  founders: Founder[];
  mrr: number;
  previousMrr: number;
  growthRate: number; // percentage
  revenueThisMonth: number; // actual charges this month, not MRR
  customers: number; // total customer count
  monthlyRevenue: MonthlyRevenue[]; // last 6 months
}

async function getChargesForPeriod(
  stripe: Stripe,
  start: Date,
  end: Date
): Promise<number> {
  let total = 0;
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const params: Stripe.ChargeListParams = {
      created: {
        gte: Math.floor(start.getTime() / 1000),
        lte: Math.floor(end.getTime() / 1000),
      },
      limit: 100,
    };
    if (startingAfter) params.starting_after = startingAfter;

    const charges = await stripe.charges.list(params);

    for (const charge of charges.data) {
      if (charge.status === "succeeded" && !charge.refunded) {
        total += charge.amount;
      }
    }

    hasMore = charges.has_more;
    if (charges.data.length > 0) {
      startingAfter = charges.data[charges.data.length - 1].id;
    }
  }

  return total / 100; // convert cents to dollars
}

/**
 * Gets fixed MRR from non-metered subscription items.
 */
async function getFixedMRR(stripe: Stripe): Promise<number> {
  let fixedMrr = 0;
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const params: Stripe.SubscriptionListParams = {
      status: "active",
      limit: 100,
    };
    if (startingAfter) params.starting_after = startingAfter;

    const subscriptions = await stripe.subscriptions.list(params);

    for (const sub of subscriptions.data) {
      for (const item of sub.items.data) {
        // Skip metered items — those are calculated from meter usage
        if (item.price?.recurring?.usage_type === "metered") continue;

        const amount = item.price?.unit_amount || 0;
        const quantity = item.quantity || 1;
        const interval = item.price?.recurring?.interval;
        const intervalCount = item.price?.recurring?.interval_count || 1;

        let monthly = 0;
        if (interval === "month") {
          monthly = (amount * quantity) / intervalCount;
        } else if (interval === "year") {
          monthly = (amount * quantity) / (12 * intervalCount);
        } else if (interval === "week") {
          monthly = (amount * quantity * 4.33) / intervalCount;
        } else if (interval === "day") {
          monthly = (amount * quantity * 30.44) / intervalCount;
        }
        fixedMrr += monthly;
      }
    }

    hasMore = subscriptions.has_more;
    if (subscriptions.data.length > 0) {
      startingAfter = subscriptions.data[subscriptions.data.length - 1].id;
    }
  }

  return fixedMrr / 100; // convert cents to dollars
}

interface MeterPriceInfo {
  priceId: string;
  billingScheme: string;
  unitAmount: number | null; // cents, for per_unit pricing
  tiersMode: string | null; // "volume" or "graduated"
  tiers: Array<{
    upTo: number | null;
    flatAmount: number | null;
    unitAmount: number;
  }>;
}

/**
 * Builds a map of meter ID → price info by scanning active subscription items.
 * Handles both simple per_unit and tiered pricing.
 */
async function getMeterPriceMap(
  stripe: Stripe
): Promise<Map<string, MeterPriceInfo>> {
  const meterPrices = new Map<string, MeterPriceInfo>();
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const params: Stripe.SubscriptionListParams = {
      status: "active",
      limit: 100,
    };
    if (startingAfter) params.starting_after = startingAfter;

    const subscriptions = await stripe.subscriptions.list(params);

    for (const sub of subscriptions.data) {
      for (const item of sub.items.data) {
        const price = item.price;
        if (
          price?.recurring?.usage_type === "metered" &&
          price.recurring.meter &&
          !meterPrices.has(price.recurring.meter)
        ) {
          // Fetch full price with tiers expanded
          const fullPrice = await stripe.prices.retrieve(price.id, {
            expand: ["tiers"],
          });

          meterPrices.set(price.recurring.meter, {
            priceId: price.id,
            billingScheme: fullPrice.billing_scheme,
            unitAmount: fullPrice.unit_amount,
            tiersMode: fullPrice.tiers_mode,
            tiers: (fullPrice.tiers || []).map((t) => ({
              upTo: t.up_to,
              flatAmount: t.flat_amount,
              unitAmount: t.unit_amount || 0,
            })),
          });
        }
      }
    }

    hasMore = subscriptions.has_more;
    if (subscriptions.data.length > 0) {
      startingAfter = subscriptions.data[subscriptions.data.length - 1].id;
    }
  }

  return meterPrices;
}

/**
 * Calculates the cost in cents for a given usage quantity using the price info.
 * Supports per_unit, volume tiered, and graduated tiered pricing.
 */
function calculateTieredCost(usage: number, priceInfo: MeterPriceInfo): number {
  if (priceInfo.billingScheme === "per_unit" && priceInfo.unitAmount) {
    return usage * priceInfo.unitAmount;
  }

  if (priceInfo.tiers.length === 0) return 0;

  if (priceInfo.tiersMode === "volume") {
    // Volume: the entire quantity falls into one tier
    for (const tier of priceInfo.tiers) {
      if (tier.upTo === null || usage <= tier.upTo) {
        return (tier.flatAmount || 0) + usage * tier.unitAmount;
      }
    }
  }

  if (priceInfo.tiersMode === "graduated") {
    // Graduated: each unit of usage is priced at the tier it falls into
    let cost = 0;
    let remaining = usage;
    let prevLimit = 0;

    for (const tier of priceInfo.tiers) {
      if (remaining <= 0) break;
      const tierLimit = tier.upTo === null ? Infinity : tier.upTo;
      const tierQty = Math.min(remaining, tierLimit - prevLimit);
      cost += (tier.flatAmount || 0) + tierQty * tier.unitAmount;
      remaining -= tierQty;
      prevLimit = tierLimit;
    }
    return cost;
  }

  return 0;
}

/**
 * Shared context for meter revenue calculations — fetches meters, prices,
 * and customers once, then reuses them across multiple period calculations.
 */
async function getMeterContext(stripe: Stripe) {
  // Get all active meters
  const meters: Stripe.Billing.Meter[] = [];
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const params: Stripe.Billing.MeterListParams = {
      status: "active",
    };
    if (startingAfter)
      (params as Stripe.Billing.MeterListParams & { starting_after: string })
        .starting_after = startingAfter;

    const result = await stripe.billing.meters.list(params);
    meters.push(...result.data);
    hasMore = result.has_more;
    if (result.data.length > 0) {
      startingAfter = result.data[result.data.length - 1].id;
    }
  }

  const meterPrices = await getMeterPriceMap(stripe);

  // Get all customer IDs
  const customerIds: string[] = [];
  hasMore = true;
  startingAfter = undefined;

  while (hasMore) {
    const params: Stripe.CustomerListParams = { limit: 100 };
    if (startingAfter) params.starting_after = startingAfter;

    const customers = await stripe.customers.list(params);
    for (const c of customers.data) {
      customerIds.push(c.id);
    }
    hasMore = customers.has_more;
    if (customers.data.length > 0) {
      startingAfter = customers.data[customers.data.length - 1].id;
    }
  }

  return { meters, meterPrices, customerIds };
}

/**
 * Calculates the total meter usage cost for a given period.
 * Uses per-customer tiered pricing calculation.
 */
async function getMeterCostForPeriod(
  stripe: Stripe,
  ctx: Awaited<ReturnType<typeof getMeterContext>>,
  start: Date,
  end: Date
): Promise<number> {
  const startTs = Math.floor(start.getTime() / 1000);
  const endTs = Math.floor(end.getTime() / 1000);
  if (endTs <= startTs) return 0;

  let totalCents = 0;

  for (const meter of ctx.meters) {
    const priceInfo = ctx.meterPrices.get(meter.id);
    if (!priceInfo) continue;

    const customerUsages = await Promise.all(
      ctx.customerIds.map(async (customerId) => {
        try {
          const summaries = await stripe.billing.meters.listEventSummaries(
            meter.id,
            {
              customer: customerId,
              start_time: startTs,
              end_time: endTs,
            }
          );
          let usage = 0;
          for (const summary of summaries.data) {
            usage += summary.aggregated_value;
          }
          return usage;
        } catch {
          return 0;
        }
      })
    );

    for (const usage of customerUsages) {
      if (usage <= 0) continue;
      totalCents += calculateTieredCost(usage, priceInfo);
    }
  }

  return totalCents / 100;
}

/**
 * Calculates both actual and projected meter cost for the current month
 * in a single pass (one set of API calls for usage summaries).
 */
async function getMeterCostCurrentAndProjected(
  stripe: Stripe,
  ctx: Awaited<ReturnType<typeof getMeterContext>>,
  start: Date,
  end: Date,
  now: Date
): Promise<{ current: number; projected: number }> {
  const startTs = Math.floor(start.getTime() / 1000);
  const endTs = Math.floor(end.getTime() / 1000);
  if (endTs <= startTs) return { current: 0, projected: 0 };

  const daysInMonth = endOfMonth(now).getDate();
  const dayOfMonth = Math.max(now.getDate(), 1);

  let currentCents = 0;
  let projectedCents = 0;

  for (const meter of ctx.meters) {
    const priceInfo = ctx.meterPrices.get(meter.id);
    if (!priceInfo) continue;

    const customerUsages = await Promise.all(
      ctx.customerIds.map(async (customerId) => {
        try {
          const summaries = await stripe.billing.meters.listEventSummaries(
            meter.id,
            { customer: customerId, start_time: startTs, end_time: endTs }
          );
          let usage = 0;
          for (const summary of summaries.data) {
            usage += summary.aggregated_value;
          }
          return usage;
        } catch {
          return 0;
        }
      })
    );

    for (const usage of customerUsages) {
      if (usage <= 0) continue;
      currentCents += calculateTieredCost(usage, priceInfo);
      const projected = Math.round(usage * (daysInMonth / dayOfMonth));
      projectedCents += calculateTieredCost(projected, priceInfo);
    }
  }

  return { current: currentCents / 100, projected: projectedCents / 100 };
}

async function getCustomerCount(stripe: Stripe): Promise<number> {
  let count = 0;
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const params: Stripe.CustomerListParams = { limit: 100 };
    if (startingAfter) params.starting_after = startingAfter;

    const customers = await stripe.customers.list(params);
    count += customers.data.length;

    hasMore = customers.has_more;
    if (customers.data.length > 0) {
      startingAfter = customers.data[customers.data.length - 1].id;
    }
  }

  return count;
}

export async function fetchStartupData(
  config: StartupConfig
): Promise<StartupData> {
  if (!config.stripeSecretKey) {
    // Return demo data if no key provided
    return generateDemoData(config);
  }

  const stripe = new Stripe(config.stripeSecretKey);

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  // Build meter context once if metered, reuse for all calculations
  const meterCtx = config.metered ? await getMeterContext(stripe) : null;

  const prevMonthStart = startOfMonth(subMonths(now, 1));
  const prevMonthEnd = endOfMonth(subMonths(now, 1));

  const [fixedMrr, customers, chargesThisMonth] = await Promise.all([
    getFixedMRR(stripe),
    getCustomerCount(stripe),
    getChargesForPeriod(stripe, monthStart, monthEnd),
  ]);

  // For metered startups, calculate current month (actual + projected) and previous month
  let meterCurrentMonth = 0;
  let meterProjected = 0;
  let meterPrevMonth = 0;
  if (meterCtx) {
    const currentStart = startOfMonth(now);
    currentStart.setSeconds(0, 0);
    const currentEnd = new Date(now);
    currentEnd.setSeconds(0, 0);
    prevMonthStart.setSeconds(0, 0);
    prevMonthEnd.setSeconds(0, 0);

    // Fetch current month usage + previous month cost in parallel
    const [currentMonthResult, prevCost] = await Promise.all([
      getMeterCostCurrentAndProjected(stripe, meterCtx, currentStart, currentEnd, now),
      getMeterCostForPeriod(stripe, meterCtx, prevMonthStart, prevMonthEnd),
    ]);

    meterCurrentMonth = currentMonthResult.current;
    meterProjected = currentMonthResult.projected;
    meterPrevMonth = prevCost;
  }

  const mrr = fixedMrr + meterProjected;
  const revenueThisMonth = config.metered
    ? meterCurrentMonth
    : chargesThisMonth;

  // Fetch last 6 months of revenue for the chart
  const months = eachMonthOfInterval({
    start: subMonths(now, 5),
    end: now,
  });

  const monthlyRevenue: MonthlyRevenue[] = await Promise.all(
    months.map(async (month) => {
      const mStart = startOfMonth(month);
      const mEnd = endOfMonth(month);
      const isCurrentMonth =
        mStart.getMonth() === now.getMonth() &&
        mStart.getFullYear() === now.getFullYear();

      let revenue: number;
      if (config.metered && meterCtx) {
        if (isCurrentMonth) {
          // Already calculated above
          revenue = meterCurrentMonth;
        } else {
          // Past months: query meter usage for that period
          const periodStart = new Date(mStart);
          periodStart.setSeconds(0, 0);
          const periodEnd = startOfMonth(
            new Date(mStart.getFullYear(), mStart.getMonth() + 1, 1)
          );
          periodEnd.setSeconds(0, 0);
          revenue = await getMeterCostForPeriod(
            stripe,
            meterCtx,
            periodStart,
            periodEnd
          );
        }
      } else {
        revenue = await getChargesForPeriod(stripe, mStart, mEnd);
      }

      return {
        month: format(month, "MMM"),
        revenue: Math.round(revenue),
      };
    })
  );

  // Growth rate: compare current vs previous month revenue
  const currentMonthRevenue = config.metered
    ? meterCurrentMonth
    : monthlyRevenue[monthlyRevenue.length - 1]?.revenue || 0;
  const prevMonthRevenue = config.metered
    ? meterPrevMonth
    : monthlyRevenue[monthlyRevenue.length - 2]?.revenue || 0;
  const growthRate =
    prevMonthRevenue > 0
      ? ((currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100
      : currentMonthRevenue > 0
        ? 100
        : 0;

  return {
    name: config.name,
    description: config.description,
    domain: config.domain,
    logo: config.logo,
    founded: config.founded,
    founders: config.founders,
    mrr: Math.round(mrr),
    previousMrr: Math.round(prevMonthRevenue),
    growthRate: Math.round(growthRate * 10) / 10,
    revenueThisMonth: Math.round(revenueThisMonth),
    customers,
    monthlyRevenue,
  };
}

// Generate realistic demo data when no Stripe key is provided
function generateDemoData(config: StartupConfig): StartupData {
  const seed = config.name
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);

  const seededRandom = (min: number, max: number, offset = 0) => {
    const x = Math.sin(seed + offset) * 10000;
    const rand = x - Math.floor(x);
    return Math.floor(rand * (max - min) + min);
  };

  const baseMrr = seededRandom(800, 15000);
  const growthRate = seededRandom(5, 45, 1);
  const now = new Date();
  const months = eachMonthOfInterval({
    start: subMonths(now, 5),
    end: now,
  });

  const monthlyRevenue: MonthlyRevenue[] = months.map((month, i) => {
    const factor = 1 - (5 - i) * 0.15 + seededRandom(-5, 5, i + 10) / 100;
    return {
      month: format(month, "MMM"),
      revenue: Math.max(0, Math.round(baseMrr * factor)),
    };
  });

  const previousMrr = monthlyRevenue[monthlyRevenue.length - 2]?.revenue || 0;

  return {
    name: config.name,
    description: config.description,
    domain: config.domain,
    logo: config.logo,
    founded: config.founded,
    founders: config.founders,
    mrr: baseMrr,
    previousMrr,
    growthRate,
    revenueThisMonth: seededRandom(
      Math.round(baseMrr * 0.3),
      Math.round(baseMrr * 0.9),
      5
    ),
    customers: seededRandom(20, 500, 7),
    monthlyRevenue,
  };
}
