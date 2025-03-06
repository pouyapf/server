require("dotenv").config();
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const fs = require("fs");
const path = require("path");

// Configure S3 Client for Liara
const s3 = new S3Client({
  region: "default",
  endpoint: process.env.LIARA_ENDPOINT,
  credentials: {
    accessKeyId: process.env.LIARA_ACCESS_KEY,
    secretAccessKey: process.env.LIARA_SECRET_KEY,
  },
});

// Upload Function
const uploadFile = async (file, folderName) => {
  const fileStream = fs.createReadStream(file.filepath); // Read file stream
  const randomName = `${Date.now()}-${path.basename(file.originalFilename)}`; // Unique name

  const params = {
    Bucket: process.env.LIARA_BUCKET_NAME,
    Key: `replyies/${folderName}/${randomName}`, // Upload to 'replyies' folder
    Body: fileStream,
    ContentType: "image/jpeg", // Adjust as needed
    ACL: "public-read", // Optional: make it public
  };

  await s3.send(new PutObjectCommand(params));

  // Return the uploaded file's URL
  return `https://${process.env.LIARA_BUCKET_NAME}.${new URL(process.env.LIARA_ENDPOINT).hostname}/replyies/${folderName}/${randomName}`;
};

module.exports = uploadFile;
