import "dotenv/config";
import { createPresignedDownloadUrl } from "../src/utils/signedUrl.js";

async function main() {
  const s3Key = process.argv[2];

  if (!s3Key) {
    console.error("Usage:");
    console.error("  node scripts/test-presigned-url.js <s3-key>");
    console.error("");
    console.error("Example:");
    console.error("  node scripts/test-presigned-url.js resumes/test-session-001/1779765563956-test-resume.pdf");
    process.exit(1);
  }

  const url = await createPresignedDownloadUrl(s3Key);

  console.log("[presigned-url] generated for key:", s3Key);
  console.log("[presigned-url] expires in 7 days");
  console.log("");
  console.log("URL (copy and paste into a browser):");
  console.log(url);
}

main().catch((err) => {
  console.error("[presigned-url] crashed:", err);
  process.exit(1);
});
