import { prisma } from "../config/prisma";

// this service is used to update the memory summary of the user in the database
// this will be eventbased that will be triggered once the user have a conversation with the ai and the conversation reach a certain limit
async function summarizeUserMemory(user_id: string) {
  const user = await prisma.users.findUnique({
    where: { id: user_id },
    select: { message_since_last_summary: true },
  });

  const count = user?.message_since_last_summary || 0;

  console.log("message_since_last_summary", count);

  if (count < parseInt(process.env.CONVERSATION_SUMMARY_TRIGGER || "10")) {
    return;
  }

  const messages = await prisma.chat_messages.findMany({
    where: { user_id },
    orderBy: { created_at: "asc" },
    take: count,
  });

  const response = await fetch(
    process.env.AI_SERVICE_URL + "/api/summarize-memory",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages }),
    },
  );

  if (!response.ok) {
    console.error("Failed to summarize memory:", await response.text());
    return;
  }

  const data = await response.json();

  await prisma.users.update({
    where: { id: user_id },
    data: {
      memory_summary: data.summary,
      message_since_last_summary: 0,
    },
  });
}

export { summarizeUserMemory };
