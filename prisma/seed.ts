import { PrismaClient, Role, OrgStatus, MatchStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Cricket Platform initial data...');

  // Default super admin password hash (SuperAdmin@123)
  const passwordHash = await bcrypt.hash('SuperAdmin@123', 10);
  const playerPasswordHash = await bcrypt.hash('Player@123', 10);

  // 1. Create or upsert Super Admin
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@crickethub.com' },
    update: {},
    create: {
      email: 'superadmin@crickethub.com',
      name: 'System Super Admin',
      passwordHash,
      role: Role.SUPER_ADMIN,
    },
  });
  console.log(`Created Super Admin: ${superAdmin.email}`);

  // 2. Create demo approved organizer
  const organizer = await prisma.organizer.create({
    data: {
      name: 'Apex Cricket League',
      contactEmail: 'contact@apexcricket.org',
      phone: '+91 9876543210',
      description: 'Premier regional tournament organization.',
      status: OrgStatus.APPROVED,
      reviewNote: 'Verified regional cricketing body.',
      reviewedById: superAdmin.id,
      users: {
        create: {
          email: 'admin@apexcricket.org',
          name: 'Apex Admin',
          passwordHash,
          role: Role.ADMIN,
        },
      },
    },
    include: { users: true },
  });
  console.log(`Created Organizer: ${organizer.name} with Admin: ${organizer.users[0].email}`);

  // 3. Create Scorer user under the organizer
  const scorer = await prisma.user.create({
    data: {
      email: 'scorer@apexcricket.org',
      name: 'Official Scorer',
      passwordHash,
      role: Role.SCORER,
      organizerId: organizer.id,
    },
  });
  console.log(`Created Scorer: ${scorer.email}`);

  // 4. Create demo Players
  const playerUsers = await Promise.all([
    prisma.user.create({
      data: {
        email: 'virat@crickethub.com',
        name: 'Virat Kohli',
        passwordHash: playerPasswordHash,
        role: Role.PLAYER,
        playerProfile: {
          create: {
            battingStyle: 'Right-hand bat',
            bowlingStyle: 'Right-arm medium',
            career: {
              create: {
                matches: 120,
                innings: 115,
                runs: 5412,
                ballsFaced: 3950,
                fours: 490,
                sixes: 142,
                highScore: 122,
                ballsBowled: 120,
                runsConceded: 160,
                wickets: 4,
              },
            },
          },
        },
      },
    }),
    prisma.user.create({
      data: {
        email: 'bumrah@crickethub.com',
        name: 'Jasprit Bumrah',
        passwordHash: playerPasswordHash,
        role: Role.PLAYER,
        playerProfile: {
          create: {
            battingStyle: 'Right-hand bat',
            bowlingStyle: 'Right-arm fast',
            career: {
              create: {
                matches: 98,
                innings: 32,
                runs: 210,
                ballsFaced: 280,
                fours: 14,
                sixes: 5,
                highScore: 28,
                ballsBowled: 2280, // 380 overs
                runsConceded: 2450,
                wickets: 154,
              },
            },
          },
        },
      },
    }),
  ]);
  console.log(`Created ${playerUsers.length} Demo Players`);

  // 5. Create demo Team
  const team = await prisma.team.create({
    data: {
      name: 'Royal Strikers',
      teamKey: 'ROYAL-STRIKE-2026',
      captainId: playerUsers[0].id,
      members: {
        create: [
          { playerId: playerUsers[0].id },
          { playerId: playerUsers[1].id },
        ],
      },
    },
  });
  console.log(`Created Team: ${team.name} with key: ${team.teamKey}`);

  // 6. Create demo Tournament
  const tournament = await prisma.tournament.create({
    data: {
      organizerId: organizer.id,
      name: 'All-India Champions Trophy 2026',
      location: 'Wankhede Stadium, Mumbai',
      startDate: new Date('2026-11-01'),
      endDate: new Date('2026-11-20'),
      format: 'T20',
      oversPerInnings: 20,
      status: 'UPCOMING',
      description: 'Official annual inter-club championship.',
    },
  });
  console.log(`Created Tournament: ${tournament.name}`);

  console.log('Database seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
