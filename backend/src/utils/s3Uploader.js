const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');

// Initialize the S3 client using environment variables
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME;

/**
 * Uploads a file buffer to S3.
 * @param {Buffer} fileBuffer - The file content.
 * @param {string} paymentID - The payment ID, used as the base for the filename.
 * @param {string} mimetype - The mimetype of the file (e.g., 'image/png').
 * @returns {Promise<string>} The URL of the uploaded object.
 */
async function uploadReceipt(fileBuffer, paymentID, mimetype) {
  if (!BUCKET_NAME || !process.env.AWS_REGION) {
    console.warn('S3 config not found in environment variables. Skipping upload.');
    return null;
  }

  const extension = mimetype.split('/')[1] || 'bin';
  const key = `${paymentID}.${extension}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: fileBuffer,
    ContentType: mimetype,
  });

  try {
    await s3Client.send(command);
    const url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    console.log(`Successfully uploaded ${key} to S3.`);
    return url;
  } catch (err) {
    console.error(`S3 upload failed for paymentID ${paymentID}:`, err);
    // Do not throw; failing to upload a receipt shouldn't break the main flow.
    return null;
  }
}

module.exports = { uploadReceipt };