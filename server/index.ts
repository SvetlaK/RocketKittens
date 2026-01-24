import { spawn } from "child_process";

console.log("Starting Python server...");

const pythonProcess = spawn("python", ["app.py"], {
  stdio: "inherit",
  cwd: process.cwd()
});

pythonProcess.on("error", (err) => {
  console.error("Failed to start Python server:", err);
  process.exit(1);
});

pythonProcess.on("exit", (code) => {
  console.log(`Python server exited with code ${code}`);
  process.exit(code || 0);
});
