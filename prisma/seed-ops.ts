/**
 * UniKart Ops — idempotent seed for feature flags + system settings.
 *
 * Safe to run against any environment (only upserts the known Ops config rows;
 * never deletes user data). Run with:  npx tsx prisma/seed-ops.ts
 */
import { PrismaClient } from "../src/generated/prisma";
import { FLAG_SEEDS, SETTING_SEEDS } from "../src/lib/ops/seed-data";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding UniKart Ops feature flags + system settings…");

  for (const f of FLAG_SEEDS) {
    await prisma.featureFlag.upsert({
      where: { key: f.key },
      // Only set name/description on create so manual edits to enabled/rollout
      // aren't clobbered on re-run; refresh copy fields each run.
      update: { name: f.name, description: f.description },
      create: {
        key: f.key,
        name: f.name,
        description: f.description,
        enabled: f.enabled,
      },
    });
  }
  console.log(`  ✓ ${FLAG_SEEDS.length} feature flags`);

  for (const s of SETTING_SEEDS) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: { description: s.description, category: s.category },
      create: {
        key: s.key,
        category: s.category,
        description: s.description,
        valueJson: JSON.stringify(s.value),
      },
    });
  }
  console.log(`  ✓ ${SETTING_SEEDS.length} system settings`);
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
