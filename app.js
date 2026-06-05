// ========== Configuration & State ==========
const DEFAULT_CONFIG = {
    apiBase: 'https://api.deepseek.com',
    apiKey: '',
    apiKeyDeepseek: '',
    apiKeyOpenai: '',
    apiKeyOpenrouter: '',
    systemPrompt: '你是一个有帮助的AI助手。请用中文回答。',
    temperature: 0.7,
    contextMessages: 10,
};

const MODEL_OPTIONS = [
    // DeepSeek
    { id: 'deepseek-chat', name: 'DeepSeek V3', apiBase: 'https://api.deepseek.com', group: 'DeepSeek' },
    { id: 'deepseek-reasoner', name: 'DeepSeek R1', apiBase: 'https://api.deepseek.com', group: 'DeepSeek' },
    { id: 'xiaomi/mimo-v2-flash', name: 'MiMo V2 Flash', apiBase: 'https://api.deepseek.com', group: 'DeepSeek' },
    // OpenAI GPT
    { id: 'gpt-4o', name: 'GPT-4o', apiBase: 'https://api.openai.com', group: 'OpenAI' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', apiBase: 'https://api.openai.com', group: 'OpenAI' },
    { id: 'gpt-4.1', name: 'GPT-4.1', apiBase: 'https://api.openai.com', group: 'OpenAI' },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', apiBase: 'https://api.openai.com', group: 'OpenAI' },
    { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', apiBase: 'https://api.openai.com', group: 'OpenAI' },
    { id: 'o4-mini', name: 'o4-mini', apiBase: 'https://api.openai.com', group: 'OpenAI' },
    { id: 'o3', name: 'o3', apiBase: 'https://api.openai.com', group: 'OpenAI' },
    { id: 'o3-mini', name: 'o3 Mini', apiBase: 'https://api.openai.com', group: 'OpenAI' },
    { id: 'o3-pro', name: 'o3 Pro', apiBase: 'https://api.openai.com', group: 'OpenAI' },
    // OpenRouter
    { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', apiBase: 'https://openrouter.ai/api', group: 'OpenRouter' },
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', apiBase: 'https://openrouter.ai/api', group: 'OpenRouter' },
    { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus', apiBase: 'https://openrouter.ai/api', group: 'OpenRouter' },
    { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', apiBase: 'https://openrouter.ai/api', group: 'OpenRouter' },
    { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', apiBase: 'https://openrouter.ai/api', group: 'OpenRouter' },
    { id: 'meta-llama/llama-4-maverick', name: 'Llama 4 Maverick', apiBase: 'https://openrouter.ai/api', group: 'OpenRouter' },
    { id: 'qwen/qwen3-235b-a22b', name: 'Qwen3 235B', apiBase: 'https://openrouter.ai/api', group: 'OpenRouter' },
    { id: 'deepseek/deepseek-chat-v3-0324', name: 'DeepSeek V3 (OR)', apiBase: 'https://openrouter.ai/api', group: 'OpenRouter' },
    { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1 (OR)', apiBase: 'https://openrouter.ai/api', group: 'OpenRouter' },
];

let config = { ...DEFAULT_CONFIG };
let conversations = [];    // [{ id, title, messages: [{role, content}], createdAt }]
let currentChatId = null;
let isStreaming = false;
let abortController = null;

// ========== DOM Elements ==========
const $ = (sel) => document.querySelector(sel);
const messagesEl = $('#messages');
const userInput = $('#userInput');
const sendBtn = $('#sendBtn');
const modelSelect = $('#modelSelect');
const tokenCountEl = $('#tokenCount');
const chatListEl = $('#chatList');
const sidebarEl = $('#sidebar');
const sidebarToggle = $('#sidebarToggle');
const settingsModal = $('#settingsModal');
const settingsBtn = $('#settingsBtn');
const closeSettings = $('#closeSettings');
const saveSettingsBtn = $('#saveSettings');
const newChatBtn = $('#newChatBtn');

// ========== Init ==========
function init() {
    loadConfig();
    loadConversations();
    bindEvents();
    renderChatList();

    // Marked config
    marked.setOptions({
        highlight: function(code, lang) {
            if (lang && hljs.getLanguage(lang)) {
                return hljs.highlight(code, { language: lang }).value;
            }
            return hljs.highlightAuto(code).value;
        },
        breaks: true,
        gfm: true,
    });

    // Open last chat or show welcome
    if (conversations.length > 0) {
        switchChat(conversations[0].id);
    }
}

// ========== Local Storage ==========
function loadConfig() {
    try {
        const saved = localStorage.getItem('aichat_config');
        if (saved) config = { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
    } catch (e) {}
    syncConfigToUI();
}

function saveConfig() {
    config.apiBase = $('#apiBase').value.trim() || DEFAULT_CONFIG.apiBase;
    config.apiKeyDeepseek = $('#apiKeyDeepseek').value.trim();
    config.apiKeyOpenai = $('#apiKeyOpenai').value.trim();
    config.apiKeyOpenrouter = $('#apiKeyOpenrouter').value.trim();
    config.apiKey = config.apiKeyDeepseek; // default
    config.systemPrompt = $('#systemPrompt').value.trim();
    config.temperature = parseFloat($('#temperature').value);
    config.contextMessages = parseInt($('#contextMessages').value) || 10;
    localStorage.setItem('aichat_config', JSON.stringify(config));
}

function syncConfigToUI() {
    $('#apiBase').value = config.apiBase;
    $('#apiKeyDeepseek').value = config.apiKeyDeepseek || '';
    $('#apiKeyOpenai').value = config.apiKeyOpenai || '';    $('#apiKeyOpenrouter').value = config.apiKeyOpenrouter || '';    $('#systemPrompt').value = config.systemPrompt;
    $('#temperature').value = config.temperature;
    $('#tempValue').textContent = config.temperature;
    $('#contextMessages').value = config.contextMessages;
}

function loadConversations() {
    try {
        const saved = localStorage.getItem('aichat_conversations');
        if (saved) conversations = JSON.parse(saved);
    } catch (e) {
        conversations = [];
    }
}

function saveConversations() {
    localStorage.setItem('aichat_conversations', JSON.stringify(conversations));
}

// ========== Events ==========
function bindEvents() {
    // Send
    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Auto-resize textarea
    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = Math.min(userInput.scrollHeight, 200) + 'px';
    });

    // Sidebar toggle
    sidebarToggle.addEventListener('click', () => {
        document.body.classList.toggle('sidebar-open');
        if (window.innerWidth <= 768) {
            sidebarEl.classList.toggle('open');
        } else {
            sidebarEl.classList.toggle('collapsed');
        }
    });

    // New chat
    newChatBtn.addEventListener('click', () => createNewChat());

    // Settings
    settingsBtn.addEventListener('click', () => {
        syncConfigToUI();
        settingsModal.style.display = 'flex';
    });
    closeSettings.addEventListener('click', () => {
        settingsModal.style.display = 'none';
    });
    saveSettingsBtn.addEventListener('click', () => {
        saveConfig();
        settingsModal.style.display = 'none';
    });
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) settingsModal.style.display = 'none';
    });

    // Temperature slider
    $('#temperature').addEventListener('input', (e) => {
        $('#tempValue').textContent = e.target.value;
    });

    // Model switch - auto update API base & key
    modelSelect.addEventListener('change', () => {
        const model = MODEL_OPTIONS.find(m => m.id === modelSelect.value);
        if (model) {
            config.apiBase = model.apiBase;
            // Auto-switch API key for the provider
            if (model.apiBase.includes('openai.com')) {
                config.apiKey = config.apiKeyOpenai || config.apiKey;
            } else if (model.apiBase.includes('deepseek.com')) {
                config.apiKey = config.apiKeyDeepseek || config.apiKey;
            } else if (model.apiBase.includes('openrouter.ai')) {
                config.apiKey = config.apiKeyOpenrouter || config.apiKey;
            }
        }
    });
}

// ========== Chat Management ==========
function createNewChat() {
    const chat = {
        id: Date.now().toString(),
        title: '新对话',
        messages: [],
        createdAt: Date.now(),
    };
    conversations.unshift(chat);
    saveConversations();
    renderChatList();
    switchChat(chat.id);
    if (window.innerWidth <= 768) {
        sidebarEl.classList.remove('open');
        document.body.classList.remove('sidebar-open');
    }
}

function switchChat(chatId) {
    currentChatId = chatId;
    renderChatList();
    renderMessages();
}

function deleteChat(chatId) {
    conversations = conversations.filter(c => c.id !== chatId);
    saveConversations();
    if (currentChatId === chatId) {
        currentChatId = conversations.length > 0 ? conversations[0].id : null;
    }
    renderChatList();
    renderMessages();
}

function getCurrentChat() {
    return conversations.find(c => c.id === currentChatId);
}

// ========== Render ==========
function renderChatList() {
    chatListEl.innerHTML = '';
    conversations.forEach(chat => {
        const div = document.createElement('div');
        div.className = 'chat-item' + (chat.id === currentChatId ? ' active' : '');
        div.innerHTML = `
            <span class="chat-title">${escapeHtml(chat.title)}</span>
            <button class="delete-btn" data-id="${chat.id}" title="删除">×</button>
        `;
        div.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-btn')) return;
            switchChat(chat.id);
            if (window.innerWidth <= 768) {
                sidebarEl.classList.remove('open');
                document.body.classList.remove('sidebar-open');
            }
        });
        div.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteChat(chat.id);
        });
        chatListEl.appendChild(div);
    });
}

function renderMessages() {
    const chat = getCurrentChat();
    if (!chat || chat.messages.length === 0) {
        messagesEl.innerHTML = `
            <div class="welcome">
                <h1>🤖 AI Chat</h1>
                <p>选择模型并开始对话</p>
            </div>
        `;
        return;
    }

    messagesEl.innerHTML = '';
    chat.messages.forEach(msg => {
        appendMessageEl(msg.role, msg.content, false);
    });
    scrollToBottom();
}

function appendMessageEl(role, content, animate = false) {
    const div = document.createElement('div');
    div.className = `message ${role}`;

    const roleName = role === 'user' ? '👤 你' : '🤖 AI';
    const rendered = role === 'assistant' ? renderMarkdown(content) : escapeHtml(content);

    div.innerHTML = `
        <div class="message-inner">
            <div class="message-bubble">
                <div class="message-role">${roleName}</div>
                <div class="markdown-body">${rendered}</div>
            </div>
        </div>
    `;
    messagesEl.appendChild(div);

    // Add copy buttons to code blocks
    if (role === 'assistant') {
        div.querySelectorAll('pre code').forEach(block => {
            const wrapper = document.createElement('div');
            wrapper.className = 'code-block-wrapper';
            block.parentNode.parentNode.insertBefore(wrapper, block.parentNode);
            wrapper.appendChild(block.parentNode);

            const btn = document.createElement('button');
            btn.className = 'copy-code-btn';
            btn.textContent = '复制';
            btn.addEventListener('click', () => {
                navigator.clipboard.writeText(block.textContent).then(() => {
                    btn.textContent = '已复制!';
                    setTimeout(() => btn.textContent = '复制', 1500);
                });
            });
            wrapper.appendChild(btn);
        });
    }

    return div;
}

function renderMarkdown(text) {
    try {
        return marked.parse(text);
    } catch (e) {
        return escapeHtml(text);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function scrollToBottom() {
    requestAnimationFrame(() => {
        messagesEl.scrollTop = messagesEl.scrollHeight;
    });
}

// ========== Send Message ==========
async function sendMessage() {
    const text = userInput.value.trim();
    if (!text || isStreaming) return;

    if (!config.apiKey) {
        alert('请先在设置中配置 API Key');
        settingsModal.style.display = 'flex';
        return;
    }

    // Auto-select correct API key based on model
    const model = MODEL_OPTIONS.find(m => m.id === modelSelect.value);
    if (model) {
        if (model.apiBase.includes('openai.com') && config.apiKeyOpenai) {
            config.apiKey = config.apiKeyOpenai;
        } else if (model.apiBase.includes('deepseek.com') && config.apiKeyDeepseek) {
            config.apiKey = config.apiKeyDeepseek;
        } else if (model.apiBase.includes('openrouter.ai') && config.apiKeyOpenrouter) {
            config.apiKey = config.apiKeyOpenrouter;
        }
    }

    // Ensure we have a chat
    if (!currentChatId) {
        createNewChat();
    }
    const chat = getCurrentChat();
    if (!chat) return;

    // Add user message
    chat.messages.push({ role: 'user', content: text });

    // Auto-title from first message
    if (chat.messages.length === 1) {
        chat.title = text.substring(0, 30) + (text.length > 30 ? '...' : '');
        renderChatList();
    }

    saveConversations();

    // Show user message
    appendMessageEl('user', text, false);

    // Clear input
    userInput.value = '';
    userInput.style.height = 'auto';

    // Show loading
    const loadingEl = document.createElement('div');
    loadingEl.className = 'message assistant';
    loadingEl.innerHTML = `
        <div class="message-inner">
            <div class="message-bubble">
                <div class="message-role">🤖 AI</div>
                <div class="loading">
                    <div class="dot"></div>
                    <div class="dot"></div>
                    <div class="dot"></div>
                </div>
            </div>
        </div>
    `;
    messagesEl.appendChild(loadingEl);
    scrollToBottom();

    // Build messages for API
    const apiMessages = [];
    if (config.systemPrompt) {
        apiMessages.push({ role: 'system', content: config.systemPrompt });
    }

    // Context window
    const ctxCount = config.contextMessages;
    const startIdx = Math.max(0, chat.messages.length - 1 - ctxCount);
    for (let i = startIdx; i < chat.messages.length; i++) {
        apiMessages.push(chat.messages[i]);
    }

    // Call API
    isStreaming = true;
    updateSendButton();
    abortController = new AbortController();

    try {
        const baseUrl = config.apiBase.replace(/\/+$/, '');
        const url = `${baseUrl}/v1/chat/completions`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify({
                model: modelSelect.value,
                messages: apiMessages,
                temperature: config.temperature,
                stream: true,
            }),
            signal: abortController.signal,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`API 错误 ${response.status}: ${errorData.error?.message || response.statusText}`);
        }

        // Remove loading indicator, add assistant message
        loadingEl.remove();
        let fullContent = '';
        const assistantEl = appendMessageEl('assistant', '', false);
        const contentEl = assistantEl.querySelector('.markdown-body');
        contentEl.classList.add('streaming-cursor');

        // Parse SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // Keep incomplete line

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const data = line.slice(6).trim();
                if (data === '[DONE]') continue;

                try {
                    const parsed = JSON.parse(data);
                    const delta = parsed.choices?.[0]?.delta?.content;
                    if (delta) {
                        fullContent += delta;
                        contentEl.innerHTML = renderMarkdown(fullContent);
                    }
                } catch (e) {
                    // Skip unparseable chunks
                }
            }
        }

        contentEl.classList.remove('streaming-cursor');

        // Save assistant message
        chat.messages.push({ role: 'assistant', content: fullContent });
        saveConversations();

        // Update token estimate
        updateTokenCount(fullContent);

    } catch (err) {
        loadingEl.remove();
        if (err.name === 'AbortError') {
            appendMessageEl('assistant', '⏹ 已停止生成。');
        } else {
            appendMessageEl('assistant', `❌ 错误: ${err.message}`);
        }
    } finally {
        isStreaming = false;
        abortController = null;
        updateSendButton();
        scrollToBottom();
    }
}

// ========== UI Helpers ==========
function updateSendButton() {
    if (isStreaming) {
        sendBtn.innerHTML = '⏹';
        sendBtn.onclick = stopGeneration;
        sendBtn.disabled = false;
    } else {
        sendBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13"/></svg>`;
        sendBtn.onclick = sendMessage;
        sendBtn.disabled = false;
    }
}

function stopGeneration() {
    if (abortController) abortController.abort();
}

function updateTokenCount(text) {
    // Rough estimate: 1 token ≈ 1.5 Chinese chars or 4 English chars
    const charCount = text.length;
    const estimatedTokens = Math.round(charCount / 1.5);
    tokenCountEl.textContent = `≈ ${estimatedTokens} tokens`;
}

// ========== Start ==========
init();
