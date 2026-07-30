const chatWindow = document.getElementById('chatbot-window');
const chatToggle = document.getElementById('chatbot-toggle');
const closeChat = document.getElementById('close-chat');
const sendBtn = document.getElementById('send-btn');
const userInput = document.getElementById('user-input');
const chatMessages = document.getElementById('chat-messages');
const saveKeyBtn = document.getElementById('save-key');
const apiKeyInput = document.getElementById('api-key-input');

let geminiApiKey = sessionStorage.getItem("geminiKey") || "";

if (geminiApiKey) {
    apiKeyInput.placeholder = "Key loaded from session.";
    apiKeyInput.style.display = 'none';
    saveKeyBtn.style.display = 'none';
}

// Open and Close Chat UI
chatToggle.addEventListener('click', () => chatWindow.classList.remove('hidden'));
closeChat.addEventListener('click', () => chatWindow.classList.add('hidden'));

// Save API Key in browser memory only
saveKeyBtn.addEventListener('click', () => {
    geminiApiKey = apiKeyInput.value;
    sessionStorage.setItem("geminiKey", geminiApiKey);
    
    apiKeyInput.value = "";
    apiKeyInput.placeholder = "Key saved securely for this session.";
    apiKeyInput.style.display = 'none';
    saveKeyBtn.style.display = 'none';
    
    appendMessage("System", "API Key saved. How can I help you plan your tour today?");
});

// Send Message Event
sendBtn.addEventListener('click', handleSend);

async function handleSend() {
    const text = userInput.value;
    if (!text) return;
    if (!geminiApiKey) {
        alert("Please enter and save your Gemini API key first.");
        return;
    }
    
    appendMessage("You", text);
    userInput.value = "";
    appendMessage("Bot", "Thinking...");
    
    // 1. Fetch Live Data from Google Sheets as CSV
    const sheetData = await fetchGoogleSheet();
    
    // 2. Fetch Live Weather from Open-Meteo API
    const weatherData = await fetchWeather();
    
    // 3. Send context and query to Gemini LLM
    await callGemini(text, sheetData, weatherData);
}

function appendMessage(sender, text) {
    const msgDiv = document.createElement('div');
    msgDiv.style.marginBottom = "10px";
    msgDiv.innerHTML = `<strong>${sender}:</strong> ${text}`;
    
    if (sender === "Bot" && chatMessages.lastChild.innerHTML.includes("Thinking...")) {
        chatMessages.removeChild(chatMessages.lastChild);
    }
    
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Fetch Google Sheet 
// Uses the export format to easily pull live data without authentication limits
async function fetchGoogleSheet() {
    const sheetUrl = "https://docs.google.com/spreadsheets/d/1balBGf8QhZ5dc-RCCAPt2kcrcf6m_YRh0HL_r8bBtJw/export?format=csv&gid=120683740";
    try {
        const response = await fetch(sheetUrl);
        const data = await response.text();
        return data; 
    } catch (error) {
        return "Error fetching tours data.";
    }
}

// Fetch Open-Meteo Weather for the West of Ireland
async function fetchWeather() {
    const lat = 53.2707; // Galway Latitude
    const lon = -9.0568; // Galway Longitude
    const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`;
    
    try {
        const response = await fetch(apiUrl);
        const data = await response.json();
        return `Current temp: ${data.current.temperature_2m}°C, Weather code: ${data.current.weather_code}`;
    } catch (error) {
        return "Error fetching weather.";
    }
}

// Call Gemini API
async function callGemini(userQuery, sheetData, weatherData) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
    
    const prompt = `
    You are a helpful customer support agent for Atlantic Coast Tours in the West of Ireland.
    
    Here is the live data catalogue of our tours: 
    ${sheetData}
    
    Here is the current live weather forecast for the area: 
    ${weatherData}
    
    Instructions:
    1. Answer the customer's query using ONLY the live data provided above.
    2. If a tour has an absurd or implausible price, or zero availability, use your judgement on how to present this to the customer honestly. 
    3. If the user asks something completely off-topic, politely respond using your general knowledge but try to steer them back to tours.

    User Query: ${userQuery}
    `;

    const requestBody = {
        contents: [{ parts: [{ text: prompt }] }]
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        
        const data = await response.json();
        const botReply = data.candidates[0].content.parts[0].text;
        appendMessage("Bot", botReply);
    } catch (error) {
        appendMessage("Bot", "Sorry, I encountered an error. Please try again.");
    }
}
