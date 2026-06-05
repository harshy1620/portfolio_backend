import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getS3Client, getBucketName } from "../config/s3.js";

const SEVEN_DAYS_IN_SECONDS = 7 * 24 * 60 * 60;

export async function createPresignedDownloadUrl(s3Key, expiresInSeconds = SEVEN_DAYS_IN_SECONDS) {
  const s3 = getS3Client();
  const bucket = getBucketName();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: s3Key,
  });

  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}
