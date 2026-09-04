const dotenv = require('dotenv');
dotenv.config();

const app = require('./src/index');
const connectDB = require('./src/db/database');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    const server = app.listen(PORT, () => {
      console.log(`========================================`);
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`🔑 Auth Register API: POST http://localhost:${PORT}/api/auth/register`);
      console.log(`🔑 Auth Login API:    POST http://localhost:${PORT}/api/auth/login`);
      console.log(`🔒 Protected Me API:  GET  http://localhost:${PORT}/api/auth/me`);
      console.log(`📝 Posts API:          POST http://localhost:${PORT}/api/posts/create-post`);
      console.log(`🖥️  Web UI page:       http://localhost:${PORT}/`);
      console.log(`========================================`);
    });

    process.on('unhandledRejection', (err) => {
      console.error(`Unhandled Rejection Error: ${err.message}`);
      server.close(() => process.exit(1));
    });
  } catch (error) {
    console.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

startServer();
