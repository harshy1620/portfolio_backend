import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client, getBucketName } from "../config/s3.js";
import { Conversation } from "../models/Conversation.js";

function sanitizeFilename(name) {
  return name
    .replace(/[/\\?%*:|"<>\x00-\x1f]/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 100);
}

function buildS3Key(sessionId, originalName) {
  const timestamp = Date.now();
  const safeName = sanitizeFilename(originalName);
  return `resumes/${sessionId}/${timestamp}-${safeName}`;
}

export async function uploadResumeToS3({ sessionId, file }) {
  const s3 = getS3Client();
  console.log(s3,"s3---")
  const bucket = getBucketName();
  console.log(bucket,"bucket---")
  const key = buildS3Key(sessionId, file.originalname);
  console.log(key,"key---")

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    })
  );

  return {
    s3Key: key,
    originalName: file.originalname,
    size: file.size,
    mimeType: file.mimetype,
  };
}

export async function attachResumeToConversation(sessionId, uploadInfo) {
  console.log("Attaching resume to conversation", { sessionId, uploadInfo });
  let conversation = await Conversation.findOne({ sessionId });
  if (!conversation) {
    conversation = new Conversation({ sessionId });
  }
  conversation.resumeUploads.push(uploadInfo);
  await conversation.save();
  return conversation;
}
