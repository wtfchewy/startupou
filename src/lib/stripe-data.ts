import Stripe from "stripe";
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  format,
  eachMonthOfInterval,
} from "date-fns";
import { StartupConfig } from "./startups";

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

async function getMRR(stripe: Stripe): Promise<number> {
  let mrr = 0;
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
        mrr += monthly;
      }
    }

    hasMore = subscriptions.has_more;
    if (subscriptions.data.length > 0) {
      startingAfter = subscriptions.data[subscriptions.data.length - 1].id;
    }
  }

  return mrr / 100; // convert cents to dollars
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

  // Fetch current MRR and customer count
  const [mrr, customers] = await Promise.all([
    getMRR(stripe),
    getCustomerCount(stripe),
  ]);

  // Fetch revenue this month (actual charges, not MRR)
  const revenueThisMonth = await getChargesForPeriod(
    stripe,
    monthStart,
    monthEnd
  );

  // Fetch last 6 months of revenue for the chart
  const months = eachMonthOfInterval({
    start: subMonths(now, 5),
    end: now,
  });

  const monthlyRevenue: MonthlyRevenue[] = await Promise.all(
    months.map(async (month) => {
      const start = startOfMonth(month);
      const end = endOfMonth(month);
      const revenue = await getChargesForPeriod(stripe, start, end);
      return {
        month: format(month, "MMM"),
        revenue: Math.round(revenue),
      };
    })
  );

  // Calculate previous month MRR for growth rate
  const prevMonthCharges = monthlyRevenue[monthlyRevenue.length - 2]?.revenue || 0;
  const currentMonthCharges = monthlyRevenue[monthlyRevenue.length - 1]?.revenue || 0;
  const growthRate =
    prevMonthCharges > 0
      ? ((currentMonthCharges - prevMonthCharges) / prevMonthCharges) * 100
      : 0;

  return {
    name: config.name,
    description: config.description,
    domain: config.domain,
    logo: config.logo,
    founded: config.founded,
    mrr: Math.round(mrr),
    previousMrr: Math.round(prevMonthCharges),
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
