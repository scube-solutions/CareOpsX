const fs = require('fs');
const path = require('path');
require('dotenv').config();

const provider = process.env.STORAGE_PROVIDER || 'minio';

let s3Client = null;

if (provider === 's3' || provider === 'minio') {
  const { S3Client } = require('@aws-sdk/client-s3');
  
  const config = {
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'minioadmin',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'minioadmin',
    }
  };
  
  if (provider === 'minio') {
    config.endpoint = process.env.MINIO_ENDPOINT || 'http://localhost:9000';
    config.forcePathStyle = true; // MinIO compatibility
  }
  
  s3Client = new S3Client(config);
}

const storage = {
  /**
   * Upload file buffer to MinIO/S3 or local fallback
   */
  upload: async (bucketName, filePath, buffer, contentType) => {
    if (provider === 'local') {
      const localDir = path.join(__dirname, '../../public/uploads', bucketName);
      const fullPath = path.join(localDir, filePath);
      
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, buffer);
      
      const host = process.env.BACKEND_URL || 'http://localhost:5001';
      return `${host}/uploads/${bucketName}/${filePath}`;
    } else {
      const { PutObjectCommand } = require('@aws-sdk/client-s3');
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: filePath,
        Body: buffer,
        ContentType: contentType || 'application/octet-stream'
      });
      await s3Client.send(command);
      
      if (provider === 'minio') {
        const endpoint = process.env.MINIO_ENDPOINT || 'http://localhost:9000';
        return `${endpoint}/${bucketName}/${filePath}`;
      } else {
        return `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${filePath}`;
      }
    }
  },

  /**
   * Resolve public read URL of a file path
   */
  getPublicUrl: async (bucketName, filePath) => {
    if (provider === 'local') {
      const host = process.env.BACKEND_URL || 'http://localhost:5001';
      return `${host}/uploads/${bucketName}/${filePath}`;
    } else if (provider === 'minio') {
      const endpoint = process.env.MINIO_ENDPOINT || 'http://localhost:9000';
      return `${endpoint}/${bucketName}/${filePath}`;
    } else {
      return `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${filePath}`;
    }
  }
};

module.exports = storage;
