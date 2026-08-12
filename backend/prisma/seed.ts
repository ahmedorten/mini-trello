import { PrismaClient, CardPriority, ActivityAction } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seeding...');

  // 1. Clean existing data (in order of relations)
  await prisma.activity.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.checklistItem.deleteMany({});
  await prisma.checklist.deleteMany({});
  await prisma.attachment.deleteMany({});
  await prisma.cardLabel.deleteMany({});
  await prisma.label.deleteMany({});
  await prisma.card.deleteMany({});
  await prisma.column.deleteMany({});
  await prisma.board.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('Database cleaned.');

  // 2. Create User
  const passwordHash = await bcrypt.hash('password123', 10);
  const user = await prisma.user.create({
    data: {
      fullName: 'Test User',
      email: 'test@example.com',
      passwordHash,
    },
  });
  console.log(`Created user: ${user.email}`);

  // 3. Create Board
  const board = await prisma.board.create({
    data: {
      name: 'Mini Trello Workspace',
      description: 'A place to manage tasks, checklists, labels, and activities.',
      ownerId: user.id,
    },
  });
  console.log(`Created board: ${board.name}`);

  // 4. Create Columns
  const colTodo = await prisma.column.create({
    data: { boardId: board.id, name: 'To Do', position: 1 },
  });
  const colInProgress = await prisma.column.create({
    data: { boardId: board.id, name: 'In Progress', position: 2 },
  });
  const colDone = await prisma.column.create({
    data: { boardId: board.id, name: 'Done', position: 3 },
  });
  console.log('Created columns.');

  // 5. Create Labels
  const lblBug = await prisma.label.create({
    data: { boardId: board.id, name: 'Bug', color: '#ef4444' },
  });
  const lblFeature = await prisma.label.create({
    data: { boardId: board.id, name: 'Feature', color: '#4f46e5' },
  });
  const lblDoc = await prisma.label.create({
    data: { boardId: board.id, name: 'Docs', color: '#06b6d4' },
  });
  const lblReview = await prisma.label.create({
    data: { boardId: board.id, name: 'Review', color: '#f59e0b' },
  });
  console.log('Created labels.');

  // 6. Create Cards
  // Card 1: To Do
  const card1 = await prisma.card.create({
    data: {
      columnId: colTodo.id,
      title: 'Implement Dark Mode Toggle',
      description: 'Users should be able to toggle dark mode in the main sidebar settings panel.',
      position: 1,
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
      priority: CardPriority.MEDIUM,
    },
  });

  // Card 2: In Progress
  const card2 = await prisma.card.create({
    data: {
      columnId: colInProgress.id,
      title: 'Refactor State Management Composables',
      description: 'Extract store synchronization logic to improve reactivity performance and reduce component bundle sizes.',
      position: 1,
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      priority: CardPriority.HIGH,
    },
  });

  // Card 3: Done
  const card3 = await prisma.card.create({
    data: {
      columnId: colDone.id,
      title: 'Initial Project Setup & Routing',
      description: 'Configured Vite, TailwindCSS, VeeValidate, Zod, and Pinia stores.',
      position: 1,
      dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      priority: CardPriority.LOW,
    },
  });
  console.log('Created cards.');

  // 7. Attach Card Labels
  await prisma.cardLabel.create({
    data: { cardId: card1.id, labelId: lblFeature.id },
  });
  await prisma.cardLabel.create({
    data: { cardId: card2.id, labelId: lblBug.id },
  });
  await prisma.cardLabel.create({
    data: { cardId: card2.id, labelId: lblReview.id },
  });
  await prisma.cardLabel.create({
    data: { cardId: card3.id, labelId: lblDoc.id },
  });
  console.log('Attached labels to cards.');

  // 8. Create Checklists
  const checklist = await prisma.checklist.create({
    data: {
      cardId: card2.id,
      title: 'Implementation Subtasks',
    },
  });

  await prisma.checklistItem.createMany({
    data: [
      { checklistId: checklist.id, title: 'Define useCardContext composable', isCompleted: true, position: 1 },
      { checklistId: checklist.id, title: 'Setup CardRefreshService orchestration', isCompleted: true, position: 2 },
      { checklistId: checklist.id, title: 'Integrate ActivityMapper translations', isCompleted: false, position: 3 },
      { checklistId: checklist.id, title: 'Test upload cancellations', isCompleted: false, position: 4 },
    ],
  });
  console.log('Created checklists and items.');

  // 9. Create Comments
  await prisma.comment.createMany({
    data: [
      {
        cardId: card2.id,
        content: 'This refactoring aligns with clean architecture rules and resolves memory leak warnings.',
        createdBy: user.id,
      },
      {
        cardId: card2.id,
        content: 'Let me know when the file upload cancellation tests are passing.',
        createdBy: user.id,
      },
    ],
  });
  console.log('Created comments.');

  // 10. Log Activity Logs
  await prisma.activity.createMany({
    data: [
      {
        cardId: card2.id,
        action: ActivityAction.CARD_CREATED,
        createdBy: user.id,
        details: { title: card2.title },
      },
      {
        cardId: card2.id,
        action: ActivityAction.LABEL_ATTACHED,
        createdBy: user.id,
        details: { name: 'Bug', color: '#ef4444' },
      },
      {
        cardId: card2.id,
        action: ActivityAction.CHECKLIST_CREATED,
        createdBy: user.id,
        details: { title: 'Implementation Subtasks' },
      },
    ],
  });
  console.log('Seeded activity timeline logs.');

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
