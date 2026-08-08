/**
 * JARVIS AI Assistant - Backend Server
 * Handles OpenRouter API requests, streaming, conversation management, and tool execution
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const BIND_LAN = process.env.BIND_LAN === 'true';
const HOST = BIND_LAN ? '0.0.0.0' : '127.0.0.1';

// Middleware
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// System prompt for JARVIS personality with agentic capabilities
const SYSTEM_PROMPT = `You are JARVIS, an advanced AI assistant with agentic capabilities. You are intelligent, calm, helpful, natural, concise, slightly futuristic, confident, and polite.

CAPABILITIES:
You can help users with coding tasks by executing commands, creating/editing files, and managing git operations. When the user asks you to code, build, or execute something, you can use tools.

TOOL USAGE:
When you need to perform an action, respond with a JSON tool call in this format:
{"tool": "tool_name", "params": {...}}

Available tools:
1. bash_command - Execute a bash command. Params: {command: "the command to run"}
2. create_file - Create a new file. Params: {path: "file/path", content: "file content"}
3. edit_file - Edit an existing file. Params: {path: "file/path", changes: "description of changes"}
4. read_file - Read a file's contents. Params: {path: "file/path"}
5. git_commit - Commit changes to git. Params: {message: "commit message"}
6. git_push - Push to remote. Params: {remote: "origin", branch: "main"}
7. list_files - List files in directory. Params: {path: "./"}

IMPORTANT:
- Only use tools when the user explicitly asks you to perform an action
- For normal questions, answer conversationally without tools
- After using a tool, explain what you did to the user
- If a tool fails, inform the user and suggest alternatives
- Be careful with destructive commands (rm, etc.) - warn the user first

PERSONALITY:
- Be direct and helpful without being overly formal
- Don't constantly say "Certainly" or use movie-like phrases
- Provide concise answers unless detail is requested
- Maintain conversation context naturally
- Be honest about what you don't know

RESPONSE FORMAT:
For normal conversation, respond naturally.
For recommendations, clearly list them with: name, description, category, url (if known), and why it's recommended.
For tool usage, output the JSON tool call first, then explain.`;

// Conversation storage
const conversations = new Map();

// Workspace directory for file operations
const WORKSPACE_DIR = process.env.WORKSPACE_DIR || path.join(__dirname, 'workspace');

// Ensure workspace exists
if (!fs.existsSync(WORKSPACE_DIR)) {
    fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
}

// Validate API key
function hasApiKey() {
    return !!process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY !== 'your_api_key_here';
}

// Execute tool
async function executeTool(toolName, params) {
    try {
        switch (toolName) {
            case 'bash_command': {
                const { stdout, stderr } = await execPromise(params.command, { 
                    cwd: WORKSPACE_DIR,
                    timeout: 30000 
                });
                return { success: true, output: stdout || stderr };
            }
            
            case 'create_file': {
                const fullPath = path.join(WORKSPACE_DIR, params.path);
                const dir = path.dirname(fullPath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                fs.writeFileSync(fullPath, params.content);
                return { success: true, message: `Created file: ${params.path}` };
            }
            
            case 'read_file': {
                const fullPath = path.join(WORKSPACE_DIR, params.path);
                const content = fs.readFileSync(fullPath, 'utf-8');
                return { success: true, content };
            }
            
            case 'edit_file': {
                const fullPath = path.join(WORKSPACE_DIR, params.path);
                // For now, just append a note - proper editing would require more logic
                const current = fs.readFileSync(fullPath, 'utf-8');
                fs.writeFileSync(fullPath, `${current}\n\n// Edited: ${params.changes}`);
                return { success: true, message: `Edited file: ${params.path}` };
            }
            
            case 'git_commit': {
                const { stdout } = await execPromise(`git add . && git commit -m "${params.message}"`, { 
                    cwd: WORKSPACE_DIR 
                });
                return { success: true, output: stdout };
            }
            
            case 'git_push': {
                const { stdout } = await execPromise(`git push ${params.remote} ${params.branch}`, { 
                    cwd: WORKSPACE_DIR 
                });
                return { success: true, output: stdout };
            }
            
            case 'list_files': {
                const dirPath = path.join(WORKSPACE_DIR, params.path || './');
                const files = fs.readdirSync(dirPath);
                return { success: true, files };
            }
            
            default:
                return { success: false, error: `Unknown tool: ${toolName}` };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
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
                'X-Title': 'JARVIS AI Assistant',
                'OpenRouter-Provider': 'baseten'
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                stream: true,
                max_tokens: 2048
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
        model: process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b:free',
        workspaceDir: WORKSPACE_DIR
    });
});

// Chat endpoint with streaming and tool support
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
        
        // Keep conversation manageable (last 30 messages for better context)
        if (conversation.length > 30) {
            conversation.splice(0, conversation.length - 30);
        }

        // Build messages array with system prompt
        const messages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...conversation
        ];

        const model = process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b:free';
        
        // Start streaming
        await streamOpenRouter(res, messages, model);

        // After response, check if we need to execute tools
        // This will be handled client-side by parsing the response
        
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Tool execution endpoint
app.post('/api/tool', async (req, res) => {
    if (!hasApiKey()) {
        return res.status(503).json({ error: 'API key not configured' });
    }

    try {
        const { tool, params } = req.body;
        
        if (!tool || !params) {
            return res.status(400).json({ error: 'Missing tool or params' });
        }

        const result = await executeTool(tool, params);
        res.json(result);
        
    } catch (error) {
        console.error('Tool execution error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Terminal endpoint for interactive commands
app.post('/api/terminal', async (req, res) => {
    if (!hasApiKey()) {
        return res.status(503).json({ error: 'API key not configured' });
    }

    try {
        const { command } = req.body;
        
        if (!command) {
            return res.status(400).json({ error: 'No command provided' });
        }

        // Security: block dangerous commands
        const blockedPatterns = ['rm -rf /', 'sudo rm', ':(){:|:&};:', 'mkfs', 'dd if=/dev'];
        for (const pattern of blockedPatterns) {
            if (command.includes(pattern)) {
                return res.status(403).json({ error: 'Command blocked for security' });
            }
        }

        const { stdout, stderr } = await execPromise(command, { 
            cwd: WORKSPACE_DIR,
            timeout: 60000 
        });
        
        res.json({ success: true, output: stdout || stderr || 'Command completed' });
        
    } catch (error) {
        res.json({ success: false, error: error.message });
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
    console.log(`   Model: ${process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b:free'}`);
    console.log(`   Workspace: ${WORKSPACE_DIR}`);
    
    if (!hasApiKey()) {
        console.log(`\n⚠️  WARNING: OPENROUTER_API_KEY not configured!`);
        console.log(`   Copy .env.example to .env and add your API key.\n`);
    } else {
        console.log(`   API Key: ✓ Configured\n`);
    }
});
