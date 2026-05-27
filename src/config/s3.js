import { S3Client } from "@aws-sdk/client-s3";

let client = null;

export function getS3Client() {
  if (client) return client;

  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY must all be set in environment"
    );
  }

  client = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });

  return client;
}

export function getBucketName() {
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) {
    throw new Error("AWS_S3_BUCKET is not set in environment");
  }
  return bucket;
}
