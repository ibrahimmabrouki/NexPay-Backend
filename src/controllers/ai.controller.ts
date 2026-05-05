import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../config/prisma";
import jwtUserPayload from "../types/jwt.types";
import { summarizeUserMemory } from "../services/summarizer";

const getAIResponse = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const user_id = (req.user as jwtUserPayload).id;

    if (!user_id) {
      return res.status(401).send({ error: "Unauthorized" });
    }

    // getting the latest 5 messages to allow the user experience a follow up conversation with the AI
    // also to make the ai understand the context of the conversation and give better answers
    const history = await prisma.chat_messages.findMany({
      where: { user_id },
      orderBy: { created_at: "desc" },
      take: 5,
    });

    // getting the summary of the conversation to allow the ai to have a better understanding of the user and give better answers and also to allow the user to have a long converstation with the ai without losing the context.
    const summaryData = await prisma.users.findUnique({
      where: { id: user_id },
      select: { memory_summary: true },
    });

    const summary = summaryData?.memory_summary || "";

    const { question } = req.body as { question: string };

    const response = await fetch(process.env.AI_SERVICE_URL + "/api/chat-AI", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-INTERNAL-API-KEY": process.env.INTERNAL_API_KEY!,
      },
      body: JSON.stringify({
        user_id,
        question,
        history: history.reverse(),
        summary,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res
        .status(response.status)
        .send({ error: data.error || "AI service error" });
    }

    // now after recieving the answer from the ai service we will save the question and the ansewe in the database to allow the user have follow up conversations with the ai
    await prisma.chat_messages.create({
      data: {
        user_id,
        role: "user",
        content: question,
      },
    });
    await prisma.chat_messages.create({
      data: {
        user_id,
        role: "assistant",
        content: data.answer,
      },
    });

    // after saving the message in the database we need to update the message_since_last_summary field of the user in the database to keep track of how many messages the user have sent since the last summary and to trigger the summarization process once the user reach a certain limit of messages
    await prisma.users.update({
      where: { id: user_id },
      data: {
        message_since_last_summary: { increment: 1 },
      },
    });

    // we will trigger the summarization process in the background without waiting for it to finish to allow the user have a better experience and not to make them wait for a long time before recieving the answer from the ai
    summarizeUserMemory(user_id);

    res.send({ answer: data.answer });
  } catch (error: any) {
    res.status(500).send({
      message:
        error.message || "Some error occurred while retrieving AI response.",
    });
  }
};

export { getAIResponse };
