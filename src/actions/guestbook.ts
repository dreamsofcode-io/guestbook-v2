'use server';

import { db } from '@/db';
import { guestbook, user } from '@/db/schema';
import { auth } from '@/lib/auth';
import { validateMessageContent } from '@/lib/content-validation';
import { headers } from 'next/headers';
import { desc, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function getGuestbookEntries(page = 1, limit = 50) {
  const offset = (page - 1) * limit;

  const creatorUsername = process.env.CREATOR_USERNAME?.toLowerCase();
  
  // Get ALL entries (both main messages and replies) in chronological order
  const entries = await db
    .select({
      id: guestbook.id,
      message: guestbook.message,
      createdAt: guestbook.createdAt,
      username: user.username,
      displayUsername: user.displayUsername,
      name: user.name,
      userId: guestbook.userId,
      replyToId: guestbook.replyToId,
    })
    .from(guestbook)
    .leftJoin(user, eq(guestbook.userId, user.id))
    .orderBy(desc(guestbook.createdAt))
    .limit(limit)
    .offset(offset);


  // For replies, we need to get the original message info
  const entriesWithReplyInfo = await Promise.all(
    entries.map(async (entry) => {
      if (entry.replyToId) {
        // This is a reply, get the original message info
        const originalMessage = await db
          .select({
            id: guestbook.id,
            message: guestbook.message,
            username: user.username,
            displayUsername: user.displayUsername,
            name: user.name,
          })
          .from(guestbook)
          .leftJoin(user, eq(guestbook.userId, user.id))
          .where(eq(guestbook.id, entry.replyToId))
          .limit(1);

        return {
          ...entry,
          replyToMessage: originalMessage[0]?.message,
          replyToUsername: originalMessage[0]?.displayUsername || originalMessage[0]?.username || originalMessage[0]?.name,
        };
      }
      return entry;
    })
  );

  const entriesWithCreator = entriesWithReplyInfo.map(entry => {
    const entryUsername = (entry.displayUsername || entry.username || entry.name)?.toLowerCase();
    return {
      ...entry,
      isCreator: !!creatorUsername && entryUsername === creatorUsername,
    };
  });

  // Get total count for pagination (all entries)
  const totalCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(guestbook);

  return {
    entries: entriesWithCreator,
    pagination: {
      page,
      limit,
      total: totalCount[0].count,
      totalPages: Math.ceil(totalCount[0].count / limit),
      hasNext: page < Math.ceil(totalCount[0].count / limit),
      hasPrev: page > 1,
    }
  };
}

export async function getUserPosts(userId: string, page = 1, limit = 50) {
  const offset = (page - 1) * limit;

  const creatorUsername = process.env.CREATOR_USERNAME?.toLowerCase();
  
  const entries = await db
    .select({
      id: guestbook.id,
      message: guestbook.message,
      createdAt: guestbook.createdAt,
      username: user.username,
      displayUsername: user.displayUsername,
      name: user.name,
      userId: guestbook.userId,
    })
    .from(guestbook)
    .leftJoin(user, eq(guestbook.userId, user.id))
    .where(eq(guestbook.userId, userId))
    .orderBy(desc(guestbook.createdAt))
    .limit(limit)
    .offset(offset);

  const entriesWithCreator = entries.map(entry => {
    const entryUsername = (entry.displayUsername || entry.username || entry.name)?.toLowerCase();
    return {
      ...entry,
      isCreator: !!creatorUsername && entryUsername === creatorUsername,
    };
  });

  // Get total count for this user
  const totalCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(guestbook)
    .where(eq(guestbook.userId, userId));

  return {
    entries: entriesWithCreator,
    pagination: {
      page,
      limit,
      total: totalCount[0].count,
      totalPages: Math.ceil(totalCount[0].count / limit),
      hasNext: page < Math.ceil(totalCount[0].count / limit),
      hasPrev: page > 1,
    }
  };
}

export async function createGuestbookEntry(message: string, replyToId?: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error('You must be signed in to post a message');
  }

  const maxLength = replyToId ? 1000 : 200;
  const validation = validateMessageContent(message, {
    allowLinks: false,
    allowProfanity: false,
    maxLength,
    minLength: 1,
  });

  if (!validation.isValid) {
    throw new Error(validation.errors.join(', '));
  }

  await db.insert(guestbook).values({
    message: validation.sanitizedContent!,
    userId: session.user.id,
    replyToId: replyToId || null,
  });

  revalidatePath('/');
}