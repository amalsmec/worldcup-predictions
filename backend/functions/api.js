import serverless from 'serverless-http';
import { connectLambda } from '@netlify/blobs';
import app from '../server.js';

// Wrap the main Express app
const serverlessHandler = serverless(app);

export const handler = async (event, context) => {
  // Connect Netlify Blobs with lambda context credentials
  connectLambda(event, context);
  return await serverlessHandler(event, context);
};
