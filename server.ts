import express from 'express';
import path from 'path';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, orderBy, limit, query, serverTimestamp, getDocFromServer, doc } from 'firebase/firestore';
import { createServer as createViteServer } from 'vite';

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Increase body limit to handle large base64 screenshot uploads
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Load Firebase configuration
const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
let firebaseConfig: any;
try {
  firebaseConfig = JSON.parse(readFileSync(firebaseConfigPath, 'utf-8'));
} catch (err) {
  console.error('Failed to load firebase-applet-config.json:', err);
  process.exit(1);
}

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

// Validate Firestore connection on boot
async function testFirebaseConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('Firebase connection validated successfully.');
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Firebase connection error: The client is offline or config is invalid.');
    } else {
      console.log('Firebase connection preheat complete.');
    }
  }
}
testFirebaseConnection();

// Initialize Google Gen AI client
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('WARNING: GEMINI_API_KEY environment variable is not set. Please set it in Settings > Secrets.');
}

const ai = new GoogleGenAI({
  apiKey: apiKey || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// 1. GET /api/reviews - returns up to 20 latest reviews
app.get('/api/reviews', async (req, res) => {
  try {
    const reviewsRef = collection(db, 'reviews');
    const q = query(reviewsRef, orderBy('createdAt', 'desc'), limit(20));
    const querySnapshot = await getDocs(q);
    
    const list: any[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      list.push({
        id: docSnap.id,
        type: data.type,
        inputData: data.inputData,
        reviewText: data.reviewText,
        createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
      });
    });
    
    res.json(list);
  } catch (err: any) {
    console.error('Failed to fetch historical reviews:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch reviews' });
  }
});

// 2. POST /api/review - processes a code review Snap
app.post('/api/review', async (req, res) => {
  try {
    const { type, data } = req.body;
    
    if (!type || !data) {
      return res.status(400).json({ error: 'Missing type or data' });
    }
    
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'GEMINI_API_KEY is missing. Please add it via the Secrets panel in Settings.' 
      });
    }

    let contents: any;
    let reviewSourceText = data;

    if (type === 'text') {
      contents = data;
    } else if (type === 'link') {
      try {
        const fetchRes = await fetch(data);
        if (!fetchRes.ok) {
          throw new Error(`Failed with status ${fetchRes.status}: ${fetchRes.statusText}`);
        }
        const extractedText = await fetchRes.text();
        // Limit raw HTML / text length to 100kb to stay compact
        reviewSourceText = extractedText.substring(0, 100000);
        
        contents = `Review the following extracted website script/source code link (${data}):\n\n${reviewSourceText}`;
      } catch (err: any) {
        console.error(`Error fetching URL: ${data}`, err);
        return res.status(400).json({ error: `Could not fetch or read code from URL: ${err.message}` });
      }
    } else if (type === 'image') {
      let mimeType = 'image/png';
      let base64Data = data;
      
      if (data.startsWith('data:')) {
        const parts = data.split(',');
        const meta = parts[0];
        base64Data = parts[1];
        const mimeMatch = meta.match(/data:([^;]+);/);
        if (mimeMatch) {
          mimeType = mimeMatch[1];
        }
      }
      
      contents = [
        {
          inlineData: {
            mimeType,
            data: base64Data,
          },
        },
        {
          text: 'Analyze this image featuring computer code or a programming language workspace screenshot.',
        },
      ];
    } else {
      return res.status(400).json({ error: `Invalid review type "${type}" specified.` });
    }

    // Determine the model dynamically and strip unnecessary "models/" prefix if present
    let model = (process.env.GEMINI_MODEL || '').trim() || 'gemini-3.5-flash';
    if (model.startsWith('models/')) {
      model = model.substring('models/'.length);
    }

    let reviewsResponseText = '';

    // Call Gemini API with automatic fallback in case of unexpected model format/support errors
    try {
      console.log(`Attempting Gemini analysis with model: "${model}" (Source GEMINI_MODEL: "${process.env.GEMINI_MODEL}")`);
      const response = await ai.models.generateContent({
        model: model,
        contents: contents,
        config: {
          systemInstruction: "You are an elite code reviewer. Analyze the input and return clean Markdown structured into three exact headers: '🚨 CRITICAL BUGS', '⚡ PERFORMANCE', and '🔒 CLEAN CODE'. Provide detailed but developer-friendly comments under each header. Include code snippets detailing fixes or optimizations if applicable.",
          temperature: 0.1,
        },
      });
      reviewsResponseText = response.text || 'Failed to generate review. Please retry.';
    } catch (primaryError: any) {
      console.error(`Primary request failed with model "${model}":`, primaryError);
      
      // Attempt known fallback models in sequence to ensure high availability
      const fallbacks = ['gemini-3.5-flash', 'gemini-3.1-pro-preview'];
      let succeeded = false;

      for (const fallbackModel of fallbacks) {
        if (fallbackModel === model) continue; // Skip since we just tried it

        try {
          console.log(`Retrying Gemini analysis using fallback model: "${fallbackModel}"`);
          const response = await ai.models.generateContent({
            model: fallbackModel,
            contents: contents,
            config: {
              systemInstruction: "You are an elite code reviewer. Analyze the input and return clean Markdown structured into three exact headers: '🚨 CRITICAL BUGS', '⚡ PERFORMANCE', and '🔒 CLEAN CODE'. Provide detailed but developer-friendly comments under each header. Include code snippets detailing fixes or optimizations if applicable.",
              temperature: 0.1,
            },
          });
          
          reviewsResponseText = response.text || '';
          if (reviewsResponseText) {
            console.log(`Fallback model "${fallbackModel}" succeeded!`);
            model = fallbackModel;
            succeeded = true;
            break;
          }
        } catch (fallbackErr) {
          console.error(`Fallback to model "${fallbackModel}" failed:`, fallbackErr);
        }
      }

      if (!succeeded) {
        // If all fallbacks failed, throw a cleaner/combined actionable error message
        throw new Error(`API Gateway model selection error: ${primaryError.message || primaryError}`);
      }
    }

    // Asynchronously write review snapshot into Firestore
    let savedDocId = '';
    try {
      // Crop extremely large input code/base64 to prevent exceeding Firestore 1MB doc size
      const inputCropLimit = 800000; // ~800KB safe margin
      const clippedInputData = data.length > inputCropLimit ? data.substring(0, inputCropLimit) + '... [Input text clipped due to document size constraints]' : data;
      
      const savedDoc = await addDoc(collection(db, 'reviews'), {
        type: type,
        inputData: clippedInputData,
        reviewText: reviewsResponseText,
        createdAt: serverTimestamp(),
      });
      savedDocId = savedDoc.id;
    } catch (saveError) {
      console.error('Error saving review snapshots to Firestore:', saveError);
      // We do not fail the request if saving logs fails, but we register it.
    }

    res.json({
      id: savedDocId,
      reviewText: reviewsResponseText,
      inputData: data,
    });

  } catch (err: any) {
    console.error('Code review processing failure:', err);
    res.status(500).json({ error: err.message || 'An unexpected error occurred during analysis.' });
  }
});

// Configure Vite middleware in development or serve production build
async function setupVite() {
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
    console.log(`Express full-stack server running on http://localhost:${PORT}`);
  });
}

setupVite();
