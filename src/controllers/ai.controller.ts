import { FastifyRequest, FastifyReply } from "fastify";
import fs from "fs";
import FormData from "form-data";
import axios from "axios";
import { prisma } from "../config/prisma";
import jwtUserPayload from "../types/jwt.types";
import { summarizeUserMemory } from "../services/summarizer";
import { getAIChatHistoryQueryParams } from "../types/aiChatHistory";

const getAIResponseText = async (req: FastifyRequest, res: FastifyReply) => {
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

    console.log("history", history);
    console.log("Memory Summary:", summary);

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
        message_since_last_summary: { increment: 2 },
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

// this controller is to allow the user to send voices to the ai instead of text and recieving the answe as text
async function getAIResponseVoice(req: FastifyRequest, res: FastifyReply) {
  try {
    const user_id = (req.user as jwtUserPayload).id;

    if (!user_id) {
      return res.status(401).send({ error: "Unauthorized" });
    }

    // 1. get uploaded file
    const data = await req.file();

    if (!data) {
      return res.status(400).send({ error: "No audio file provided" });
    }

    const dir = "./tmp";

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    // 2. save file temporarily
    const filePath = `./tmp/${Date.now()}-${data.filename}`;
    await fs.promises.writeFile(filePath, await data.toBuffer());

    // 3. get DB history (same logic as text chat)
    const history = await prisma.chat_messages.findMany({
      where: { user_id },
      orderBy: { created_at: "desc" },
      take: 5,
    });

    const summaryData = await prisma.users.findUnique({
      where: { id: user_id },
      select: { memory_summary: true },
    });

    const summary = summaryData?.memory_summary || "";

    // 4. send everything to FastAPI voice endpoint
    const form = new FormData();

    form.append("audio", fs.createReadStream(filePath));
    form.append("user_id", user_id);
    form.append("summary", summary);
    form.append("history", JSON.stringify(history.reverse()));

    const response = await axios.post(
      `${process.env.AI_SERVICE_URL}/api/voice-chat`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          "X-INTERNAL-API-KEY": process.env.INTERNAL_API_KEY!,
        },
      },
    );

    // 5. cleanup file
    await fs.promises.unlink(filePath);

    // 6. save chat messages (same as text flow)
    const transcription = response.data.question;
    const answer = response.data.answer;

    await prisma.chat_messages.create({
      data: {
        user_id,
        role: "user",
        content: transcription,
      },
    });

    await prisma.chat_messages.create({
      data: {
        user_id,
        role: "assistant",
        content: answer,
      },
    });

    return res.send({
      transcription,
      answer,
    });
  } catch (err: any) {
    return res.status(500).send({
      error: err.message || "Voice chat failed",
    });
  }
}

// this is the controller to get the history of ai chats from the database related to one person.
async function getChatHistory(
  req: FastifyRequest<{ Querystring: getAIChatHistoryQueryParams }>,
  res: FastifyReply,
) {
  try {
    const user_id = (req.user as jwtUserPayload).id;

    if (!user_id) {
      return res.status(401).send({ error: "Unauthorized" });
    }

    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const offset = (page - 1) * limit;

    const history = await prisma.chat_messages.findMany({
      where: { user_id },
      orderBy: { created_at: "asc" },
      skip: offset,
      take: limit,
    });

    res.send({ history });
  } catch (error: any) {
    res.status(500).send({
      message:
        error.message || "Some error occurred while retrieving chat history.",
    });
  }
}

export { getAIResponseText, getAIResponseVoice, getChatHistory };
