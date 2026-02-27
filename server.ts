import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // District data for Bangladesh
  const districts = [
    { id: 1, name: "Dhaka", bn: "ঢাকা", lat: 23.8103, lon: 90.4125 },
    { id: 2, name: "Chattogram", bn: "চট্টগ্রাম", lat: 22.3569, lon: 91.7832 },
    { id: 3, name: "Sylhet", bn: "সিলেট", lat: 24.8949, lon: 91.8687 },
    { id: 4, name: "Rajshahi", bn: "রাজশাহী", lat: 24.3745, lon: 88.6042 },
    { id: 5, name: "Khulna", bn: "খুলনা", lat: 22.8456, lon: 89.5403 },
    { id: 6, name: "Barishal", bn: "বরিশাল", lat: 22.7010, lon: 90.3535 },
    { id: 7, name: "Rangpur", bn: "রংপুর", lat: 25.7439, lon: 89.2752 },
    { id: 8, name: "Mymensingh", bn: "ময়মনসিংহ", lat: 24.7471, lon: 90.4203 },
    // Simplified for brevity, but I'll add more or a way to get them
    { id: 9, name: "Gazipur", bn: "গাজীপুর", lat: 23.9999, lon: 90.4203 },
    { id: 10, name: "Narayanganj", bn: "নারায়ণগঞ্জ", lat: 23.6238, lon: 90.5000 },
    // ... more can be added or fetched from a file
  ];

  app.use(express.json());

  // API routes
  app.get("/api/districts", (req, res) => {
    res.json(districts);
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
