let chatHistory = [];
let termsContext = '';
let isAnalyzing = false;
let currentRisk = null;
let currentDecision = null;

const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const termsInput = document.getElementById('termsInput');
const sendBtn = document.getElementById('sendBtn');
const charCount = document.getElementById('charCount');
const modeBadge = document.getElementById('modeBadge');
const urlInput = document.getElementById('urlInput');
const fetchUrlBtn = document.getElementById('fetchUrlBtn');
const urlStatus = document.getElementById('urlStatus');
const scoreboard = document.getElementById('scoreboard');

document.addEventListener('DOMContentLoaded', () => {
    if (termsInput) {
        termsInput.addEventListener('input', () => {
            const len = termsInput.value.length;
            charCount.textContent = `${len.toLocaleString()} characters`;
        });
    }

    if (messageInput) {
        messageInput.focus();
    }

    if (urlInput) {
        urlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                fetchFromUrl();
            }
        });
    }
});

function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}

function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

function addMessage(content, role) {
    const welcomeMsg = chatMessages.querySelector('.welcome-message');
    if (welcomeMsg) {
        welcomeMsg.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = role === 'bot' ? '<i class="fas fa-robot"></i>' : '<i class="fas fa-user"></i>';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    if (role === 'bot') {
        contentDiv.innerHTML = marked.parse(content);
    } else {
        contentDiv.textContent = content;
    }

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
    scrollToBottom();

    return contentDiv;
}

function addTypingIndicator() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot';
    messageDiv.id = 'typingIndicator';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = '<i class="fas fa-robot"></i>';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) indicator.remove();
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || isAnalyzing) return;

    addMessage(message, 'user');
    chatHistory.push({ role: 'user', content: message });
    messageInput.value = '';
    messageInput.style.height = 'auto';

    await getBotResponse(message);
}

async function getBotResponse(message) {
    isAnalyzing = true;
    sendBtn.disabled = true;
    addTypingIndicator();

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                history: chatHistory.slice(-10),
                termsContext
            })
        });

        const data = await response.json();
        removeTypingIndicator();

        if (data.error) {
            addMessage(`Error: ${data.error}`, 'bot');
        } else {
            addMessage(data.response, 'bot');
            chatHistory.push({ role: 'assistant', content: data.response });

            if (data.mode === 'demo' && modeBadge) {
                modeBadge.innerHTML = '<i class="fas fa-circle"></i><span>Demo Mode</span>';
                modeBadge.style.background = 'rgba(245, 158, 11, 0.1)';
                modeBadge.style.borderColor = 'rgba(245, 158, 11, 0.2)';
                modeBadge.style.color = 'var(--warning)';
            } else if (data.mode === 'ai' && modeBadge) {
                modeBadge.innerHTML = '<i class="fas fa-circle"></i><span>AI Active</span>';
                modeBadge.style.background = 'rgba(16, 185, 129, 0.1)';
                modeBadge.style.borderColor = 'rgba(16, 185, 129, 0.2)';
                modeBadge.style.color = 'var(--success)';
            }
        }
    } catch (error) {
        removeTypingIndicator();
        addMessage('Sorry, something went wrong. Please try again.', 'bot');
        console.error('Chat error:', error);
    }

    isAnalyzing = false;
    sendBtn.disabled = false;
    messageInput.focus();
}

async function analyzeTerms() {
    const terms = termsInput.value.trim();
    if (!terms || isAnalyzing) return;

    termsContext = terms;
    currentDecision = null;
    addMessage('Analyzing Terms & Conditions...', 'user');

    if (terms.length > 100) {
        addMessage(`Pasted ${terms.length.toLocaleString()} characters of Terms & Conditions`, 'user');
    }

    isAnalyzing = true;
    sendBtn.disabled = true;
    addTypingIndicator();

    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ terms })
        });

        const data = await response.json();
        removeTypingIndicator();

        if (data.error) {
            addMessage(`Error: ${data.error}`, 'bot');
        } else {
            addMessage(data.response, 'bot');
            chatHistory.push({ role: 'user', content: 'Analyze these terms' });
            chatHistory.push({ role: 'assistant', content: data.response });

            if (data.risk) {
                currentRisk = data.risk;
                renderScoreboard(data.risk);
            }

            if (data.mode === 'demo' && modeBadge) {
                modeBadge.innerHTML = '<i class="fas fa-circle"></i><span>Demo Mode</span>';
                modeBadge.style.background = 'rgba(245, 158, 11, 0.1)';
                modeBadge.style.borderColor = 'rgba(245, 158, 11, 0.2)';
                modeBadge.style.color = 'var(--warning)';
            } else if (data.mode === 'ai' && modeBadge) {
                modeBadge.innerHTML = '<i class="fas fa-circle"></i><span>AI Active</span>';
                modeBadge.style.background = 'rgba(16, 185, 129, 0.1)';
                modeBadge.style.borderColor = 'rgba(16, 185, 129, 0.2)';
                modeBadge.style.color = 'var(--success)';
            }
        }
    } catch (error) {
        removeTypingIndicator();
        addMessage('Sorry, analysis failed. Please try again.', 'bot');
        console.error('Analyze error:', error);
    }

    isAnalyzing = false;
    sendBtn.disabled = false;
    messageInput.focus();
}

async function fetchFromUrl() {
    const url = urlInput.value.trim();
    if (!url || isAnalyzing) return;

    urlStatus.className = 'url-status loading';
    urlStatus.textContent = 'Fetching content from URL...';
    fetchUrlBtn.disabled = true;

    try {
        const response = await fetch('/api/fetch-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        const data = await response.json();

        if (data.error) {
            urlStatus.className = 'url-status error';
            urlStatus.textContent = data.error;
        } else {
            termsInput.value = data.terms;
            const len = data.terms.length;
            charCount.textContent = `${len.toLocaleString()} characters`;

            urlStatus.className = 'url-status success';
            urlStatus.textContent = `Fetched "${data.title}" (${len.toLocaleString()} chars)`;

            addMessage(`Fetched Terms & Conditions from: ${data.url}`, 'user');
            addMessage(`Successfully loaded **${data.title}** (${len.toLocaleString()} characters). Click **Analyze Terms** to begin analysis.`, 'bot');
        }
    } catch (error) {
        urlStatus.className = 'url-status error';
        urlStatus.textContent = 'Failed to fetch URL. Please try again.';
        console.error('Fetch error:', error);
    }

    fetchUrlBtn.disabled = false;
}

function renderScoreboard(risk) {
    const circumference = 2 * Math.PI * 42;
    const offset = circumference - (risk.score / 100) * circumference;

    let ringColor;
    switch (risk.verdict_color) {
        case 'success': ringColor = '#10b981'; break;
        case 'warning': ringColor = '#f59e0b'; break;
        case 'danger': ringColor = '#ef4444'; break;
        case 'critical': ringColor = '#dc2626'; break;
        default: ringColor = '#6366f1';
    }

    scoreboard.innerHTML = `
        <div class="scoreboard-content">
            <div class="score-header">
                <div class="score-ring-wrapper">
                    <svg class="score-ring" viewBox="0 0 100 100">
                        <circle class="score-ring-bg" cx="50" cy="50" r="42"></circle>
                        <circle class="score-ring-fill" cx="50" cy="50" r="42"
                            stroke="${ringColor}"
                            stroke-dasharray="${circumference}"
                            stroke-dashoffset="${circumference}"
                            data-target="${offset}">
                        </circle>
                    </svg>
                    <div class="score-number" style="color: ${ringColor}">${risk.score}</div>
                </div>
                <div class="score-verdict" style="color: ${ringColor}">${risk.verdict}</div>
                <div class="score-recommendation">${risk.recommendation}</div>
            </div>
            <div class="score-breakdown">
                <div class="score-stat">
                    <div class="score-stat-icon high"><i class="fas fa-exclamation-triangle"></i></div>
                    <div class="score-stat-info">
                        <div class="score-stat-value">${risk.breakdown.high_risk_clauses}</div>
                        <div class="score-stat-label">High Risk</div>
                    </div>
                </div>
                <div class="score-stat">
                    <div class="score-stat-icon medium"><i class="fas fa-exclamation-circle"></i></div>
                    <div class="score-stat-info">
                        <div class="score-stat-value">${risk.breakdown.medium_risk_clauses}</div>
                        <div class="score-stat-label">Medium Risk</div>
                    </div>
                </div>
                <div class="score-stat">
                    <div class="score-stat-icon future"><i class="fas fa-clock"></i></div>
                    <div class="score-stat-info">
                        <div class="score-stat-value">${risk.breakdown.future_risks}</div>
                        <div class="score-stat-label">Future Risks</div>
                    </div>
                </div>
                <div class="score-stat">
                    <div class="score-stat-icon words"><i class="fas fa-file-alt"></i></div>
                    <div class="score-stat-info">
                        <div class="score-stat-value">${risk.breakdown.word_count.toLocaleString()}</div>
                        <div class="score-stat-label">Words</div>
                    </div>
                </div>
            </div>
            <div class="score-actions" id="scoreActions">
                <button class="btn-approve" onclick="approveTerms()">
                    <i class="fas fa-check"></i> Approve
                </button>
                <button class="btn-negotiate" onclick="negotiateTerms()">
                    <i class="fas fa-handshake"></i> Negotiate
                </button>
                <button class="btn-reject" onclick="rejectTerms()">
                    <i class="fas fa-times"></i> Reject
                </button>
            </div>
            <div id="decisionArea"></div>
        </div>
    `;

    setTimeout(() => {
        const fill = scoreboard.querySelector('.score-ring-fill');
        if (fill) {
            fill.style.strokeDashoffset = fill.dataset.target;
        }
    }, 100);
}

function approveTerms() {
    currentDecision = 'approved';
    const area = document.getElementById('decisionArea');
    area.innerHTML = `
        <div class="score-approved">
            <div class="decision-icon">&#10003;</div>
            <div class="decision-text" style="color: var(--success)">Terms Approved</div>
            <div class="decision-detail">You have accepted these terms. We recommend keeping a copy for your records.</div>
            <button class="btn-reset" onclick="resetDecision()"><i class="fas fa-redo"></i> Reset</button>
        </div>
    `;
    document.getElementById('scoreActions').style.display = 'none';
    addMessage('You have APPROVED these Terms & Conditions. Make sure to save a copy for your records.', 'bot');
    chatHistory.push({ role: 'assistant', content: 'You have APPROVED these Terms & Conditions. Make sure to save a copy for your records.' });
}

function negotiateTerms() {
    currentDecision = 'negotiated';
    const area = document.getElementById('decisionArea');
    area.innerHTML = `
        <div class="score-negotiated">
            <div class="decision-icon">&#9996;</div>
            <div class="decision-text" style="color: var(--warning)">Negotiation Requested</div>
            <div class="decision-detail">We recommend contacting the company to negotiate better terms before accepting.</div>
            <button class="btn-reset" onclick="resetDecision()"><i class="fas fa-redo"></i> Reset</button>
        </div>
    `;
    document.getElementById('scoreActions').style.display = 'none';

    const negotiateMsg = 'I want to negotiate these terms. What specific clauses should I push back on and what should I ask for?';
    addMessage(negotiateMsg, 'user');
    chatHistory.push({ role: 'user', content: negotiateMsg });
    askQuickQuestion(negotiateMsg);
}

function rejectTerms() {
    currentDecision = 'rejected';
    const area = document.getElementById('decisionArea');
    area.innerHTML = `
        <div class="score-rejected">
            <div class="decision-icon">&#10007;</div>
            <div class="decision-text" style="color: var(--danger)">Terms Rejected</div>
            <div class="decision-detail">Smart choice. These terms carry significant risk. Consider alternatives or seek legal counsel.</div>
            <button class="btn-reset" onclick="resetDecision()"><i class="fas fa-redo"></i> Reset</button>
        </div>
    `;
    document.getElementById('scoreActions').style.display = 'none';
    addMessage('You have REJECTED these Terms & Conditions. Here are some next steps:', 'bot');

    const rejectAdvice = `You've made the right decision by rejecting these risky terms.

### Recommended Next Steps:

1. **Find Alternatives** - Look for competing services with fairer terms
2. **Contact the Company** - Express your concerns and request better terms
3. **File a Complaint** - Report unfair terms to consumer protection agencies
4. **Consult a Lawyer** - If you've already been affected, seek legal advice
5. **Spread the Word** - Warn others about unfair terms on review platforms

### Consumer Protection Resources:
- **FTC (US)**: reportfraud.ftc.gov
- **EU**: Your national consumer protection center
- **India**: National Consumer Helpline (1800-11-4000)

Would you like me to help you find alternatives or draft a complaint?`;
    addMessage(rejectAdvice, 'bot');
    chatHistory.push({ role: 'assistant', content: rejectAdvice });
}

function resetDecision() {
    currentDecision = null;
    document.getElementById('scoreActions').style.display = 'flex';
    document.getElementById('decisionArea').innerHTML = '';
}

function askQuickQuestion(question) {
    messageInput.value = question;
    messageInput.focus();
    sendMessage();
}

function clearChat() {
    chatHistory = [];
    termsContext = '';
    currentRisk = null;
    currentDecision = null;
    scoreboard.innerHTML = `
        <div class="scoreboard-placeholder">
            <i class="fas fa-shield-alt"></i>
            <span>Analyze terms to see your risk score</span>
        </div>
    `;
    chatMessages.innerHTML = `
        <div class="welcome-message">
            <div class="welcome-icon">
                <i class="fas fa-shield-alt"></i>
            </div>
            <h2>Welcome to T&C Risk Analyzer</h2>
            <p>I'll help you understand Terms & Conditions and protect your consumer rights. Here's what I can do:</p>
            <div class="welcome-features">
                <div class="welcome-feature">
                    <i class="fas fa-search"></i>
                    <strong>Detect Risks</strong>
                    <span>Find harmful clauses</span>
                </div>
                <div class="welcome-feature">
                    <i class="fas fa-crystal-ball"></i>
                    <strong>Predict Issues</strong>
                    <span>Future risk warnings</span>
                </div>
                <div class="welcome-feature">
                    <i class="fas fa-balance-scale"></i>
                    <strong>Compare Rights</strong>
                    <span>Consumer law analysis</span>
                </div>
                <div class="welcome-feature">
                    <i class="fas fa-gavel"></i>
                    <strong>Legal Steps</strong>
                    <span>Actionable guidance</span>
                </div>
            </div>
            <p class="welcome-hint">
                <i class="fas fa-arrow-left"></i>
                Paste Terms & Conditions in the sidebar, or just ask me anything!
            </p>
        </div>
    `;
    if (urlStatus) {
        urlStatus.textContent = '';
        urlStatus.className = 'url-status';
    }
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        termsInput.value = e.target.result;
        const len = termsInput.value.length;
        charCount.textContent = `${len.toLocaleString()} characters`;
    };
    reader.readAsText(file);
    event.target.value = '';
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('sidebarToggle');

    sidebar.classList.toggle('collapsed');
    toggle.classList.toggle('shifted');
}

function toggleMobileMenu() {
    document.getElementById('mobileMenu')?.classList.toggle('active');
}
