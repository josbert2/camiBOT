import { prisma } from '../src/index.js';

async function main() {
  console.log('Seeding database...');
  // TODO: seed dev data en Fase 1
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
