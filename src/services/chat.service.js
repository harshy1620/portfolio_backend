import OpenAI from "openai";
import { HARSH_PERSONA } from "../data/persona.js";
import { Conversation } from "../models/Conversation.js";

let client = null;

function getClient() {
  if (client) return client;
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set in environment");
  }
  client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export async function generateChatReply(messages) {
  const openai = getClient();
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: HARSH_PERSONA },
      ...messages,
    ],
    temperature: 0.7,
    max_tokens: 500,
  });

  const reply = completion.choices[0]?.message?.content?.trim() ?? "";
  const usage = completion.usage;

  return { reply, usage, model };
}

export async function handleChat({ sessionId, messages, visitor }) {
  const lastUserMessage = messages[messages.length - 1];

  let conversation = await Conversation.findOne({ sessionId });
  if (!conversation) {
    conversation = new Conversation({ sessionId, visitor });
  }

  const { reply, usage, model } = await generateChatReply(messages);

  conversation.messages.push(
    {
      role: "user",
      content: lastUserMessage.content,
    },
    {
      role: "assistant",
      content: reply,
      tokens: {
        prompt: usage?.prompt_tokens,
        completion: usage?.completion_tokens,
        total: usage?.total_tokens,
      },
      model,
    }
  );
  conversation.lastMessageAt = new Date();
  await conversation.save();

  return { reply, usage, model, conversationId: conversation._id };
}
