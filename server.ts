import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to handle larger payloads (images)
  app.use(express.json({ limit: '50mb' }));

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // Endpoint to fetch external images and return as base64 to avoid canvas tainting/CORS
  app.post('/api/proxy-image', async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: 'Missing url' });
      }

      let validUrl: URL;
      try {
        validUrl = new URL(url);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid URL format' });
      }

      const response = await fetch(validUrl.toString());
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const mimeType = response.headers.get('content-type') || 'image/jpeg';
      
      const base64 = buffer.toString('base64');
      const dataUri = `data:${mimeType};base64,${base64}`;

      res.json({ dataUri });
    } catch (error: any) {
      console.error('Error proxying image:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch image' });
    }
  });

  // Endpoint to suggest a tight crop using Gemini Vision
  app.post('/api/suggest-crop', async (req, res) => {
    try {
      const { base64Data, mimeType } = req.body;
      if (!base64Data) {
        return res.status(400).json({ error: 'Missing base64Data' });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { text: "Analyze this image and identify the primary subject/object. Return the tightest possible bounding box that contains this subject. Do not include excessive background. Values MUST be floats between 0.0 and 1.0 representing percentages of the total image width and height." },
              { inlineData: { data: base64Data, mimeType: mimeType || 'image/jpeg' } }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              ymin: { type: Type.NUMBER, description: "Top edge (0.0 to 1.0)" },
              xmin: { type: Type.NUMBER, description: "Left edge (0.0 to 1.0)" },
              ymax: { type: Type.NUMBER, description: "Bottom edge (0.0 to 1.0)" },
              xmax: { type: Type.NUMBER, description: "Right edge (0.0 to 1.0)" }
            },
            required: ["ymin", "xmin", "ymax", "xmax"]
          }
        }
      });

      const jsonStr = response.text;
      if (!jsonStr) {
        throw new Error('Empty response from model');
      }

      const result = JSON.parse(jsonStr);
      res.json(result);
    } catch (error: any) {
      console.error('Error suggesting crop:', error);
      res.status(500).json({ error: error.message || 'Failed to suggest crop' });
    }
  });

  // Endpoint to remove background using remove.bg API
  app.post('/api/remove-bg', async (req, res) => {
    try {
      const { base64Data } = req.body;
      if (!base64Data) {
        return res.status(400).json({ error: 'Missing base64Data' });
      }

      const apiKey = process.env.REMOVE_BG_API_KEY;
      if (!apiKey) {
        throw new Error('REMOVE_BG_API_KEY is not configured in environment secrets. Please get a free API key from remove.bg and add it.');
      }

      const response = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          image_file_b64: base64Data,
          size: 'auto',
          format: 'png'
        })
      });

      if (!response.ok) {
        let errorMessage = `Remove.bg API failed (${response.status})`;
        try {
          const errorData = await response.json();
          if (errorData.errors && errorData.errors.length > 0) {
            errorMessage = errorData.errors[0].title || errorData.errors[0].detail || errorMessage;
          }
        } catch (e) {
          // Fallback if not json
        }
        console.error('Remove.bg API Error:', response.status, errorMessage);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (!data || !data.data || !data.data.result_b64) {
        throw new Error('Invalid response from remove.bg API');
      }

      const dataUri = `data:image/png;base64,${data.data.result_b64}`;
      res.json({ dataUri });
    } catch (error: any) {
      console.error('Error removing background:', error);
      res.status(500).json({ error: error.message || 'Failed to remove background' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
