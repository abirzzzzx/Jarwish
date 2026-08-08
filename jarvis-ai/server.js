/**
 * JARVIS AI Assistant - Backend Server
 * Handles OpenRouter API requests, streaming, and conversation management
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const BIND_LAN = process.env.BIND_LAN === 'true';
const HOST = BIND_LAN ? '0.0.0.0' : '127.0.0.1';

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// System prompt for JARVIS personality
const SYSTEM_PROMPT = `You are JARVIS, an advanced AI assistant. You are intelligent, calm, helpful, natural, concise, slightly futuristic, confident, and polite.

Guidelines:
- Be direct and helpful without being overly formal
- Don't constantly say "Certainly" or use movie-like phrases
- Provide concise answers unless detail is requested
- When asked for recommendations, structure your response clearly
- If you need to search for current information, acknowledge that limitation
- Maintain conversation context naturally
- For recommendations, provide: name, description, category, url (if known), and why it's recommended

Response Format:
For normal questions, answer directly.
For recommendations, clearly list them with details.
Be honest about what you don't know.`;

// Conversation storage (in-memory for now, can be extended)
const conversations = new Map();

// Validate API key
function hasApiKey() {
    return !!process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY !== 'your_api_key_here';
}

// Stream OpenRouter response
async function streamOpenRouter(res, messages, model) {
    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    
    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'http://localhost:' + PORT,
                'X-Title': 'JARVIS AI Assistant'
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                stream: true,
                max_tokens: 1024
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenRouter API Error: ${response.status} - ${error}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        let buffer = '';
        
        while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
                res.write('data: [DONE]\n\n');
                break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') {
                        res.write('data: [DONE]\n\n');
                        return;
                    }
                    
                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices?.[0]?.delta?.content || '';
                        if (content) {
                            res.write(`data: ${JSON.stringify({ content })}\n\n`);
                        }
                    } catch (e) {
                        // Skip invalid JSON
                    }
                }
            }
        }
    } catch (error) {
        console.error('Streaming error:', error.message);
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
    }
}

// API Routes

// Check server status
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        apiKeyConfigured: hasApiKey(),
        model: process.env.OPENROUTER_MODEL || 'google/gemma-3-27b-it:free'
    });
});

// Chat endpoint with streaming
app.post('/api/chat', async (req, res) => {
    if (!hasApiKey()) {
        return res.status(503).json({
            error: 'API_KEY_MISSING',
            message: 'OpenRouter API key not configured. Please set OPENROUTER_API_KEY in your .env file.'
        });
    }

    try {
        const { message, conversationId = 'default' } = req.body;

        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Invalid message' });
        }

        // Get or create conversation
        if (!conversations.has(conversationId)) {
            conversations.set(conversationId, []);
        }
        
        const conversation = conversations.get(conversationId);
        
        // Add user message
        conversation.push({ role: 'user', content: message });
        
        // Keep conversation manageable (last 20 messages)
        if (conversation.length > 20) {
            conversation.splice(0, conversation.length - 20);
        }

        // Build messages array with system prompt
        const messages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...conversation
        ];

        const model = process.env.OPENROUTER_MODEL || 'google/gemma-3-27b-it:free';
        
        // Start streaming
        await streamOpenRouter(res, messages, model);

    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get conversation history
app.get('/api/conversation/:id', (req, res) => {
    const { id } = req.params;
    const conversation = conversations.get(id) || [];
    res.json(conversation);
});

// Clear conversation
app.delete('/api/conversation/:id', (req, res) => {
    const { id } = req.params;
    conversations.delete(id);
    res.json({ success: true });
});

// List conversations
app.get('/api/conversations', (req, res) => {
    const ids = Array.from(conversations.keys());
    res.json(ids);
});

// Serve frontend for all other routes
app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, HOST, () => {
    const address = BIND_LAN ? 'all interfaces' : HOST;
    console.log(`\n🚀 JARVIS AI Assistant starting...`);
    console.log(`   Server: http://${HOST}:${PORT}`);
    console.log(`   Binding: ${address}`);
    console.log(`   Model: ${process.env.OPENROUTER_MODEL || 'google/gemma-3-27b-it:free'}`);
    
    if (!hasApiKey()) {
        console.log(`\n⚠️  WARNING: OPENROUTER_API_KEY not configured!`);
        console.log(`   Copy .env.example to .env and add your API key.\n`);
    } else {
        console.log(`   API Key: ✓ Configured\n`);
    }
});
