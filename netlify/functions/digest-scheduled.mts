// Netlify Scheduled Function: send due notification email digests, hourly.
//
// It does NO database work itself (esbuild can't bundle Prisma — same reason as
// price-check-scheduled). It just calls the CRON-gated Next route, which does
// the Prisma + Resend work, looping until a run reports fewer than a full batch
// so the hour's backlog drains within the 15-min budget. Runs every hour
// because each user's send time is local to THEIR timezone, so any given hour
// only a slice of users come due.

const BATCH = 10;
const MAX_ITERATIONS = 30; // backstop: at most 300 digests/hour

export default async (): Promise<Response> => {
  const secret = process.env.CRON_SECRET;
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL;
  if (!secret || !base) {
    console.error("[digest-scheduled] missing CRON_SECRET or URL");
    return new Response("not configured");
  }

  const headers = {
    Authorization: `Bearer ${secret}`,
    "content-type": "application/json",
  };

  let total = 0;
  try {
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const res = await fetch(`${base}/api/notifications/digest/run`, {
        method: "POST",
        headers,
        body: JSON.stringify({ batch: BATCH }),
      });
      if (!res.ok) {
        console.error(`[digest-scheduled] run ${res.status}`);
        break;
      }
      const data = (await res.json()) as {
        result?: { processed?: number; sent?: number };
      };
      const sent = data.result?.sent ?? 0;
      total += sent;
      // Stop once a call makes no forward progress: either everyone due is
      // drained, or the remaining ones are failing (they'll retry next tick).
      // Successful users are marked and drop out, so this always terminates.
      if (sent === 0) break;
    }
  } catch (e) {
    console.error("[digest-scheduled]", e);
  }

  return new Response(`ok: sent ${total}`);
};

// Top of every hour (modern Netlify scheduled-function config).
export const config = { schedule: "0 * * * *" };
