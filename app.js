const DEFAULT_CONFIG = {
    apiBase: "",
    useOwnKey: false,  // false=使用平台 Key 池, true=使用用户自己的 Key
    apiKeyDeepseek: "",
    apiKeyOpenai: "",
    apiKeyOpenrouter: "",
    systemPrompt: "你是一个有帮助的AI助手。请用中文回答，表达清晰，必要时给出步骤。",
    temperature: 0.7,
    contextMessages: 10,
    useContext: true,
};

const MODEL_OPTIONS = [
    { id: "gpt-5.4", name: "gpt-5.4", provider: "OpenAI", apiBase: "https://api.openai.com" },
    { id: "gpt-4.1", name: "gpt-4.1", provider: "OpenAI", apiBase: "https://api.openai.com" },
    { id: "gpt-4.1-mini", name: "gpt-4.1-mini", provider: "OpenAI", apiBase: "https://api.openai.com" },
    { id: "gpt-4o", name: "gpt-4o", provider: "OpenAI", apiBase: "https://api.openai.com" },
    { id: "gpt-4o-mini", name: "gpt-4o-mini", provider: "OpenAI", apiBase: "https://api.openai.com" },
    { id: "o4-mini", name: "o4-mini", provider: "OpenAI", apiBase: "https://api.openai.com" },
    { id: "o3", name: "o3", provider: "OpenAI", apiBase: "https://api.openai.com" },
    { id: "deepseek-chat", name: "DeepSeek V3", provider: "DeepSeek", apiBase: "https://api.deepseek.com" },
    { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", provider: "DeepSeek", apiBase: "https://api.deepseek.com" },
    { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash", provider: "DeepSeek", apiBase: "https://api.deepseek.com" },
    { id: "deepseek-reasoner", name: "DeepSeek R1", provider: "DeepSeek", apiBase: "https://api.deepseek.com" },
    { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", provider: "OpenRouter", apiBase: "https://openrouter.ai/api" },
    { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", provider: "OpenRouter", apiBase: "https://openrouter.ai/api" },
    { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "OpenRouter", apiBase: "https://openrouter.ai/api" },
    { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "OpenRouter", apiBase: "https://openrouter.ai/api" },
    { id: "qwen/qwen3-235b-a22b", name: "Qwen3 235B", provider: "OpenRouter", apiBase: "https://openrouter.ai/api" },
    { id: "deepseek/deepseek-r1", name: "DeepSeek R1 (OpenRouter)", provider: "OpenRouter", apiBase: "https://openrouter.ai/api" },
];

let config = { ...DEFAULT_CONFIG };

// ===== 获取后端服务地址 =====
function getBackendUrl() {
    // 优先使用用户配置的地址
    if (config.apiBase && config.apiBase.trim()) {
        return config.apiBase.trim();
    }
    // 自动检测：本地开发环境用 localhost:3000
    if (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1') {
        return 'http://localhost:3000';
    }
    // 直接打开 HTML 文件（file://）时也默认 localhost（开发体验）
    if (!window.location.hostname || window.location.protocol === 'file:') {
        return 'http://localhost:3000';
    }
    // 生产环境用相对路径（由 Nginx 代理）
    return '';
}

let conversations = [];
let currentChatId = null;
let isStreaming = false;
let abortController = null;

const $ = (selector) => document.querySelector(selector);
const messagesEl = $("#messages");
const userInput = $("#userInput");
const sendBtn = $("#sendBtn");
const modelSelect = $("#modelSelect");
const modelSearch = $("#modelSearch");
const tokenCountEl = $("#tokenCount");
const chatListEl = $("#chatList");
const settingsModal = $("#settingsModal");
const settingsBtn = $("#settingsBtn");
const advancedBtn = $("#advancedBtn");
const closeSettings = $("#closeSettings");
const saveSettingsBtn = $("#saveSettings");
const newChatBtn = $("#newChatBtn");
const clearChatBtn = $("#clearChatBtn");
const contextToggle = $("#contextToggle");
const modeLabel = $("#modeLabel");
const scrollUpBtn = $("#scrollUpBtn");
const scrollDownBtn = $("#scrollDownBtn");

function init() {
    loadConfig();
    loadConversations();
    populateModelOptions();
    bindEvents();
    renderChatList();
    syncConfigToUI();

    if (window.marked) {
        marked.setOptions({
            highlight(code, lang) {
                if (window.hljs && lang && hljs.getLanguage(lang)) {
                    return hljs.highlight(code, { language: lang }).value;
                }
                return window.hljs ? hljs.highlightAuto(code).value : code;
            },
            breaks: true,
            gfm: true,
        });
    }

    if (conversations.length > 0) {
        switchChat(conversations[0].id);
    } else {
        createNewChat(false);
    }
}

function loadConfig() {
    try {
        const saved = localStorage.getItem("aiai_chat_config");
        config = saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : { ...DEFAULT_CONFIG };
    } catch {
        config = { ...DEFAULT_CONFIG };
    }
}

function saveConfig() {
    config.apiBase = $("#apiBase").value.trim();
    config.useOwnKey = $("#useOwnKey")?.checked || false;
    config.apiKeyDeepseek = $("#apiKeyDeepseek").value.trim();
    config.apiKeyOpenai = $("#apiKeyOpenai").value.trim();
    config.apiKeyOpenrouter = $("#apiKeyOpenrouter").value.trim();
    config.systemPrompt = $("#systemPrompt").value.trim();
    config.temperature = Number.parseFloat($("#temperature").value) || 0.7;
    config.contextMessages = Number.parseInt($("#contextMessages").value, 10) || 10;
    config.useContext = contextToggle.checked;
    localStorage.setItem("aiai_chat_config", JSON.stringify(config));
}

function syncConfigToUI() {
    $("#apiBase").value = config.apiBase;
    
    // 设置单选框状态
    const usePlatformKey = !config.useOwnKey;
    $("#usePlatformKey").checked = usePlatformKey;
    $("#useOwnKey").checked = config.useOwnKey;
    
    // 显示/隐藏 API Key 输入框
    const apiKeyInputs = $("#apiKeyInputs");
    if (apiKeyInputs) {
        apiKeyInputs.style.display = config.useOwnKey ? "grid" : "none";
    }
    
    $("#apiKeyDeepseek").value = config.apiKeyDeepseek;
    $("#apiKeyOpenai").value = config.apiKeyOpenai;
    $("#apiKeyOpenrouter").value = config.apiKeyOpenrouter;
    $("#systemPrompt").value = config.systemPrompt;
    $("#temperature").value = config.temperature;
    $("#tempValue").textContent = config.temperature;
    $("#contextMessages").value = config.contextMessages;
    contextToggle.checked = config.useContext;
    updateModeLabel();
}

function loadConversations() {
    try {
        const saved = localStorage.getItem("aiai_chat_conversations") || localStorage.getItem("aichat_conversations");
        conversations = saved ? JSON.parse(saved) : [];
    } catch {
        conversations = [];
    }
}

function saveConversations() {
    localStorage.setItem("aiai_chat_conversations", JSON.stringify(conversations));
}

function bindEvents() {
    sendBtn.addEventListener("click", handleSendButton);
    userInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.ctrlKey && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });
    userInput.addEventListener("input", autoResizeInput);

    newChatBtn.addEventListener("click", () => createNewChat(true));
    clearChatBtn.addEventListener("click", clearCurrentChat);
    settingsBtn.addEventListener("click", openSettings);
    advancedBtn.addEventListener("click", openSettings);
    closeSettings.addEventListener("click", closeSettingsModal);
    saveSettingsBtn.addEventListener("click", () => {
        saveConfig();
        closeSettingsModal();
        updateTokenCount();
    });
    settingsModal.addEventListener("click", (event) => {
        if (event.target === settingsModal) closeSettingsModal();
    });

    $("#temperature").addEventListener("input", (event) => {
        $("#tempValue").textContent = event.target.value;
    });

    // 单选框切换事件：显示/隐藏 API Key 输入框
    const usePlatformKeyRadio = $("#usePlatformKey");
    const useOwnKeyRadio = $("#useOwnKey");
    const apiKeyInputs = $("#apiKeyInputs");
    
    if (usePlatformKeyRadio && useOwnKeyRadio && apiKeyInputs) {
        usePlatformKeyRadio.addEventListener("change", () => {
            if (usePlatformKeyRadio.checked) {
                apiKeyInputs.style.display = "none";
            }
        });
        useOwnKeyRadio.addEventListener("change", () => {
            if (useOwnKeyRadio.checked) {
                apiKeyInputs.style.display = "grid";
            }
        });
    }

    modelSelect.addEventListener("change", () => {
        const chat = getCurrentChat();
        if (chat) {
            chat.model = modelSelect.value;
            saveConversations();
        }
        updateTokenCount();
    });

    modelSearch.addEventListener("input", populateModelOptions);
    contextToggle.addEventListener("change", () => {
        config.useContext = contextToggle.checked;
        saveConfig();
        updateModeLabel();
    });

    scrollUpBtn.addEventListener("click", () => messagesEl.scrollTo({ top: 0, behavior: "smooth" }));
    scrollDownBtn.addEventListener("click", scrollToBottom);
}

function populateModelOptions() {
    const query = (modelSearch?.value || "").trim().toLowerCase();
    const currentValue = modelSelect.value || MODEL_OPTIONS[0].id;
    const filteredModels = MODEL_OPTIONS.filter((model) => {
        const haystack = `${model.name} ${model.id} ${model.provider}`.toLowerCase();
        return !query || haystack.includes(query);
    });

    const models = filteredModels.length ? filteredModels : MODEL_OPTIONS;
    modelSelect.innerHTML = "";

    const providers = [...new Set(models.map((model) => model.provider))];
    providers.forEach((provider) => {
        const group = document.createElement("optgroup");
        group.label = provider;
        models.filter((model) => model.provider === provider).forEach((model) => {
            const option = document.createElement("option");
            option.value = model.id;
            option.textContent = model.name;
            group.appendChild(option);
        });
        modelSelect.appendChild(group);
    });

    const hasCurrent = models.some((model) => model.id === currentValue);
    modelSelect.value = hasCurrent ? currentValue : models[0].id;
}

function createNewChat(focusInput = true) {
    const chat = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        title: "新对话",
        messages: [],
        model: modelSelect.value || MODEL_OPTIONS[0].id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
    conversations.unshift(chat);
    currentChatId = chat.id;
    saveConversations();
    renderChatList();
    renderMessages();
    if (focusInput) userInput.focus();
}

function switchChat(chatId) {
    currentChatId = chatId;
    const chat = getCurrentChat();
    if (chat?.model) modelSelect.value = chat.model;
    renderChatList();
    renderMessages();
    updateTokenCount();
}

function deleteChat(chatId) {
    const shouldDelete = window.confirm("确定删除这个对话吗？");
    if (!shouldDelete) return;

    conversations = conversations.filter((chat) => chat.id !== chatId);
    if (currentChatId === chatId) currentChatId = conversations[0]?.id || null;
    saveConversations();
    renderChatList();
    renderMessages();
}

function clearCurrentChat() {
    const chat = getCurrentChat();
    if (!chat || chat.messages.length === 0) return;
    if (!window.confirm("确定清空当前对话内容吗？")) return;
    chat.messages = [];
    chat.title = "新对话";
    chat.updatedAt = Date.now();
    saveConversations();
    renderChatList();
    renderMessages();
    updateTokenCount();
}

function getCurrentChat() {
    return conversations.find((chat) => chat.id === currentChatId);
}

function renderChatList() {
    chatListEl.innerHTML = "";

    if (conversations.length === 0) {
        chatListEl.innerHTML = '<div class="chat-empty">暂无对话，点击“新对话”开始。</div>';
        return;
    }

    conversations.forEach((chat) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = `chat-item${chat.id === currentChatId ? " active" : ""}`;
        item.innerHTML = `
            <span class="chat-title">
                <strong>${escapeHtml(chat.title || "新对话")}</strong>
                <time>${formatDate(chat.createdAt)}</time>
            </span>
            <span class="delete-btn" data-id="${chat.id}" title="删除">×</span>
        `;
        item.addEventListener("click", (event) => {
            if (event.target.classList.contains("delete-btn")) {
                event.stopPropagation();
                deleteChat(chat.id);
                return;
            }
            switchChat(chat.id);
        });
        chatListEl.appendChild(item);
    });
}

function renderMessages() {
    const chat = getCurrentChat();
    const scrollControls = `
        <div class="scroll-controls" aria-hidden="true">
            <button id="scrollUpBtnInline">⌃</button>
            <button id="scrollDownBtnInline">⌄</button>
        </div>
    `;

    if (!chat || chat.messages.length === 0) {
        messagesEl.innerHTML = `
            <div class="empty-state">
                <span class="bot-icon">🤖</span>
                <h2>开始新的对话</h2>
                <p>选择一个AI模型，开始您的智能对话之旅</p>
            </div>
            ${scrollControls}
        `;
        bindInlineScrollButtons();
        return;
    }

    messagesEl.innerHTML = "";
    chat.messages.forEach((message) => appendMessageEl(message.role, message.content));
    messagesEl.insertAdjacentHTML("beforeend", scrollControls);
    bindInlineScrollButtons();
    scrollToBottom();
}

function bindInlineScrollButtons() {
    $("#scrollUpBtnInline")?.addEventListener("click", () => messagesEl.scrollTo({ top: 0, behavior: "smooth" }));
    $("#scrollDownBtnInline")?.addEventListener("click", scrollToBottom);
}

function appendMessageEl(role, content) {
    const wrapper = document.createElement("div");
    wrapper.className = `message ${role}`;
    const roleName = role === "user" ? "你" : "AI";
    const rendered = role === "assistant" ? renderMarkdown(content) : escapeHtml(content).replace(/\n/g, "<br>");

    wrapper.innerHTML = `
        <div class="message-inner">
            <div class="message-bubble">
                <div class="message-role">${roleName}</div>
                <div class="markdown-body">${rendered}</div>
            </div>
        </div>
    `;
    messagesEl.appendChild(wrapper);

    if (role === "assistant") addCopyButtons(wrapper);
    return wrapper;
}

function addCopyButtons(root) {
    root.querySelectorAll("pre code").forEach((block) => {
        const pre = block.parentNode;
        const wrapper = document.createElement("div");
        wrapper.className = "code-block-wrapper";
        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(pre);

        const button = document.createElement("button");
        button.className = "copy-code-btn";
        button.textContent = "复制";
        button.addEventListener("click", async () => {
            await navigator.clipboard.writeText(block.textContent);
            button.textContent = "已复制";
            setTimeout(() => {
                button.textContent = "复制";
            }, 1400);
        });
        wrapper.appendChild(button);
    });
}

function renderMarkdown(text) {
    try {
        return window.marked ? marked.parse(text || "") : escapeHtml(text || "");
    } catch {
        return escapeHtml(text || "");
    }
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text || "";
    return div.innerHTML;
}

function formatDate(timestamp) {
    return new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
    }).format(timestamp || Date.now());
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text || isStreaming) return;

    const model = getSelectedModel();
    const backendUrl = getBackendUrl();

    // 如果使用自己的 Key，检查是否已配置
    if (config.useOwnKey) {
        const apiKey = getApiKeyForModel(model);
        if (!apiKey) {
            openSettings();
            alert(`使用自己的 Key 模式下，请先在高级设置中配置 ${model.provider} API Key`);
            return;
        }
    }

    if (!currentChatId) createNewChat(false);
    const chat = getCurrentChat();
    if (!chat) return;

    chat.model = model.id;
    chat.messages.push({ role: "user", content: text });
    chat.updatedAt = Date.now();
    if (chat.messages.length === 1) chat.title = text.slice(0, 28) + (text.length > 28 ? "..." : "");
    saveConversations();

    removeEmptyState();
    appendMessageEl("user", text);
    userInput.value = "";
    autoResizeInput();
    renderChatList();

    const loadingEl = appendLoadingMessage();
    isStreaming = true;
    abortController = new AbortController();
    updateSendButton();

    try {
        // 构建请求体
        const requestBody = {
            model: model.id,
            messages: buildApiMessages(chat),
            temperature: config.temperature,
            stream: true,
        };

        // 如果使用自己的 Key，携带到请求体
        if (config.useOwnKey) {
            requestBody.userApiKeys = {
                deepseek: config.apiKeyDeepseek,
                openai: config.apiKeyOpenai,
                openrouter: config.apiKeyOpenrouter,
            };
        }

        const response = await fetch(`${backendUrl}/api/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
            signal: abortController.signal,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `${response.status} ${response.statusText}`);
        }

        loadingEl.remove();
        let fullContent = "";
        const assistantEl = appendMessageEl("assistant", "");
        const contentEl = assistantEl.querySelector(".markdown-body");
        contentEl.classList.add("streaming-cursor");

        await readStream(response, (delta) => {
            fullContent += delta;
            contentEl.innerHTML = renderMarkdown(fullContent);
            scrollToBottom();
        });

        contentEl.classList.remove("streaming-cursor");
        addCopyButtons(assistantEl);
        chat.messages.push({ role: "assistant", content: fullContent || "（模型没有返回内容）" });
        chat.updatedAt = Date.now();
        saveConversations();
    } catch (error) {
        loadingEl.remove();
        const message = error.name === "AbortError" ? "已停止生成。" : `错误：${error.message}`;
        appendMessageEl("assistant", message);
    } finally {
        isStreaming = false;
        abortController = null;
        updateSendButton();
        updateTokenCount();
        scrollToBottom();
    }
}

function buildApiMessages(chat) {
    const apiMessages = [];
    if (config.systemPrompt) apiMessages.push({ role: "system", content: config.systemPrompt });

    if (!config.useContext) {
        apiMessages.push(chat.messages[chat.messages.length - 1]);
        return apiMessages;
    }

    const count = Math.max(1, config.contextMessages);
    chat.messages.slice(-count).forEach((message) => apiMessages.push(message));
    return apiMessages;
}

async function readStream(response, onDelta) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (data === "[DONE]") continue;

            try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content || "";
                if (delta) onDelta(delta);
            } catch {
                continue;
            }
        }
    }
}

function appendLoadingMessage() {
    const loadingEl = document.createElement("div");
    loadingEl.className = "message assistant";
    loadingEl.innerHTML = `
        <div class="message-inner">
            <div class="message-bubble">
                <div class="message-role">AI</div>
                <div class="loading"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>
            </div>
        </div>
    `;
    messagesEl.appendChild(loadingEl);
    scrollToBottom();
    return loadingEl;
}

function getSelectedModel() {
    return MODEL_OPTIONS.find((model) => model.id === modelSelect.value) || MODEL_OPTIONS[0];
}

function getApiBaseForModel(model) {
    return config.apiBase || model.apiBase;
}

function getApiKeyForModel(model) {
    if (model.provider === "OpenAI") return config.apiKeyOpenai;
    if (model.provider === "DeepSeek") return config.apiKeyDeepseek;
    if (model.provider === "OpenRouter") return config.apiKeyOpenrouter;
    return "";
}

function handleSendButton() {
    if (isStreaming) {
        abortController?.abort();
        return;
    }
    sendMessage();
}

function updateSendButton() {
    sendBtn.textContent = isStreaming ? "停止" : "发送";
}

function autoResizeInput() {
    userInput.style.height = "auto";
    userInput.style.height = `${Math.min(userInput.scrollHeight, 210)}px`;
}

function removeEmptyState() {
    messagesEl.querySelector(".empty-state")?.remove();
}

function scrollToBottom() {
    requestAnimationFrame(() => {
        messagesEl.scrollTop = messagesEl.scrollHeight;
    });
}

function updateTokenCount() {
    const chat = getCurrentChat();
    const chars = chat ? chat.messages.reduce((total, message) => total + message.content.length, 0) : 0;
    tokenCountEl.textContent = chars ? `约 ${Math.ceil(chars / 1.6)} tokens` : "";
}

function updateModeLabel() {
    modeLabel.textContent = "单次对话";
}

function openSettings() {
    syncConfigToUI();
    settingsModal.hidden = false;
}

function closeSettingsModal() {
    settingsModal.hidden = true;
}

init();
