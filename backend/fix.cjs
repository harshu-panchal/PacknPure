const fs = require('fs');

let data = fs.readFileSync('index.js', 'utf8');

// Find the first occurrence of // Connect to Database
const idx = data.indexOf('// Connect to Database and Start Server');

if (idx !== -1) {
  const cleanData = data.substring(0, idx) + `// Connect to Database and Start Server
const startServer = async () => {
  try {
    await connectDB();

    // Start background jobs after DB is connected
    startOrderAutoCancelJob();
    startSlaMonitorJob();
    startProcurementMonitorJob();

    // Start Server
    server.listen(PORT, "0.0.0.0", () => {
      console.log(\`
╔════════════════════════════════════════╗
║   Quick Commerce API Server Started    ║
╠════════════════════════════════════════╣
║ Environment: \${NODE_ENV.padEnd(28)} ║
║ Port: \${PORT.toString().padEnd(33)} ║
║ CORS Origin: \${FRONTEND_URL.substring(0, 25).padEnd(28)} ║
║ Socket.IO: Enabled                     ║
╚════════════════════════════════════════╝
      \`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
`;
  
  // also fix the error handler we accidentally deleted
  let finalData = cleanData.replace('// Setup Routes\nsetupRoutes(app);\n\n// Middleware\napp.use(cors(corsOptions));', `// Setup Routes
setupRoutes(app);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: true,
    message: 'Route not found'
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: true,
    message: NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message
  });
});\n`);

  fs.writeFileSync('index.js', finalData);
  console.log("Fixed index.js");
}
