/**
 * JARVIS AI Assistant - Main Application Logic
 */

class JarvisApp {
    constructor() {
        this.sphere = null;
        this.messages = [];
        this.conversationId = this.generateConversationId();
        this.isGenerating = false;
        this.abortController = null;
        
        // Voice settings
        this.voiceEnabled = true;
        this.autoSpeak = true;
        this.speechSpeed = 1.0;
        this.synth = window.speechSynthesis;
        this.currentUtterance = null;
        
        // Speech recognition
        this.recognition = null;
        this.isListening = false;
        
        // Settings
        this.settings = {
            model: 'google/gemma-3-27b-it:free',
            performanceMode: 'balanced',
            reducedMotion: false,
            saveHistory: true,
            language: 'en-US'
        };
        
        this.init();
    }
    
    async init() {
        try {
            this.loadSettings();
            await this.checkServerStatus();
            this.initSphere();
            this.initSpeechRecognition();
            this.setupEventListeners();
            this.loadConversationHistory();
            
            // Hide loading screen
            setTimeout(() => {
                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('app-container').classList.remove('hidden');
            }, 1500);
            
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Failed to initialize JARVIS. Please refresh the page.');
        }
    }
    
    generateConversationId() {
        return 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    async checkServerStatus() {
        try {
            const response = await fetch('/api/status');
            const data = await response.json();
            
            const connectionStatus = document.getElementById('connection-status');
            const connectionText = document.getElementById('connection-text');
            
            if (data.status === 'online') {
                connectionStatus.classList.add('connected');
                connectionStatus.classList.remove('disconnected');
                connectionText.textContent = data.apiKeyConfigured ? 'Connected' : 'API Key Required';
                
                if (!data.apiKeyConfigured) {
                    this.showError('OpenRouter API key not configured. Check your .env file.');
                }
            } else {
                throw new Error('Server not responding');
            }
        } catch (error) {
            console.error('Connection error:', error);
            const connectionStatus = document.getElementById('connection-status');
            const connectionText = document.getElementById('connection-text');
            connectionStatus.classList.add('disconnected');
            connectionStatus.classList.remove('connected');
            connectionText.textContent = 'Disconnected';
        }
    }
    
    initSphere() {
        const performanceMode = this.settings.performanceMode;
        const reducedMotion = this.settings.reducedMotion || 
                             window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        
        this.sphere = new JarvisSphere('sphere-canvas', {
            performanceMode: performanceMode,
            reducedMotion: reducedMotion
        });
    }
    
    initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = true;
            this.recognition.lang = this.settings.language;
            
            this.recognition.onstart = () => {
                this.isListening = true;
                this.sphere.setState('LISTENING');
                document.getElementById('mic-btn').classList.add('listening');
            };
            
            this.recognition.onresult = (event) => {
                let interimTranscript = '';
                let finalTranscript = '';
                
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript;
                    } else {
                        interimTranscript += transcript;
                    }
                }
                
                const input = document.getElementById('message-input');
                if (finalTranscript) {
                    input.value = finalTranscript;
                } else if (interimTranscript) {
                    input.value = interimTranscript;
                }
                
                // Auto-send on final result
                if (finalTranscript) {
                    setTimeout(() => this.sendMessage(), 300);
                }
            };
            
            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.stopListening();
                
                if (event.error === 'not-allowed') {
                    this.showError('Microphone permission denied. Please enable it in your browser settings.');
                }
            };
            
            this.recognition.onend = () => {
                this.stopListening();
            };
        } else {
            console.warn('Speech recognition not supported in this browser');
            document.getElementById('mic-btn').style.display = 'none';
        }
    }
    
    setupEventListeners() {
        // Send button
        document.getElementById('send-btn').addEventListener('click', () => this.sendMessage());
        
        // Message input
        const input = document.getElementById('message-input');
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Auto-resize textarea
        input.addEventListener('input', () => {
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        });
        
        // Microphone button
        document.getElementById('mic-btn').addEventListener('click', () => this.toggleListening());
        
        // Stop button
        document.getElementById('stop-btn').addEventListener('click', () => this.stopGeneration());
        
        // Settings toggle
        document.getElementById('settings-toggle').addEventListener('click', () => {
            document.getElementById('settings-panel').classList.remove('hidden');
        });
        
        document.getElementById('settings-close').addEventListener('click', () => {
            document.getElementById('settings-panel').classList.add('hidden');
        });
        
        // Quick actions
        document.querySelectorAll('.quick-action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                this.handleQuickAction(action);
            });
        });
        
        // Settings controls
        document.getElementById('model-select').value = this.settings.model;
        document.getElementById('model-select').addEventListener('change', (e) => {
            this.settings.model = e.target.value;
            this.saveSettings();
        });
        
        document.getElementById('voice-enabled').checked = this.voiceEnabled;
        document.getElementById('voice-enabled').addEventListener('change', (e) => {
            this.voiceEnabled = e.target.checked;
        });
        
        document.getElementById('auto-speak').checked = this.autoSpeak;
        document.getElementById('auto-speak').addEventListener('change', (e) => {
            this.autoSpeak = e.target.checked;
        });
        
        const speedSlider = document.getElementById('speech-speed');
        speedSlider.value = this.speechSpeed;
        document.getElementById('speed-value').textContent = this.speechSpeed.toFixed(1) + 'x';
        speedSlider.addEventListener('input', (e) => {
            this.speechSpeed = parseFloat(e.target.value);
            document.getElementById('speed-value').textContent = this.speechSpeed.toFixed(1) + 'x';
        });
        
        document.getElementById('language-select').value = this.settings.language;
        document.getElementById('language-select').addEventListener('change', (e) => {
            this.settings.language = e.target.value;
            if (this.recognition) {
                this.recognition.lang = this.settings.language;
            }
            this.saveSettings();
        });
        
        document.getElementById('performance-mode').value = this.settings.performanceMode;
        document.getElementById('performance-mode').addEventListener('change', (e) => {
            this.settings.performanceMode = e.target.value;
            if (this.sphere) {
                this.sphere.setPerformanceMode(e.target.value);
            }
            this.saveSettings();
        });
        
        document.getElementById('reduced-motion').checked = this.settings.reducedMotion;
        document.getElementById('reduced-motion').addEventListener('change', (e) => {
            this.settings.reducedMotion = e.target.checked;
            if (this.sphere) {
                this.sphere.setReducedMotion(e.target.checked);
            }
            this.saveSettings();
        });
        
        document.getElementById('save-history').checked = this.settings.saveHistory;
        document.getElementById('save-history').addEventListener('change', (e) => {
            this.settings.saveHistory = e.target.checked;
            this.saveSettings();
        });
        
        document.getElementById('clear-history-btn').addEventListener('click', () => {
            this.clearConversation();
        });
        
        // Error dismissal
        document.getElementById('error-dismiss').addEventListener('click', () => {
            document.getElementById('error-notification').classList.add('hidden');
        });
        
        // Close settings on outside click
        document.addEventListener('click', (e) => {
            const panel = document.getElementById('settings-panel');
            const toggle = document.getElementById('settings-toggle');
            if (!panel.contains(e.target) && !toggle.contains(e.target) && !panel.classList.contains('hidden')) {
                panel.classList.add('hidden');
            }
        });
    }
    
    handleQuickAction(action) {
        const prompts = {
            explain: 'Explain this concept clearly and concisely: ',
            code: 'Help me write code for: ',
            summarize: 'Summarize the following in key points: ',
            recommend: 'What are the best tools/resources for: '
        };
        
        const input = document.getElementById('message-input');
        if (prompts[action]) {
            input.value = prompts[action];
            input.focus();
        }
    }
    
    toggleListening() {
        if (!this.recognition) {
            this.showError('Speech recognition is not supported in your browser.');
            return;
        }
        
        if (this.isListening) {
            this.recognition.stop();
        } else {
            this.recognition.start();
        }
    }
    
    stopListening() {
        this.isListening = false;
        document.getElementById('mic-btn').classList.remove('listening');
        if (this.sphere.state === 'LISTENING') {
            this.sphere.setState('IDLE');
        }
    }
    
    async sendMessage(customMessage = null) {
        const input = document.getElementById('message-input');
        const message = customMessage || input.value.trim();
        
        if (!message || this.isGenerating) return;
        
        // Clear input
        input.value = '';
        input.style.height = 'auto';
        
        // Add user message
        this.addMessage('user', message);
        
        // Start generation
        await this.generateResponse(message);
    }
    
    addMessage(role, content) {
        const container = document.getElementById('messages-container');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        
        const header = role === 'user' ? 'YOU' : 'JARVIS';
        
        messageDiv.innerHTML = `
            <div class="message-header">${header}</div>
            <div class="message-content">${this.formatContent(content)}</div>
            ${role === 'assistant' ? `
                <div class="message-actions">
                    <button class="action-btn" onclick="app.copyMessage(this)">Copy</button>
                    <button class="action-btn" onclick="app.regenerateMessage(this)">Regenerate</button>
                    <button class="action-btn" onclick="app.speakMessage(this)">Speak</button>
                </div>
            ` : ''}
        `;
        
        container.appendChild(messageDiv);
        container.scrollTop = container.scrollHeight;
        
        this.messages.push({ role, content });
        
        // Save to local storage
        if (this.settings.saveHistory) {
            this.saveConversationHistory();
        }
    }
    
    formatContent(content) {
        // Basic markdown-like formatting
        let formatted = content
            .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');
        
        return `<p>${formatted}</p>`;
    }
    
    async generateResponse(userMessage) {
        this.isGenerating = true;
        this.abortController = new AbortController();
        
        document.getElementById('stop-btn').classList.remove('hidden');
        this.sphere.setState('THINKING');
        
        const assistantMessageDiv = document.createElement('div');
        assistantMessageDiv.className = 'message assistant';
        assistantMessageDiv.innerHTML = `
            <div class="message-header">JARVIS</div>
            <div class="message-content"></div>
            <div class="message-actions">
                <button class="action-btn" onclick="app.copyMessage(this)">Copy</button>
                <button class="action-btn" onclick="app.regenerateMessage(this)">Regenerate</button>
                <button class="action-btn" onclick="app.speakMessage(this)">Speak</button>
            </div>
        `;
        
        const container = document.getElementById('messages-container');
        container.appendChild(assistantMessageDiv);
        const contentDiv = assistantMessageDiv.querySelector('.message-content');
        
        let fullResponse = '';
        
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: userMessage,
                    conversationId: this.conversationId
                }),
                signal: this.abortController.signal
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'API request failed');
            }
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        
                        if (data === '[DONE]') {
                            break;
                        }
                        
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.content) {
                                fullResponse += parsed.content;
                                contentDiv.innerHTML = this.formatContent(fullResponse);
                                container.scrollTop = container.scrollHeight;
                            }
                            if (parsed.error) {
                                throw new Error(parsed.error);
                            }
                        } catch (e) {
                            // Skip invalid JSON
                        }
                    }
                }
            }
            
            // Generation complete
            this.isGenerating = false;
            document.getElementById('stop-btn').classList.add('hidden');
            this.sphere.setState('IDLE');
            
            // Auto-speak if enabled
            if (this.autoSpeak && this.voiceEnabled) {
                this.speakText(fullResponse);
            }
            
            // Save to history
            if (this.settings.saveHistory) {
                this.messages.push({ role: 'assistant', content: fullResponse });
                this.saveConversationHistory();
            }
            
        } catch (error) {
            console.error('Generation error:', error);
            this.isGenerating = false;
            document.getElementById('stop-btn').classList.add('hidden');
            
            if (error.name === 'AbortError') {
                contentDiv.innerHTML += '\n\n[Generation stopped]';
            } else {
                contentDiv.innerHTML = `<p>Error: ${error.message}</p>`;
                this.sphere.setState('ERROR');
                setTimeout(() => this.sphere.setState('IDLE'), 3000);
            }
        }
    }
    
    stopGeneration() {
        if (this.abortController) {
            this.abortController.abort();
        }
        this.synth.cancel();
        this.isGenerating = false;
        document.getElementById('stop-btn').classList.add('hidden');
        this.sphere.setState('IDLE');
    }
    
    speakText(text) {
        if (!this.voiceEnabled) return;
        
        // Cancel current speech
        this.synth.cancel();
        
        // Strip markdown for speech
        const cleanText = text
            .replace(/```[\s\S]*?```/g, '')
            .replace(/`([^`]+)`/g, '$1')
            .replace(/\*\*([^*]+)\*\*/g, '$1')
            .replace(/\*([^*]+)\*/g, '$1');
        
        this.currentUtterance = new SpeechSynthesisUtterance(cleanText);
        this.currentUtterance.rate = this.speechSpeed;
        this.currentUtterance.volume = 1;
        
        this.currentUtterance.onstart = () => {
            this.sphere.setState('SPEAKING');
        };
        
        this.currentUtterance.onend = () => {
            if (this.sphere.state === 'SPEAKING') {
                this.sphere.setState('IDLE');
            }
        };
        
        this.currentUtterance.onerror = () => {
            this.sphere.setState('IDLE');
        };
        
        this.synth.speak(this.currentUtterance);
    }
    
    stopSpeaking() {
        this.synth.cancel();
        if (this.sphere.state === 'SPEAKING') {
            this.sphere.setState('IDLE');
        }
    }
    
    copyMessage(button) {
        const messageDiv = button.closest('.message');
        const content = messageDiv.querySelector('.message-content').innerText;
        
        navigator.clipboard.writeText(content).then(() => {
            const originalText = button.textContent;
            button.textContent = 'Copied!';
            setTimeout(() => {
                button.textContent = originalText;
            }, 2000);
        }).catch(err => {
            console.error('Copy failed:', err);
        });
    }
    
    regenerateMessage(button) {
        const messageDiv = button.closest('.message');
        const messages = document.querySelectorAll('.message');
        const messageArray = Array.from(messages);
        const index = messageArray.indexOf(messageDiv);
        
        if (index > 0) {
            const previousMessage = messages[index - 1];
            const userContent = previousMessage.querySelector('.message-content').innerText;
            
            // Remove assistant message
            messageDiv.remove();
            
            // Regenerate
            this.sendMessage(userContent);
        }
    }
    
    speakMessage(button) {
        const messageDiv = button.closest('.message');
        const content = messageDiv.querySelector('.message-content').innerText;
        this.speakText(content);
    }
    
    clearConversation() {
        this.conversationId = this.generateConversationId();
        this.messages = [];
        document.getElementById('messages-container').innerHTML = '';
        document.getElementById('recommendations-area').classList.add('hidden');
        
        if (this.settings.saveHistory) {
            localStorage.removeItem('jarvis_conversation_' + this.conversationId);
        }
        
        // Close settings
        document.getElementById('settings-panel').classList.add('hidden');
    }
    
    saveConversationHistory() {
        if (!this.settings.saveHistory) return;
        
        const key = 'jarvis_conversation_' + this.conversationId;
        localStorage.setItem(key, JSON.stringify(this.messages));
    }
    
    loadConversationHistory() {
        if (!this.settings.saveHistory) return;
        
        // Try to load most recent conversation
        const keys = Object.keys(localStorage);
        const convKeys = keys.filter(k => k.startsWith('jarvis_conversation_'));
        
        if (convKeys.length > 0) {
            const lastKey = convKeys[convKeys.length - 1];
            const data = localStorage.getItem(lastKey);
            
            if (data) {
                try {
                    this.messages = JSON.parse(data);
                    this.conversationId = lastKey.replace('jarvis_conversation_', '');
                    
                    // Restore messages to UI
                    const container = document.getElementById('messages-container');
                    container.innerHTML = '';
                    
                    this.messages.forEach(msg => {
                        this.addMessage(msg.role, msg.content);
                    });
                } catch (e) {
                    console.error('Failed to load conversation history:', e);
                }
            }
        }
    }
    
    saveSettings() {
        localStorage.setItem('jarvis_settings', JSON.stringify(this.settings));
    }
    
    loadSettings() {
        const saved = localStorage.getItem('jarvis_settings');
        if (saved) {
            try {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
            } catch (e) {
                console.error('Failed to load settings:', e);
            }
        }
    }
    
    showError(message) {
        const notification = document.getElementById('error-notification');
        const messageEl = document.getElementById('error-message');
        
        messageEl.textContent = message;
        notification.classList.remove('hidden');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            notification.classList.add('hidden');
        }, 5000);
    }
}

// Initialize app when DOM is ready
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new JarvisApp();
});

// Export for global access
window.app = app;
