import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ["user", "assistant"],
    required: true,
  },
  content: {
    type: String,
    required: true,
    maxlength: 4000,
  },
  tokens: {
    prompt: { type: Number },
    completion: { type: Number },
    total: { type: Number },
  },
  model: { type: String },
  createdAt: { type: Date, default: Date.now },
});

const resumeUploadSchema = new mongoose.Schema({
  s3Key: { type: String, required: true },
  originalName: { type: String, required: true },
  size: { type: Number, required: true },
  mimeType: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
});

const conversationSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
      maxlength: 100,
    },
    messages: {
      type: [messageSchema],
      default: [],
    },
    visitor: {
      ip: { type: String },
      userAgent: { type: String },
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    resumeUploads: {
      type: [resumeUploadSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: "conversations",
  }
);

export const Conversation = mongoose.model("Conversation", conversationSchema);
