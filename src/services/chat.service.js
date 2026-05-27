// We use the "openai" npm package because Gemini exposes an OpenAI-compatible endpoint.
// Only the baseURL + API key change — all calls go to Google's Gemini servers.
import OpenAI from "openai";
import { HARSH_PERSONA } from "../data/persona.js";
import { Conversation } from "../models/Conversation.js";

let client = null;

function getClient() {
  if (client) return client;
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set in environment");
  }
  client = new OpenAI({
    apiKey: process.env.GEMINI_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  });
  return client;
}

export async function generateChatReply(messages) {
  const aiClient = getClient();
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";

  const completion = await aiClient.chat.completions.create({
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
