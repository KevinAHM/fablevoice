// content.js
// Author:
// Author URI: https://
// Author Github URI: https://www.github.com/
// Project Repository URI: https://github.com/
// Description: Handles all the webpage level activities (e.g. manipulating page data, etc.)
// License: MIT

let ttsEnabled = false;
let cartesiaConnected = false;
let audioContext;
let audioWorklet;
let audioCache = new Map();
let currentAudioBuffer = [];
let isAudioReady = false;
let currentText = '';
let currentlyPlaying = null;
let manuallyStopped = false;
let wordTimestamps = []; // [ { word: 'hello', start: 0.1, end: 0.4 }, ... ]
let cachedVoices = [];
let characterVoices = {};
let useNpcVoices = false;
let maxRevisions = 3;

const shortAudioThreshold = 2 * 44100; // 2 seconds at 44100 Hz
//const delayBetweenReading = 2000;

// SETTINGS

let autoPlayNew = true;
let autoPlayOwn = false;
let autoSendAfterSpeaking = false;
//let leaveMicOn = false;
//let deepgramApiKey = '';
let cartesiaConnection = null;
let apiKey = '';
let voiceId = '';
let speed = 'normal';
let locationBackground = 'off';
let openaiApiKey = '';
let openaiModel = 'gpt-4o-mini';
let autoSelectMusic = false;
let musicAiNotes = '';
let musicLocked = false;
let enableStoryEditor = false;
let disallowedElements = '';
let disallowedRelaxed = '';
let lastRevised = null;
let revisions = 0;
let OBS;
let UI;
let TTS;
let STT;
let MUSIC;
let AI;
let CAMPAIGN;
let CAPTION;
let EDITOR;
let VOICE;
let UTILITY;

// UI

class UIManager {
    constructor() {
        this.lastLocation = null;
        this.focused = null;
        this.lastFocused = null;
    }

    initialize() {
        // Create a MutationObserver to detect when the mic toggle is removed
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && !document.getElementById('micToggle')) {
                    STT.stopRecording();
                    this.addMicToggle();
                }
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
        // Hook the send button and textarea to turn off microphone when sending a message
        const sendButton = document.getElementById('send');
        const textarea = document.querySelector('textarea[name="message"]');

        if (sendButton) {
            sendButton.addEventListener('click', () => {
                STT.stopRecording();
                UI.toggleMic(false);
            });
        }

        if (textarea) {
            textarea.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                    STT.stopRecording();
                    UI.toggleMic(false);
                }
            });
        }
    }
   
    // TTS Toggle Button

    addTTSToggleButton() {
        const targetDiv = document.querySelector('.flex.flex-row.items-center.overflow-hidden');
        if (!targetDiv) {
            console.error('Target div not found');
            return;
        }
        if (document.getElementById('ttsToggleButton')) {
            return;
        }
        
        const chatInput = document.querySelector('#chat-input');
        chatInput.value = '';
        chatInput.dispatchEvent(new Event('input', { bubbles: true }));

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'width: auto; opacity: 1; margin-left: 4px; margin-right: 4px;';

        const button = document.createElement('button');
        button.id = 'ttsToggleButton';
        button.className = 'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group hover:bg-transparent h-10 w-10 bg-input rounded-full p-2';
        button.type = 'button';

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '24');
        svg.setAttribute('height', '24');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        svg.classList.add('h-5', 'w-5');

        button.appendChild(svg);
        buttonContainer.appendChild(button);
        targetDiv.appendChild(buttonContainer);

        this.updateTTSToggleButton();
        button.addEventListener('click', () => TTS.toggleCartesiaConnection());

        // Add the new CSS rule
        const style = document.createElement('style');
        style.textContent = `
            @media (min-width: 768px) {
                .md\\:pl-14 {
                    padding-left: 3.5rem;
                    padding-right: 2.5rem !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    updateTTSToggleButton() {
        const button = document.getElementById('ttsToggleButton');
        if (button) {
            const svg = button.querySelector('svg');
            const volumeSVG = `
                <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
            `;
            const volumeXmarkSVG = `
                <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
                <line x1="23" y1="9" x2="17" y2="15"></line>
                <line x1="17" y1="9" x2="23" y2="15"></line>
            `;
            svg.innerHTML = cartesiaConnected ? volumeXmarkSVG : volumeSVG;
        }
    }

    // Play Pause Buttons

    addPlayButtons(div) {
        let franzMessage = true;
        const messageDivs = div ? [div] : document.querySelectorAll('div.grid.grid-cols-\\[25px_1fr_10px\\].md\\:grid-cols-\\[40px_1fr_30px\\].pb-4.relative');
        messageDivs.forEach((div, index) => {
            if (isMobileDevice()) {
                console.log('isMobileDevice true', div);
                const buttonContainer = div.querySelector('div.flex.flex-row.items-center.gap-1');
                if (buttonContainer && !buttonContainer.querySelector('.tts-play-button')) {
                    const button = this.createPlayButton();
                    console.log('button', button);
                    buttonContainer.appendChild(button);
                }
            } else {
                if (!div.querySelector('.tts-play-button')) {
                    let buttonBar = div.querySelector('div.ml-2.justify-center.items-center.flex.flex-col.z-\\[50\\]');
                    if (!buttonBar && index > messageDivs.length - 5 && div.querySelector('p.text-base')) {
                        console.log('creating button bar', index, div);
                        buttonBar = document.createElement('div');
                        buttonBar.className = 'ml-2 justify-center items-center flex flex-col z-[50]';
                        div.querySelector('.hidden.md\\:block').appendChild(buttonBar);
                        franzMessage = false;
                    }
                    if (buttonBar) {
                        const button = this.createPlayButton();
                        console.log('button', button);
                        buttonBar.appendChild(button);
                    }
                }
            }
            index++;
        });
        return franzMessage;
    }
    
    createPlayButton() {
        const existingButtons = document.querySelectorAll('[id^="tts-play-button-"]');
        const highestIndex = Math.max(...Array.from(existingButtons).map(button => parseInt(button.id.split('-').pop())), 0);
        const newIndex = highestIndex + 1;
        const button = document.createElement('button');
        button.id = 'tts-play-button-' + newIndex;
        console.log('createPlayButton', button.id);
        if (isMobileDevice()) {
            button.className = 'tts-play-button inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group hover:bg-transparent px-1 h-fit group';
        } else {
            button.className = 'tts-play-button inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group hover:bg-transparent px-4 py-2 h-fit group';
        }
        
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '14');
        svg.setAttribute('height', '14');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        svg.classList.add('text-gray-400', 'group-hover:text-primary');
        svg.innerHTML = `
            <circle cx="12" cy="12" r="10"></circle>
            <polygon points="10 8 16 12 10 16 10 8"></polygon>
        `;
        button.appendChild(svg);
    
        button.addEventListener('click', () => UI.togglePlayPause(button.id));
    
        return button;
    }
    
    updatePlayButtonIcon(buttonId, isPlaying) {
        //console.log('updatePlayButtonIcon', buttonId, isPlaying);
        const button = document.getElementById(buttonId);
        if (!button) { return; }
        //console.log('updatePlayButtonIcon button', button, buttonId);
        const svg = button.querySelector('svg');
        if (!svg) { return; }
        if (isPlaying) {
            //console.log('updatePlayButtonIcon isPlaying', isPlaying);
            svg.innerHTML = `
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="10" y1="15" x2="10" y2="9"></line>
                <line x1="14" y1="15" x2="14" y2="9"></line>
            `;
        } else {
            
            svg.innerHTML = `
                <circle cx="12" cy="12" r="10"></circle>
                <polygon points="10 8 16 12 10 16 10 8"></polygon>
            `;
        }
    }
    
    togglePlayPause(buttonId) {
        const button = document.getElementById(buttonId);
        const messageDiv = button.closest('div.grid.grid-cols-\\[25px_1fr_10px\\].md\\:grid-cols-\\[40px_1fr_30px\\].pb-4.relative');
        const isPlaying = buttonId === currentlyPlaying;
    
        if (currentlyPlaying) {
            this.updatePlayButtonIcon(currentlyPlaying, false);
        }
    
        manuallyStopped = true;
        if (!isPlaying) {
            currentlyPlaying = buttonId;
            this.updatePlayButtonIcon(buttonId, true);
            TTS.stopPlayback();
            TTS.playMessage(messageDiv);
        } else {
            currentlyPlaying = null;
            TTS.stopPlayback();
        }
    }

    removePlayButtons() {
        const playButtons = document.querySelectorAll('.tts-play-button');
        playButtons.forEach(button => button.remove());
    }

    // STT
    
    toggleMic(isToggled=null) {
        const micToggle = document.getElementById('micToggle');
        if (!micToggle) { return; }
        if (isToggled === null) { isToggled = micToggle.classList.contains('active'); }
        if (isToggled) {
            micToggle.classList.add('active');
        } else {
            micToggle.classList.remove('active');
        }
    }
    
    addMicToggle() {
        const mainElement = document.querySelector('body');
        if (mainElement) {
            let micToggle = document.getElementById('micToggle');
            if (!micToggle) {
                micToggle = document.createElement('button');
                micToggle.id = 'micToggle';
                micToggle.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>';
                micToggle.classList.add('mic-toggle-bubble');

                const styles = `
                    .mic-toggle-bubble {
                        position: fixed;
                        right: 20px;
                        bottom: 20px;
                        width: 60px;
                        height: 60px;
                        border-radius: 50%;
                        background-color: #3a3a3a;
                        border: none;
                        cursor: pointer;
                        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: all 0.3s ease;
                        z-index: 2147483647;
                        pointer-events: auto;
                        overflow: visible;
                        opacity: 0;
                        pointer-events: none;
                    }
                    .mic-toggle-bubble:hover {
                        background-color: #4a4a4a;
                    }
                    .mic-toggle-bubble.active {
                        background-color: #ffd700;
                    }
                    .mic-toggle-bubble svg {
                        color: #fff;
                        transition: color 0.3s ease;
                    }
                    .mic-toggle-bubble.active svg {
                        color: #3a3a3a;
                    }
                `;

                const styleElement = document.createElement('style');
                styleElement.textContent = styles;
                document.head.appendChild(styleElement);

                micToggle.addEventListener('click', this.handleMicToggleClick);

                mainElement.appendChild(micToggle);

                document.addEventListener('focusin', this.handleFocusIn);
                document.addEventListener('focusout', this.handleFocusOut);
            }
        }
    }

    handleMicToggleClick = (event) => {
        console.log('micToggle clicked');
        event.preventDefault();
        event.stopPropagation();
        console.log('micToggle clicked focused', this.focused);
        setTimeout(() => {
            if (UI.lastFocused) {
                UI.lastFocused.focus();
                if (UI.lastFocused.tagName === 'INPUT' || UI.lastFocused.tagName === 'TEXTAREA') {
                    UI.focused = UI.lastFocused;
                }
            }
        }, 50);
        if (!event.currentTarget.classList.contains('active')) {
            event.currentTarget.classList.add('active');
            UI.toggleMic(true);
            STT.startRecording();
        } else {
            event.currentTarget.classList.remove('active');
            UI.toggleMic(false);
            STT.stopRecording();
        }
    }

    handleFocusIn = (event) => {
        if (event.target.matches('input:not([type]), input[type="text"], textarea')) {
            this.moveMicToggleToActiveElement(event.target);
            this.showMicToggle();
            this.focused = event.target;
            this.lastFocused = event.target;
            console.log('focused', this.focused);
        }
    }

    handleFocusOut = (event) => {
        if (event.target.matches('input:not([type]), input[type="text"], textarea')) {
            UI.focused = null
            setTimeout(function() {
                if (!UI.focused) {
                    UI.hideMicToggle();
                }
             }, 150);
            console.log('focused reset', this.focused);
        }
    }

    moveMicToggleToActiveElement(activeElement) {
        const micToggle = document.getElementById('micToggle');
        if (!micToggle) { console.log('micToggle not found'); return; }
        console.log('moveMicToggleToActiveElement', activeElement);

        const rect = activeElement.getBoundingClientRect();
        if (rect.width <= 100) {
            console.log('Active element width is 100px or less, not moving mic toggle');
            return;
        }

        activeElement.parentNode.insertBefore(micToggle, activeElement.nextSibling);
        micToggle.style.position = 'absolute';
        micToggle.style.left = '50%';
        micToggle.style.transform = 'translateX(-50%)';

        const parentRect = activeElement.parentNode.getBoundingClientRect();
        const micToggleHeight = micToggle.offsetHeight;
        
        if (activeElement.name === 'message') {
            micToggle.style.top = `${rect.top - parentRect.top - micToggleHeight - 10}px`;
        } else {
            micToggle.style.top = `${rect.bottom - parentRect.top + 20}px`;
        }

        micToggle.style.bottom = 'auto';
        micToggle.style.right = 'auto';
    }

    hideMicToggle() {
        const micToggle = document.getElementById('micToggle');
        if (micToggle && !micToggle.classList.contains('active')) {
            micToggle.style.opacity = '0';
            micToggle.style.pointerEvents = 'none';
        }
    }

    showMicToggle() {
        const micToggle = document.getElementById('micToggle');
        if (micToggle) {
            micToggle.style.opacity = '1';
            micToggle.style.pointerEvents = 'auto';
        }
    }

    // BACKGROUND IMAGE

    updateBackgroundImage() {
        const existingBackgroundImage = document.querySelector('img[alt="location"][width="300"]');
        if (existingBackgroundImage) {
            if (locationBackground === 'off' && this.lastLocation) {
                const mainElement = document.querySelector('main');
                mainElement.style.backgroundImage = 'none';
                this.lastLocation = null;
                return;
            }
            if (locationBackground !== 'off' && this.lastLocation !== existingBackgroundImage.src) {
                this.lastLocation = existingBackgroundImage.src;
                UI.setBackgroundImage(existingBackgroundImage.src);
            }
        }
    }
    setBackgroundImage(imageUrl) {
        if (locationBackground === 'off') {
            return;
        }

        imageUrl = imageUrl.replace('?width=384','?width=2048');
        const mainElement = document.querySelector('main');
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;

            // Draw the image to the canvas
            ctx.drawImage(img, 0, 0);

            // Apply blur effect
            ctx.filter = 'blur(5px)';
            if (locationBackground == 'dark') {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            ctx.drawImage(canvas, 0, 0);

            // Reset the filter
            ctx.filter = 'none';

            // Get the blurred image as a data URL
            const blurredImageUrl = canvas.toDataURL();
            canvas.remove();

            // Apply the blurred image as background to mainElement
            mainElement.style.backgroundImage = `url(${blurredImageUrl})`;
            mainElement.style.backgroundSize = 'cover';
            mainElement.style.backgroundPosition = 'center';
        };

        img.src = imageUrl;
    }

    // OVERLAY
    
    addOverlay(element) {
        const overlay = document.createElement('div');
        overlay.classList.add('overlay');
        overlay.classList.add('rounded-md');
        overlay.textContent = "Enhancing narrative...";
        element.insertBefore(overlay, element.firstChild);
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        overlay.style.backdropFilter = 'blur(5px)';
        overlay.style.webkitBackdropFilter = 'blur(5px)';
    }
    
    updateOverlay(message) {
        const overlay = document.querySelector('.overlay');
        if (overlay) {
            overlay.textContent = message;
        }
    }
    
    removeOverlay(element=null) {
        const overlay = (element ? element : document).querySelector('.overlay');
        if (!overlay) { return; }
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0)';
        overlay.style.backdropFilter = 'blur(0px)';
        overlay.style.webkitBackdropFilter = 'blur(0px)';
        setTimeout(() => {
            if (overlay) {
                overlay.remove();
            }
        }, 1000);
    }

}

// CAPTIONS

class CaptionManager {
    constructor() {
        this.lastHighlightedWord = null;
        this.debounceTimer = null;
    }

    prepareText(textDiv) {
        if (textDiv.dataset.prepared) return;
        
        const text = textDiv.textContent;
        const words = text.split(/\s+/);
        textDiv.innerHTML = words.map(word => `<span class="caption-word">${word}</span>`).join(' ');
        textDiv.dataset.prepared = 'true';
        
        this.addCharacterTitles(textDiv);
    }

    prepareAllTexts() {
        const textDivs = document.querySelectorAll('.text-base');
        textDivs.forEach(textDiv => {
            this.prepareText(textDiv);
        });
    }

    addCharacterTitles(textDiv) {
        const characters = CAMPAIGN.characters;
        const wordSpans = textDiv.querySelectorAll('.caption-word');
        
        const getComparableName = (name) => {
            const prefixes = ['The', 'Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.', 'Lord', 'Lady', 'Baron', 'Baroness', 'Count', 'Countess', 'Duke', 'Duchess', 'Earl', 'Earless', 'Viscount', 'Viscountess', 'Marquis', 'Marchioness', 'Prince', 'Princess', 'King', 'Queen', 'Emperor', 'Empress', 'Pope', 'Pope'];
            let parts = name.split(' ');
            while (prefixes.includes(parts[0])) {
                parts.shift();
            }
            return parts[0].toLowerCase();
        };

        const removePunctuation = (text) => {
            return text.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "").toLowerCase();
        };

        wordSpans.forEach(span => {
            const word = removePunctuation(span.textContent);
            const character = characters.find(char => {
                const charName = getComparableName(char.name);
                return word === charName || (word.startsWith(charName) && !characters.some(c => word === getComparableName(c.name)));
            });
            
            if (character) {
                span.style.cursor = 'pointer';
                tippy(span, {
                    content: `
                        <div class="character-tooltip">
                            <div class="aspect-square relative overflow-hidden rounded-lg">
                                <img src="${character.avatar}" alt="${character.name}" class="object-cover w-full h-full" />
                                <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background to-transparent h-1/2"></div>
                                <div class="absolute inset-0 bg-gradient-to-b from-background from-3% via-transparent via-5% to-transparent to-100%"></div>
                                <div class="absolute inset-0 bg-gradient-to-r from-background from-3% via-transparent via-20% to-transparent to-100%"></div>
                                <div class="absolute inset-0 bg-gradient-to-l from-background from-3% via-transparent via-20% to-transparent to-100%"></div>
                                <div class="absolute inset-0 -top-5 bg-[radial-gradient(circle,transparent_0%,transparent_50%,rgba(1,10,13,0.9)_100%)]"></div>
                                <div class="absolute inset-x-0 bottom-0 text-gray-300">
                                    <div class="text-2xl font-header text-center">${character.name}</div>
                                    <div class="text-sm font-header text-center">${character.type}</div>
                                    <div class="text-xs text-center italic font-header mt-1">${character.brief_description || ''}</div>
                                </div>
                            </div>
                        </div>
                    `,
                    theme: 'fablevoice',
                    allowHTML: true,
                    interactive: true
                });
                //console.log('character name added', character);
            }
        });
    }

    activeWord(data) {
        //console.log('activeWord', data.word);
        const playButton = document.getElementById(currentlyPlaying);
        if (!playButton) return;
        
        const messageDiv = playButton.closest('div.grid.grid-cols-\\[25px_1fr_10px\\].md\\:grid-cols-\\[40px_1fr_30px\\].pb-4.relative');
        const textDivs = messageDiv.querySelectorAll('.text-base');
        
        this.prepareAllTexts();
        
        const allWordSpans = [];
        textDivs.forEach(textDiv => {
            allWordSpans.push(...textDiv.querySelectorAll('.caption-word'));
        });
        
        if (this.lastHighlightedWord) {
            //this.lastHighlightedWord.classList.remove('highlighted');
        }
        
        const wordSpan = allWordSpans[data.index];
        if (wordSpan) {
            wordSpan.classList.add('highlighted');
            //console.log('highlighted', wordSpan.textContent, wordSpan.classList, wordSpan);
            this.lastHighlightedWord = wordSpan;
            setTimeout(() => {
                if (wordSpan) {
                    wordSpan.classList.remove('highlighted');
                }
            }, 1000);
        }
    }
}

// TEXT-TO-SPEECH

class CartesiaConnection {
    constructor() {
        this.connection = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectInterval = 5000; // 5 seconds
        this.intentionalClose = false;
        this.loadSettings();
        this.currentContextId = null;
        this.pendingRequests = [];
        this.isProcessing = false;
        this.currentSessionBuffer = [];
        this.currentSessionTimestamps = [];
        this.cumulativeDuration = 0;
        this.pendingDuration = 0;
        this.silenceDuration = 0.5; // Default silence duration in seconds
        this.cumulativeSilence = 0; // Track total silence added
    }

    loadSettings() {
        chrome.storage.local.get(['apiKey', 'voiceId', 'speed', 'silenceDuration'], function(data) {
            console.log('loadSettings', data);
            apiKey = data.apiKey || '';
            voiceId = data.voiceId || '';
            speed = data.speed || 'normal';
            this.silenceDuration = data.silenceDuration || 0.5;
        });
    }

    initialize() {
        const apiVersion = '2024-06-10';
        const url = `wss://api.cartesia.ai/tts/websocket?api_key=${apiKey}&cartesia_version=${apiVersion}`;

        this.connection = new WebSocket(url);

        this.connection.onopen = () => {
            console.log('Cartesia connection established.');
            this.reconnectAttempts = 0;
            this.intentionalClose = false;
            this.processNextRequest();
        };

        this.connection.onmessage = (event) => {
            this.handleMessage(JSON.parse(event.data));
        };

        this.connection.onclose = (event) => {
            console.log('Cartesia connection closed.');
            if (!this.intentionalClose) {
                this.attemptReconnect();
            }
        };

        this.connection.onerror = (error) => {
            butterup.toast({
                title: 'Cartesia Error',
                message: 'Could not connect. Check your API key and available credits.',
                location: 'bottom-left',
                icon: false,
                dismissable: true,
                type: 'error',
            });
            console.error('Cartesia connection error:', error);
        };
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            setTimeout(() => this.initialize(), this.reconnectInterval);
        } else {
            console.error('Max reconnection attempts reached. Please check your connection and try again later.');
        }
    }

    handleMessage(response) {
        if (response.type === 'chunk') {
            this.handleChunk(response);
        } else if (response.type === 'done') {
            this.handleDone(response);
        } else if (response.type === 'timestamps') {
            this.handleTimestamps(response);
        } else if (response.type === 'error') {
            butterup.toast({
                title: 'Cartesia Error',
                message: 'Could not handle message.',
                location: 'bottom-left',
                icon: false,
                dismissable: true,
                type: 'error',
            });
            console.error('Cartesia error:', response);
        }
    }

    handleChunk(response) {
        if (audioWorklet && response.data && response.data.length > 0) {
            const audioData = decodeAudioData(response.data);
            this.currentSessionBuffer.push(audioData);
            audioWorklet.port.postMessage({ type: 'append', buffer: audioData });
            
            const totalSamples = this.currentSessionBuffer.reduce((sum, chunk) => sum + chunk.length, 0);
            if (totalSamples >= shortAudioThreshold && this.currentSessionTimestamps.length > 0 && !isAudioReady) {
                isAudioReady = true;
                console.log('checkAndPlayAudio called from handleChunk', this.currentSessionTimestamps, 'isAudioReady', isAudioReady);
                TTS.checkAndPlayAudio();
            }
        }
    }

    handleDone(response) {
        console.log('Received done:', response);
        if (response.context_id === this.currentContextId) {
            this.cumulativeDuration += this.pendingDuration;
            this.pendingDuration = 0;
            this.currentContextId = null;
            this.isProcessing = false;
            
            // Add silence buffer
            const silenceSamples = Math.floor(this.silenceDuration * 44100); // Assuming 44100 sample rate
            const silenceBuffer = new Float32Array(silenceSamples).fill(0);
            this.currentSessionBuffer.push(silenceBuffer);
            audioWorklet.port.postMessage({ type: 'append', buffer: silenceBuffer });
            
            // Update cumulative silence
            this.cumulativeSilence += this.silenceDuration;
            
            if (this.pendingRequests.length === 0) {
                this.finalizeSession();
            } else {
                this.processNextRequest();
            }
        }
    }

    finalizeSession() {
        console.log(`Caching audio, total chunks: ${this.currentSessionBuffer.length}`);
        audioCache.set(currentText, {
            audio: this.currentSessionBuffer,
            timestamps: this.currentSessionTimestamps
        });
        console.log('finalizeSession', this.currentSessionTimestamps);
        audioWorklet.port.postMessage({ type: 'done' });
        if (!isAudioReady) {
            isAudioReady = true;
            TTS.checkAndPlayAudio();
        }
        // Reset buffers for the next session
        this.currentSessionBuffer = [];
        this.currentSessionTimestamps = [];
        this.cumulativeDuration = 0;
        this.pendingDuration = 0;
        this.cumulativeSilence = 0;
    }

    handleTimestamps(response) {
        if (response.word_timestamps) {
            const { words, start, end } = response.word_timestamps;
            
            // Add new timestamps to the array, adjusting for cumulative duration and silence
            const newTimestamps = words.map((word, index) => ({
                word,
                start: start[index] + this.cumulativeDuration + this.cumulativeSilence,
                end: end[index] + this.cumulativeDuration + this.cumulativeSilence
            }));
            
            this.currentSessionTimestamps = this.currentSessionTimestamps.concat(newTimestamps);
            
            // Update pending duration
            if (end.length > 0) {
                this.pendingDuration = Math.max(this.pendingDuration, end[end.length - 1]);
            }
            
            // Send timestamp data to audio worklet
            if (audioWorklet) {
                audioWorklet.port.postMessage({ 
                    type: 'timestamps', 
                    data: {
                        words: this.currentSessionTimestamps.map(ts => ts.word),
                        start: this.currentSessionTimestamps.map(ts => ts.start),
                        end: this.currentSessionTimestamps.map(ts => ts.end)
                    }
                });
            }
        }
    }

    validateEmotions(emotions) {
        if (!emotions) { return false; }
        
        const validEmotions = ['anger', 'positivity', 'surprise', 'sadness', 'curiosity'];
        const validLevels = ['lowest', 'low', '', 'high', 'highest'];
        
        return emotions.every(emotion => {
            const [emotionName, level] = emotion.split(':');
            return validEmotions.includes(emotionName) && 
                   (level === undefined || validLevels.includes(level));
        });
    }

    sendTextToCartesia(text, continueFlag = false, voice = null, emotions = [], speed = null) {
        const request = { text, continueFlag, voice, emotions, speed };
        this.pendingRequests.push(request);
        if (!this.isProcessing) {
            this.processNextRequest();
        }
    }

    processNextRequest() {
        if (this.pendingRequests.length === 0 || this.isProcessing) {
            return;
        }

        this.isProcessing = true;
        const { text, continueFlag, voice, emotions, speed } = this.pendingRequests.shift();
        this.currentContextId = this.uuidv4();

        if (this.connection && this.connection.readyState === WebSocket.OPEN) {
            const message = {
                context_id: this.currentContextId,
                model_id: "sonic-english",
                transcript: text,
                duration: 180,
                voice: {
                    mode: "id",
                    id: voice ? voice : voiceId,
                    "__experimental_controls": {
                        "speed": speed ? speed : 'normal',
                        "emotion": this.validateEmotions(emotions) ? emotions : []
                    },
                },
                output_format: {
                    container: "raw",
                    encoding: "pcm_s16le",
                    sample_rate: 44100
                },
                language: "en",
                add_timestamps: true,
                continue: continueFlag
            };
            console.log(message);
            this.connection.send(JSON.stringify(message));
            console.log('Sent text for TTS:', text, 'with context ID:', this.currentContextId);
        } else {
            butterup.toast({
                title: 'Cartesia Error',
                message: 'Cartesia connection is not open.',
                location: 'bottom-left',
                icon: false,
                dismissable: true,
                type: 'error',
            });
            console.error('Cartesia connection is not open. Cannot send text for TTS.');
            this.isProcessing = false;
            this.processNextRequest();
        }
    }

    closeConnection() {
        if (this.connection) {
            this.intentionalClose = true;
            this.connection.close();
        }
    }

    uuidv4() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}

class TTSManager {
    constructor() {
        this.cartesiaConnection = null;
        this.uuid = null;
    }
    // Function to play audio from cache
    async playAudioFromCache(text) {
        const cachedData = audioCache.get(text);
        if (audioWorklet && cachedData && cachedData.audio && cachedData.audio.length > 0) {
            if (currentlyPlaying) {
                UI.updatePlayButtonIcon(currentlyPlaying, true);
            }
            audioWorklet.port.postMessage({ type: 'stop' });
            audioWorklet.port.postMessage({ type: 'reset' });
            cachedData.audio.forEach((chunk, index) => {
                audioWorklet.port.postMessage({ type: 'append', buffer: chunk });
            });
            audioWorklet.port.postMessage({ type: 'done' });
            audioWorklet.port.postMessage({ 
                type: 'timestamps', 
                data: {
                    words: cachedData.timestamps.map(ts => ts.word),
                    start: cachedData.timestamps.map(ts => ts.start),
                    end: cachedData.timestamps.map(ts => ts.end)
                }
            });
            audioWorklet.port.postMessage({ type: 'play' });
        } else {
            console.error('Cannot play from cache: invalid audio data');
            await this.sendTTSRequest(text);
        }
    }

    // Function to initialize TTS
    initializeTTS() {
        if (!audioContext) {
            console.log('Initializing TTS');
            audioContext = new AudioContext({ sampleRate: 44100 });
            audioContext.audioWorklet.addModule(chrome.runtime.getURL('audio.js'))
                .then(() => {
                    audioWorklet = new AudioWorkletNode(audioContext, 'tts-audio-processor');
                    
                    // Connect the audioWorklet directly to the destination
                    audioWorklet.connect(audioContext.destination);
                    
                    console.log('Audio worklet, compressor, makeup gain, and limiter initialized and connected');
                    
                    audioWorklet.port.onmessage = (event) => {
                        if (event.data.type === 'finished') {
                            console.log('audioWorklet.port.onmessage finished');
                            if (currentlyPlaying) {
                                UI.updatePlayButtonIcon(currentlyPlaying, false);
                                manuallyStopped = false;
                                currentlyPlaying = null;
                            }
                        } else if (event.data.type === 'activeWord') {
                            //console.log('audioWorklet.port.onmessage activeWord', event.data);
                            CAPTION.activeWord(event.data);
                        }
                    };

                    UI.addPlayButtons(); // Add this line to add play buttons to existing messages
                })
                .catch(error => console.error('Error loading audio worklet:', error));
        }
    }

    initializeCartesiaConnection() {
        if (!this.cartesiaConnection) {
            this.cartesiaConnection = new CartesiaConnection();
            this.cartesiaConnection.initialize();
            return true;
        }
        return false;
    }

    toggleCartesiaConnection() {
        if (this.cartesiaConnection) {
            this.cartesiaConnection.closeConnection();
            this.cartesiaConnection = null;
            cartesiaConnected = false;
            UI.updateTTSToggleButton();
            UI.removePlayButtons();
        } else {
            const success = this.initializeCartesiaConnection();
            if (success) {
                console.log('connected to cartesia');
                cartesiaConnected = true;
                UI.updateTTSToggleButton();
                TTS.initializeTTS();
                UI.addPlayButtons();
            }
        }
    }
    
    checkAndPlayAudio() {
        if (isAudioReady && audioWorklet) {
            console.log('Starting audio playback');
            audioWorklet.port.postMessage({ type: 'play' });
            // highlight first word
            //console.log('highlight first word');
            CAPTION.activeWord({
                type: 'activeWord',
                word: 'placeholder',
                start: 0,
                end: 0,
                index: 0
            });
        }
    }

    stopPlayback() {
        if (audioWorklet) {
            audioWorklet.port.postMessage({ type: 'stop' });
        }
        if (currentlyPlaying) {
            UI.updatePlayButtonIcon(currentlyPlaying, false);
            currentlyPlaying = null;
        }
    }

    queueMessage(node) {
        let checkCount = 0;
        const maxChecks = 120; // 2 minutes * 60 seconds / 1 second interval
        const interval = setInterval(() => {
            if (!currentlyPlaying || checkCount >= maxChecks) {
                clearInterval(interval);
                if (!currentlyPlaying && !manuallyStopped) {
                    this.playMessage(node);
                }
            }
            checkCount++;
        }, 1000);
    }

    async sendTTSRequest(text, continueFlag = false, voice = null, emotions = null, speed = null) {
        currentAudioBuffer = [];
        isAudioReady = false;
        console.log('sendTTSRequest', text, continueFlag, voice, emotions, speed);
        if (!this.cartesiaConnection) {
            butterup.toast({
                title: 'Cartesia Error',
                message: 'Could not connect. Check your API key and available credits.',
                location: 'bottom-left',
                icon: false,
                dismissable: true,
                type: 'error',
            });
            return;
        }
        this.cartesiaConnection.sendTextToCartesia(text, continueFlag, voice, emotions, speed);
    }

    async playMessage(messageDiv) {
        const textElements = messageDiv.querySelectorAll('.text-base');
        let text = Array.from(textElements).map(el => el.textContent).join('\n');
    
        if (text.length > 100) {
            //text = text.substring(0, 100) + '...';
        }
        
        
        const isPlayerMessage = !messageDiv.innerHTML.includes('<div class="font-bold md:text-lg">Franz</div>');
        const playerName = isPlayerMessage ? messageDiv.querySelector('div.font-bold.md\\:text-lg').innerText : null;
        console.log('playMessage isPlayerMessage', isPlayerMessage, playerName);
    
        // Find the play button for this message
        const playButton = messageDiv.querySelector('.tts-play-button');
        console.log('playMessage playButton', playButton);
        if (playButton) {
            currentlyPlaying = playButton.id;
            UI.updatePlayButtonIcon(playButton.id, true);
        }

        // Check if the text matches any key in audioCache
        const matchingKey = Array.from(audioCache.keys()).find(key => key === text);
        
        if (matchingKey) {
            console.log('Exact match found in audioCache');
            //text = matchingKey;
        } else {
            console.log('No exact match found in audioCache');
            // Optionally, you could implement a fuzzy matching algorithm here
            // For now, we'll just log the available keys
            console.log('Available keys in audioCache:', Array.from(audioCache.keys()));
        }
    
        if (audioCache.has(text)) {
            console.log('Playing from cache');
            this.playAudioFromCache(text);
        } else {

            currentText = text;
            let modifiedText = text;


            console.log('isPlayerMessage', isPlayerMessage, 'useNpcVoices', useNpcVoices, 'openaiApiKey', openaiApiKey, 'characterVoices', characterVoices);
            if (!isPlayerMessage && useNpcVoices && openaiApiKey) {

                const dialog = await AI.speakerIdentify(text);
                console.log('speakerIdentify dialog', dialog);

                //this.cartesiaConnection.startNewSession();

                if (dialog) {
                    const dialogLines = dialog.split('\n').filter(line => line.trim() !== '');
                    
                    for (let i = 0; i < dialogLines.length; i++) {
                        const line = dialogLines[i].trim();
                        const match = line.match(/^\[(.*?)\](.*)/);
                        
                        if (match) {
                            const speakerInfo = match[1];
                            const dialogText = match[2].trim();
                            
                            // Extract speaker name and emotions
                            let [speakerName, ...emotions] = speakerInfo.split(',').map(item => item.trim());

                            if (speakerName === "The Narrator/Game Master" || speakerName === "The Narrator" || speakerName === "Game Master") {
                                continue;
                            }
                            
                            // Find the exact position of the dialog in the remaining text
                            let dialogIndex = modifiedText.indexOf(dialogText);
                            if (dialogIndex === -1) {
                                dialogIndex = modifiedText.indexOf(dialogText.slice(0, -2));
                                if (dialogIndex === -1) {
                                    console.log('Still not found, assuming mistake in AI diarization');
                                    continue;
                                }
                            }
                            console.log('remaining text', modifiedText, 'index', dialogIndex, 'of', dialogText);
                            
                            if (dialogIndex > 0) {
                                // Send the narration before the dialog
                                const narration = modifiedText.substring(0, dialogIndex).trim();
                                if (narration) {
                                    console.log('playMessage narration', narration);
                                    await this.sendTTSRequest(narration, false, null);
                                }
                            }
                            
                            const characterVoice = VOICE.getCharacterVoice(speakerName);
                            //console.log('playMessage characterVoice', characterVoice);
                            const voiceId = characterVoice ? characterVoice.voiceId : null;
                            console.log('playMessage dialog', dialogText, speakerName, voiceId, emotions);
                            if (characterVoice && characterVoice.disableEmotions) {
                                emotions = [];
                                //console.log('disable emotions for', speakerName);
                            }
                            await this.sendTTSRequest(dialogText, false, voiceId, emotions);
                            
                            // Update modifiedText to remove the processed part
                            modifiedText = modifiedText.substring(dialogIndex + dialogText.length);
                        }
                    }
                    
                    // Send any remaining text as narration
                    if (modifiedText.trim()) {
                        console.log('playMessage final narration', modifiedText.trim());
                        await this.sendTTSRequest(modifiedText.trim(), false, null);
                    } else {
                        console.log('playMessage sending done');
                        await this.sendTTSRequest('', false, null);
                    }
                } else {
                    // If no dialog is detected, use the original text
                    console.log('playMessage full text', text);
                    await this.sendTTSRequest(text, false, null);
                }

                return;
            }

            // find player voiceId
            let voiceId = null;
            let emotions = null;
            let speed = null;
            if (playerName) {
                const playerVoice = VOICE.getCharacterVoice(playerName);
                console.log('playMessage playerVoice', playerVoice);
                voiceId = playerVoice ? playerVoice.voiceId : null;
                emotions = null; //playerVoice && playerVoice.emotion;
                speed = playerVoice ? playerVoice.speed : null;
            }
            console.log('Requesting new audio for player message', voiceId, emotions, speed);
            text = text.replace(/\(.*?\)/g, '');
            await this.sendTTSRequest(text, false, voiceId, emotions, speed);
        }
    }
}

// SPEECH-TO-TEXT

let deepgramConnection = null;
let micAudioContext = null;
let micStream = null;
let isRecording = false;

class STTManager {
    constructor() {
        this.recognition = null;
        this.isRecording = false;
    }

    async startRecording() {
        try {
            if (!('webkitSpeechRecognition' in window)) {
                throw new Error('Web Speech API is not supported in this browser.');
            }

            this.recognition = new webkitSpeechRecognition();
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';

            this.recognition.onstart = () => {
                console.log('Speech recognition started');
                this.isRecording = true;
            };

            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.stopRecording();
            };

            this.recognition.onend = () => {
                console.log('Speech recognition ended');
                this.isRecording = false;
                UI.toggleMic(false);
            };

            let finalTranscript = '';
            let interimTranscript = '';

            this.recognition.onresult = (event) => {
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                        this.sendTranscriptToChat(finalTranscript, true);
                        finalTranscript = '';
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }
                
                if (interimTranscript) {
                    //this.sendTranscriptToChat(interimTranscript, false);
                    interimTranscript = '';
                }
            };

            this.recognition.start();
            UI.toggleMic(true);
        } catch (error) {
            butterup.toast({
                title: 'Speech Recognition Error',
                message: error.message,
                location: 'bottom-left',
                icon: false,
                dismissable: true,
                type: 'error',
            });
            console.error('Error starting speech recognition:', error);
        }
    }

    stopRecording() {
        if (this.recognition) {
            this.recognition.stop();
            this.isRecording = false;
            UI.toggleMic(false);
        }
    }

    sendTranscriptToChat(transcript, isFinal) {
        const activeElement = document.activeElement;
        const isMessageTextarea = activeElement.matches('textarea[name="message"]');
        const isTextInput = activeElement.matches('input:not([type]), input[type="text"], textarea');

        if (isTextInput) {
            const cursorPosition = activeElement.selectionStart;
            const currentValue = activeElement.value;
            const newValue = currentValue.slice(0, cursorPosition) + transcript.trim() + currentValue.slice(cursorPosition);
            activeElement.value = newValue;
            activeElement.setSelectionRange(cursorPosition + transcript.trim().length, cursorPosition + transcript.trim().length);
            activeElement.dispatchEvent(new Event('input', { bubbles: true }));
            
            if (isMessageTextarea && isFinal && autoSendAfterSpeaking) {
                const sendButton = document.getElementById('send');
                if (sendButton) {
                    sendButton.click();
                }
            }
        }
    }
}

// MUSIC

class MusicManager {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.tracks = new Map();
        this.currentTrack = null;
        this.fadeTime = 4; // Crossfade duration in seconds
        this.tags = [];
        this.includedTags = new Set();
        this.currentWorld = '';
        this.trackList = new Map(); // Store track info without downloading
        this.masterGainNode = this.audioContext.createGain(); // Create a master gain node
        this.masterGainNode.connect(this.audioContext.destination); // Connect it to the audio context destination
        this.volume = 1; // Default volume
        this.filteredTracks = [];
        this.manuallyStopped = false;
    }

    updateToggleButtonState = (button) => {
        if (this.currentTrack) {
            (button ? button : document.getElementById('music-manager-toggle')).innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white">
                    <path d="M6 6h12v12H6z"/>
                </svg>
            `;
        } else {
            (button ? button : document.getElementById('music-manager-toggle')).innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white">
                    <path d="M8 5v14l11-7z"/>
                </svg>
            `;
        }
    };

    createUI() {
        const container = document.createElement('div');
        container.id = 'music-manager';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.alignItems = 'center';
        container.style.padding = '10px';
        container.style.backgroundColor = 'transparent';
        container.style.borderRadius = '.375rem';
        container.style.marginBottom = '10px';

        const excludeTagsButton = document.createElement('button');
        excludeTagsButton.id = 'exclude-tags-button';
        excludeTagsButton.className = 'inline-flex items-center justify-center whitespace-nowrap font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group bg-gray-400 bg-clip-padding backdrop-filter backdrop-blur-md bg-opacity-20 border border-gray-500 hover:border-primary text-gray-300 h-9 rounded-md px-3';
        excludeTagsButton.style.width = '100%';
        excludeTagsButton.style.marginBottom = '5px';
        excludeTagsButton.style.fontSize = '14px';
        excludeTagsButton.style.display = 'flex';
        excludeTagsButton.style.alignItems = 'center';
        excludeTagsButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-tags mr-2 h-4 w-4" style="margin-bottom: 2px;">
                <path d="M9 5H2v7l6.29 6.29c.94.94 2.48.94 3.42 0l3.58-3.58c.94-.94.94-2.48 0-3.42L9 5Z"/>
                <path d="M6 9.01V9"/>
                <path d="m15 5 6.3 6.3a2.4 2.4 0 0 1 0 3.4L17 19"/>
            </svg>
            <span style="line-height: 1; margin-top: 1px;">World Tags</span>
        `;

        const selectTrack = document.createElement('select');
        selectTrack.id = 'music-select';
        selectTrack.className = 'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group bg-gray-400 bg-clip-padding backdrop-filter backdrop-blur-md bg-opacity-20 border border-gray-500 hover:border-primary text-gray-300 h-9 rounded-md px-3';
        selectTrack.style.width = '100%';
        selectTrack.style.marginBottom = '5px';

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select Track';
        defaultOption.selected = true;
        defaultOption.disabled = true;
        selectTrack.appendChild(defaultOption);

        // Style for dropdown options
        const style = document.createElement('style');
        style.textContent = `
            #music-select option {
                color: #333;
                background-color: #fff;
            }
        `;
        document.head.appendChild(style);

        const buttonContainer = document.createElement('div');
        buttonContainer.id = 'music-manager-buttons';
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'space-between';
        buttonContainer.style.width = '100%';

        const toggleButton = document.createElement('button');
        toggleButton.id = 'music-manager-toggle';
        toggleButton.className = 'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group bg-gray-400 bg-clip-padding backdrop-filter backdrop-blur-md bg-opacity-20 border border-gray-500 hover:border-primary text-gray-300 h-9 rounded-md px-3';
        toggleButton.style.flex = '1';
        toggleButton.style.marginRight = '5px';

        this.updateToggleButtonState(toggleButton);

        const aiButton = document.createElement('button');
        aiButton.id = 'music-manager-ai';
        aiButton.className = 'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group bg-gray-400 bg-clip-padding backdrop-filter backdrop-blur-md bg-opacity-20 border border-gray-500 hover:border-primary text-gray-300 h-9 rounded-md px-3';
        aiButton.style.flex = '1';
        aiButton.style.display = 'flex';
        aiButton.style.alignItems = 'center';
        aiButton.style.justifyContent = 'center';
        aiButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" class="mr-2" style="margin-bottom: 2px;">
                <path d="M7.5 5.6L5 7l1.4-2.5L5 2l2.5 1.4L10 2 8.6 4.5 10 7 7.5 5.6zm12 9.8L22 14l-1.4 2.5L22 19l-2.5-1.4L17 19l1.4-2.5L17 14l2.5 1.4zM22 2l-2.5 1.4L17 2l1.4 2.5L17 7l2.5-1.4L22 7l-1.4-2.5L22 2zm-7.63 5.29c-.39-.39-1.02-.39-1.41 0L1.29 18.96c-.39.39-.39 1.02 0 1.41l2.34 2.34c.39.39 1.02.39 1.41 0L16.7 11.05c.39-.39.39-1.02 0-1.41l-2.33-2.35zm-1.03 5.49l-2.12-2.12 2.44-2.44 2.12 2.12-2.44 2.44z"/>
            </svg>
            <span style="line-height: 1;">AI</span>
        `;

        buttonContainer.appendChild(toggleButton);
        buttonContainer.appendChild(aiButton);

        // Create volume slider
        const volumeSlider = document.createElement('input');
        volumeSlider.id = 'music-manager-volume';
        volumeSlider.type = 'range';
        volumeSlider.min = '0';
        volumeSlider.max = '1';
        volumeSlider.step = '0.01';
        volumeSlider.value = '0.3758';
        volumeSlider.style.width = '100%';
        volumeSlider.style.marginTop = '5px';

        // Create lock checkbox
        const lockCheckbox = document.createElement('input');
        lockCheckbox.type = 'checkbox';
        lockCheckbox.id = 'music-manager-lock';
        lockCheckbox.style.marginRight = '5px';

        const lockLabel = document.createElement('label');
        lockLabel.htmlFor = 'music-manager-lock';
        lockLabel.textContent = 'Lock';
        lockLabel.style.fontSize = '12px';
        lockLabel.style.color = 'rgb(136, 136, 136)';
        lockLabel.style.lineHeight = '1.0';
        lockLabel.style.marginTop = '2px';

        const lockContainer = document.createElement('div');
        lockContainer.style.display = 'flex';
        lockContainer.style.width = '100%';
        lockContainer.style.marginTop = '5px';
        lockContainer.appendChild(lockCheckbox);
        lockContainer.appendChild(lockLabel);

        container.appendChild(excludeTagsButton);
        container.appendChild(selectTrack);
        container.appendChild(buttonContainer);
        container.appendChild(volumeSlider);
        container.appendChild(lockContainer);

        const feedbackLink = document.querySelector('a[href="/feedback"]');
        if (feedbackLink && feedbackLink.parentNode) {
            feedbackLink.parentNode.insertBefore(container, feedbackLink);
        }

        toggleButton.addEventListener('click', () => {
            const selectedTrack = selectTrack.value;
            if (this.currentTrack) {
                this.manuallyStopped = true;
                this.stop();
                this.updateToggleButtonState(toggleButton);
            } else if (selectedTrack) {
                this.play(selectedTrack);
            }
        });

        // Add event listener for lock checkbox
        lockCheckbox.addEventListener('change', (event) => {
            musicLocked = event.target.checked;
        });

        aiButton.addEventListener('click', async () => {
            aiButton.disabled = true;
            aiButton.innerHTML = `<!-- ellipsis icon by Free Icons (https://free-icons.github.io/free-icons/) -->
                <svg xmlns="http://www.w3.org/2000/svg" height="1em" fill="currentColor" viewBox="0 0 512 512">
                    <path d="M 512 256 Q 510.22222222222223 282.6666666666667 483.55555555555554 284.44444444444446 Q 456.8888888888889 282.6666666666667 455.1111111111111 256 Q 456.8888888888889 229.33333333333334 483.55555555555554 227.55555555555554 Q 510.22222222222223 229.33333333333334 512 256 L 512 256 Z M 284.44444444444446 256 Q 282.6666666666667 282.6666666666667 256 284.44444444444446 Q 229.33333333333334 282.6666666666667 227.55555555555554 256 Q 229.33333333333334 229.33333333333334 256 227.55555555555554 Q 282.6666666666667 229.33333333333334 284.44444444444446 256 L 284.44444444444446 256 Z M 28.444444444444443 284.44444444444446 Q 1.7777777777777777 282.6666666666667 0 256 Q 1.7777777777777777 229.33333333333334 28.444444444444443 227.55555555555554 Q 55.111111111111114 229.33333333333334 56.888888888888886 256 Q 55.111111111111114 282.6666666666667 28.444444444444443 284.44444444444446 L 28.444444444444443 284.44444444444446 Z" />
                </svg>
            `;
            try {
                await AI.musicSuggestion(true);
            } finally {
                aiButton.disabled = false;
                aiButton.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" class="mr-2" style="margin-bottom: 2px;">
                        <path d="M7.5 5.6L5 7l1.4-2.5L5 2l2.5 1.4L10 2 8.6 4.5 10 7 7.5 5.6zm12 9.8L22 14l-1.4 2.5L22 19l-2.5-1.4L17 19l1.4-2.5L17 14l2.5 1.4zM22 2l-2.5 1.4L17 2l1.4 2.5L17 7l2.5-1.4L22 7l-1.4-2.5L22 2zm-7.63 5.29c-.39-.39-1.02-.39-1.41 0L1.29 18.96c-.39.39-.39 1.02 0 1.41l2.34 2.34c.39.39 1.02.39 1.41 0L16.7 11.05c.39-.39.39-1.02 0-1.41l-2.33-2.35zm-1.03 5.49l-2.12-2.12 2.44-2.44 2.12 2.12-2.44 2.44z"/>
                    </svg>
                    <span style="line-height: 1;">AI</span>
                `;
            }
        });

        excludeTagsButton.addEventListener('click', () => {
            this.showIncludeTagsDialog();
        });

        volumeSlider.addEventListener('input', (event) => {
            this.setVolume(parseFloat(event.target.value));
        });

        selectTrack.addEventListener('change', (event) => {
            const selectedTrack = event.target.value;
            if (selectedTrack) {
                if (this.currentTrack) {
                    this.play(selectedTrack);
                }
                // Update the selected track in the dropdown
                this.selectTrack.value = selectedTrack;
                // Save the current selection to local storage
                const currentWorldId = this.getCurrentWorldId();
                console.log('Saving last selected track', selectedTrack, 'for', currentWorldId);
                chrome.storage.local.set({ [`lastSelectedTrack_${currentWorldId}`]: selectedTrack });
            }
        });

        this.selectTrack = selectTrack;

        // Load excluded tags from storage
        this.loadIncludedTags();

        // Start interval to check for world changes
        setInterval(() => {
            const currentWorldId = this.getCurrentWorldId();
            if (currentWorldId !== this.currentWorld) {
                this.currentWorld = currentWorldId;
                this.loadIncludedTags();
                // Here you would also load new tags for the current world
                // For example: this.loadTagsForWorld(currentWorldId);
            }
        }, 5000); // Check every 5 seconds

        this.loadTags();
    }

    async loadTrack(name) {
        if (this.tracks.has(name)) {
            return this.tracks.get(name);
        }

        const trackInfo = this.trackList.get(name);
        if (!trackInfo) {
            throw new Error(`Track "${name}" not found in track list`);
        }

        const url = `https://www.insightengine.online/wp-content/uploads/tabletop_audio/${trackInfo.file}.mp3`;

        try {
            // Request the audio data from the background script
            const response = await chrome.runtime.sendMessage({ action: 'fetchAudio', url: url });
            
            if (response.error) {
                throw new Error(response.error);
            }

            // Decode the base64 data
            const base64Data = response.data.buffer;
            const binaryString = atob(base64Data);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            
            // Create an audio buffer from the decoded data
            const audioBuffer = await this.audioContext.decodeAudioData(bytes.buffer);

            // Create a gain node for volume control
            const gainNode = this.audioContext.createGain();

            // Connect the gain node to the master gain node
            gainNode.connect(this.masterGainNode);

            // Store the audio buffer and gain node in the tracks map
            const track = { audioBuffer, gainNode };
            this.tracks.set(name, track);

            return track;
        } catch (error) {
            butterup.toast({
                title: 'Music Error',
                message: 'Downloading music track failed.',
                location: 'bottom-left',
                icon: false,
                dismissable: true,
                type: 'error',
            });
            console.error(`Failed to load track "${name}" from ${url}:`, error);
            throw error;
        }
    }

    async play(name) {
        this.manuallyStopped = false;
        try {
            const toggleButton = document.getElementById('music-manager-toggle');
            if (toggleButton) {
                toggleButton.disabled = true;
                toggleButton.innerHTML = `<!-- ellipsis icon by Free Icons (https://free-icons.github.io/free-icons/) -->
<svg xmlns="http://www.w3.org/2000/svg" height="1em" fill="currentColor" viewBox="0 0 512 512">
  <path d="M 512 256 Q 510.22222222222223 282.6666666666667 483.55555555555554 284.44444444444446 Q 456.8888888888889 282.6666666666667 455.1111111111111 256 Q 456.8888888888889 229.33333333333334 483.55555555555554 227.55555555555554 Q 510.22222222222223 229.33333333333334 512 256 L 512 256 Z M 284.44444444444446 256 Q 282.6666666666667 282.6666666666667 256 284.44444444444446 Q 229.33333333333334 282.6666666666667 227.55555555555554 256 Q 229.33333333333334 229.33333333333334 256 227.55555555555554 Q 282.6666666666667 229.33333333333334 284.44444444444446 256 L 284.44444444444446 256 Z M 28.444444444444443 284.44444444444446 Q 1.7777777777777777 282.6666666666667 0 256 Q 1.7777777777777777 229.33333333333334 28.444444444444443 227.55555555555554 Q 55.111111111111114 229.33333333333334 56.888888888888886 256 Q 55.111111111111114 282.6666666666667 28.444444444444443 284.44444444444446 L 28.444444444444443 284.44444444444446 Z" />
</svg>`;
            }

            const newTrack = await this.loadTrack(name);
            const { audioBuffer, gainNode } = newTrack;

            if (toggleButton) {
                toggleButton.disabled = false;
            }

            // Create a new AudioBufferSourceNode
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.loop = true;
            source.connect(gainNode);

            // Cancel any ongoing fades
            gainNode.gain.cancelScheduledValues(this.audioContext.currentTime);

            if (this.currentTrack) {
                // Crossfade
                const oldTrack = this.tracks.get(this.currentTrack.name);
                const oldGainNode = oldTrack.gainNode;
                const oldSource = this.currentTrack.source;

                // Ensure the old track is still playing
                if (oldSource.playbackState === oldSource.PLAYING_STATE) {
                    oldGainNode.gain.setValueAtTime(oldGainNode.gain.value, this.audioContext.currentTime);
                    oldGainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + this.fadeTime);

                    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
                    gainNode.gain.linearRampToValueAtTime(this.volume, this.audioContext.currentTime + this.fadeTime);

                    source.start(0);

                    // Schedule the old track to stop after fade out
                    oldSource.stop(this.audioContext.currentTime + this.fadeTime);
                } else {
                    // If old track isn't playing, start new track immediately
                    gainNode.gain.setValueAtTime(this.volume, this.audioContext.currentTime);
                    source.start(0);
                }
            } else {
                // Fade in
                gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
                gainNode.gain.linearRampToValueAtTime(this.volume, this.audioContext.currentTime + this.fadeTime);
                source.start(0);
            }

            this.currentTrack = { name, source, gainNode, startTime: Date.now() };
            this.updateToggleButtonState();

            // Update the selected track in the dropdown
            if (this.selectTrack) {
                this.selectTrack.value = name;
            }

            // Save the current selection to local storage
            const currentWorldId = this.getCurrentWorldId();
            console.log('Saving last selected track', name, 'for', currentWorldId);
            chrome.storage.local.set({ [`lastSelectedTrack_${currentWorldId}`]: name });
        } catch (error) {
            console.error(`Failed to play track "${name}":`, error);
            if (toggleButton) {
                toggleButton.disabled = false;
            }
        }
    }

    stop() {
        if (this.currentTrack) {
            const { source, gainNode } = this.currentTrack;
            const fadeOutTime = 1; // 1 second fade out when stopping manually

            // Cancel any ongoing fades
            gainNode.gain.cancelScheduledValues(this.audioContext.currentTime);

            gainNode.gain.setValueAtTime(gainNode.gain.value, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + fadeOutTime);
            
            source.stop(this.audioContext.currentTime + fadeOutTime);

            this.currentTrack = null;
            this.updateToggleButtonState();

            // Ensure the toggle button is enabled
            const toggleButton = document.getElementById('music-manager-toggle');
            if (toggleButton) {
                toggleButton.disabled = false;
            }
        }
    }

    setVolume(volume) {
        this.volume = volume;
        this.masterGainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
    }

    addTrack(trackInfo) {
        if (!this.selectTrack) {
            console.warn('selectTrack element is not initialized');
            return;
        }
        this.trackList.set(trackInfo.title, trackInfo);
        const option = document.createElement('option');
        option.value = trackInfo.title;
        option.textContent = trackInfo.title;
        this.selectTrack.appendChild(option);
    }

    async loadTags() {
        try {
            const currentWorldId = this.getCurrentWorldId();
            const currentlySelectedTrack = this.selectTrack.value;
            const response = await fetch(chrome.runtime.getURL('tabletop-audio.json'));
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            this.trackList.clear();
            this.selectTrack.innerHTML = ''; // Clear existing options
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'Select Track';
            defaultOption.disabled = true;
            this.selectTrack.appendChild(defaultOption);
            // Create a temporary array to hold all valid tracks
            const validTracks = data.filter(track => track.tags.some(tag => this.includedTags.has(tag)) || this.includedTags.size === 0)
                .map(track => {
                    const combinedTags = [...track.tags, ...track.keys].filter(tag => tag.toLowerCase() !== 'music');
                    return {
                        title: track.title,
                        tags: combinedTags,
                        keys: track.keys,
                        description: track.description,
                        file: track.file
                    };
                });

            // Sort the validTracks array alphabetically by title
            validTracks.sort((a, b) => a.title.localeCompare(b.title));

            // Add sorted tracks to trackList and UI
            validTracks.forEach(trackInfo => {
                this.trackList.set(trackInfo.title, trackInfo);
                this.addTrack(trackInfo);
            });

            // Collect all unique tags
            this.tags = [...new Set(data.flatMap(track => [...track.tags]).filter(tag => tag.toLowerCase() !== 'music'))];
            
            // Get the last selected track for this world from local storage
            chrome.storage.local.get(`lastSelectedTrack_${currentWorldId}`, (result) => {
                const lastSelectedTrack = result[`lastSelectedTrack_${currentWorldId}`];
                console.log('lastSelectedTrack', lastSelectedTrack, 'for', currentWorldId);
                
                // Set the track selection
                if (this.trackList.has(currentlySelectedTrack)) {
                    this.selectTrack.value = currentlySelectedTrack;
                } else if (lastSelectedTrack && this.trackList.has(lastSelectedTrack)) {
                    this.selectTrack.value = lastSelectedTrack;
                } else {
                    this.selectTrack.value = ''; // Set to default if no valid selection
                }

                // Save the current selection to local storage
                chrome.storage.local.set({ [`lastSelectedTrack_${currentWorldId}`]: this.selectTrack.value });
            });

            // Store the filtered JSON
            this.filteredTracks = validTracks;
        } catch (error) {
            console.error('Error loading tabletop-audio.json:', error);
        }
    }

    showIncludeTagsDialog() {
        let dialogContent = '<form id="includeTagsForm" class="formName" style="text-align: left;">';
        dialogContent += '<div style="display: flex; flex-wrap: wrap; justify-content: flex-start;">';
        this.tags.forEach(tag => {
            dialogContent += `
                <div class="form-group" style="margin-right: 10px; margin-bottom: 5px;">
                    <label style="display: flex; align-items: center;">
                        <input type="checkbox" value="${tag}" ${this.includedTags.has(tag) ? 'checked' : ''} style="margin-right: 5px;">
                        ${tag}
                    </label>
                </div>`;
        });
        dialogContent += '</div></form>';

        $.confirm({
            title: 'World Tags',
            content: dialogContent,
            boxWidth: '300px',
            useBootstrap: false,
            buttons: {
                save: {
                    text: 'Save',
                    btnClass: 'btn-default',
                    action: function () {
                        this.includedTags.clear();
                        document.querySelectorAll('#includeTagsForm input[type="checkbox"]:checked').forEach((checkbox) => {
                            this.includedTags.add(checkbox.value);
                        });
                        this.saveincludedTags();
                        this.loadTags(); // Reload tags to apply the new inclusions
                    }.bind(this)
                },
                cancel: function () {
                    // Do nothing, just close the dialog
                }
            }
        });
    }

    saveincludedTags() {
        const worldId = this.getCurrentWorldId();
        const storageKey = `includedTags_${worldId}`;
        const includedTagsArray = Array.from(this.includedTags);
        chrome.storage.local.set({ [storageKey]: includedTagsArray }, () => {
            console.log('Included tags saved');
            this.loadTags(); // Reload tags after saving included tags
        });
    }

    loadIncludedTags() {
        const worldId = this.getCurrentWorldId();
        const storageKey = `includedTags_${worldId}`;
        chrome.storage.local.get([storageKey], (result) => {
            if (result[storageKey]) {
                this.includedTags = new Set(result[storageKey]);
                console.log('Included tags loaded');
                this.loadTags(); // Reload tags after loading included tags
            }
        });
    }

    getCurrentWorldId() {
        const match = window.location.href.match(/\/([^\/]+)\/play/);
        return match ? match[1] : '';
    }

    async queueSuggestion(chosenTrack) {
        return new Promise((resolve, reject) => {
            const timeout = 5000; // 5 seconds
            let timer;

            const toast = butterup.toast({
                title: 'New Music Suggestion',
                message: `"${chosenTrack}" will play in 5 seconds.`,
                location: 'bottom-center',
                icon: 'music',
                dismissable: true,
                type: 'info',
                primaryButton: {
                    text: 'Play Now',
                    onClick: () => {
                        clearTimeout(timer);
                        MUSIC.play(chosenTrack);
                        const toastElement = document.querySelector('#butterupRack li');
                        if (toastElement) { toastElement.click(); }
                        resolve();
                    }
                },
                secondaryButton: {
                    text: 'Cancel',
                    onClick: () => {
                        clearTimeout(timer);
                        const toastElement = document.querySelector('#butterupRack li');
                        if (toastElement) { toastElement.click(); }
                        reject('User cancelled the suggestion');
                    }
                },
                onDismiss: () => {
                    reject('Toast was dismissed');
                }
            });

            timer = setTimeout(() => {
                const toastElement = document.querySelector('#butterupRack li');
                if (toastElement) { toastElement.click(); }
                MUSIC.play(chosenTrack);
                resolve();
            }, timeout);
        });
    }
}

// OBSERVERS

class ObserverManager {
    constructor() {
    }

    checkOverflowHiddenWidth(width) {
        const button = document.getElementById('ttsToggleButton');
        const micButton = document.getElementById('micToggle');
        if (button) {
            button.closest('div').style.width = (width == 40 ? 'auto' : (width + 'px'));
        }
        if (micButton) {
            micButton.style.right = (55 + 20 - width/2) + 'px';
        }
    }
    
    checkOverflowHiddenOpacity(opacity) {
        const button = document.getElementById('ttsToggleButton');
        if (button) {
            button.closest('div').style.opacity = opacity;
        }
    }
    
    observeOverflowHidden() {
        const targetElement = document.querySelector('.lucide-dice3');
        const closestButton = targetElement.closest('button');
        const closestDiv = closestButton ? closestButton.closest('div') : null;
    
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const width = entry.contentRect.width;
                this.checkOverflowHiddenWidth(width);
            }
        });
    
        const mutationObserver = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    const opacity = window.getComputedStyle(closestDiv).opacity;
                    this.checkOverflowHiddenOpacity(opacity);
                }
            });
        });
    
        if (closestDiv) {
            resizeObserver.observe(closestDiv);
            mutationObserver.observe(closestDiv, { attributes: true, attributeFilter: ['style'] });
        } else {
            console.error('Could not find appropriate div to observe');
        }
    }

    observeBackgroundImage() {
        const backgroundObserver = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE && node.querySelector('img[alt="location"][width="300"]')) {
                            console.log('setting background image', node.src);
                            setTimeout(() => {
                                UI.updateBackgroundImage();
                            }, 1000);
                        }
                    });
                }
            });
        });

        backgroundObserver.observe(document.body, { childList: true, subtree: true });
    }

    observeURLChanges() {
        let lastUrl = location.href;
        
        const urlObserver = new MutationObserver(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                console.log('URL changed to:', lastUrl);
                
                // Perform actions when URL changes
                this.handleURLChange(lastUrl);
            }
        });

        const config = { subtree: true, childList: true };
        urlObserver.observe(document, config);
    }

    handleURLChange(newUrl) {
        TTS.stopPlayback();
        STT.stopRecording();
        if (ttsEnabled) {
            if (!newUrl.endsWith('/play')) {
                if (TTS.cartesiaConnection) {
                    TTS.cartesiaConnection.closeConnection();
                    TTS.cartesiaConnection = null;
                    cartesiaConnected = false;
                    console.log('cartesiaConnection closed');
                }
            }
            const targetDiv = document.querySelector('.flex.flex-row.items-center.overflow-hidden');
            if (targetDiv) {
                UI.addTTSToggleButton();
                if (cartesiaConnected) {
                    UI.updateTTSToggleButton();
                    audioContext = null;
                    TTS.initializeTTS();
                    if (CAMPAIGN.characters.length > 0) {
                        CAPTION.prepareAllTexts();
                    }
                }
            }
        }
    }

    observeNewMessages() {
        let lastOwnMessageTime = 0;
        let ownMessageCount = 0;
        let debounceTimer = null;
    
        const processNewMessage = async (node) => {
            console.log('Processing new message', node);
            if (cartesiaConnected) {
                UI.addPlayButtons(node);
            }
    
            const isPlayerMessage = !node.querySelector('div.font-bold.md\\:text-lg')?.textContent.includes('Franz');
    
            const currentTime = Date.now();
            if (isPlayerMessage) {
                if (currentTime - lastOwnMessageTime > 3000) {
                    ownMessageCount = 1;
                } else {
                    ownMessageCount++;
                }
                lastOwnMessageTime = currentTime;
            } else {
                ownMessageCount = 0;
            }
    
            console.log('Message type:', isPlayerMessage ? 'own' : 'not own', 'ownMessageCount:', ownMessageCount);
    
            if (!isPlayerMessage && openaiApiKey && enableStoryEditor && disallowedElements && revisions < maxRevisions && !CAMPAIGN.isEncounter()) {
                console.log('Story editor is enabled, halting auto-play');
                const container = node.querySelector('.rounded-md');
                if (container) {
                    UI.addOverlay(container);
                    setTimeout(function() {
                        if (container) { UI.removeOverlay(container); }
                    }, 10000);
                    
                    try {
                        const feedback = await EDITOR.storyEditor(node);
                        if (feedback) {
                            console.log('Story editor submitted feedback, aborting message processing');
                            revisions++;
                            return; // Abort processing as the message will be regenerated
                        }
                    } catch (error) {
                        console.error('Error in story editor:', error);
                    }
                }
            }

            revisions = 0; // Reset revisions count for new messages

            if (!isPlayerMessage) {
                lastRevised = false;
                //console.log('Debounce triggered: All messages have stopped coming in', autoSelectMusic, MUSIC.manuallyStopped);
                if (autoSelectMusic && openaiApiKey && !MUSIC.manuallyStopped && !musicLocked) {
                    AI.musicSuggestion();
                }
            }

            console.log('CAMPAIGN.isEncounter()',CAMPAIGN.isEncounter());
            console.log('cartesiaConnected',cartesiaConnected);
            console.log('autoPlayNew',autoPlayNew);
            console.log('autoPlayOwn',autoPlayOwn);
            console.log('ownMessageCount',ownMessageCount);
            if (cartesiaConnected && !CAMPAIGN.isEncounter() && ((!isPlayerMessage && autoPlayNew) || (isPlayerMessage && autoPlayOwn && ownMessageCount >= 2))) {
                if (currentlyPlaying) {
                    console.log('Queueing message');
                    TTS.queueMessage(node);
                } else {
                    console.log('Playing message immediately');
                    TTS.playMessage(node);
                }
            }
        };
    
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE && 
                            node.matches('div.grid.grid-cols-\\[25px_1fr_10px\\].md\\:grid-cols-\\[40px_1fr_30px\\].pb-4.relative') &&
                            node.querySelector('.text-base') && node.querySelector('div.font-bold.md\\:text-lg')) {
                            const matchingNodes = document.querySelectorAll('div.grid.grid-cols-\\[25px_1fr_10px\\].md\\:grid-cols-\\[40px_1fr_30px\\].pb-4.relative');
                            if (node === matchingNodes[matchingNodes.length - 1]) {
                                processNewMessage(node);
                            }
                        }
                    });
                }
            });
        });
    
        observer.observe(document.body, { childList: true, subtree: true });
    }
}

// AI

class AIManager {
    constructor() {
        this.suggestionPrompt = `You are an AI assistant tasked with selecting appropriate background music for a roleplay scene. You will be provided with a description of the current scene, the current track playing (if any), and a library of available music tracks. Your goal is to determine whether the current track is suitable or if a new track should be selected.

First, here is the library of available music tracks:
<music_library>
{{MUSIC_LIBRARY}}
</music_library>

Now, here is a message history in which to determine the scene and appropriate music in the roleplay:
<message_history>
{{MESSAGE_HISTORY}}
</message_history>

This is the latest message, which is most relevant to the current scene:
<current_message>
{{CURRENT_MESSAGE}}
</current_message>

The current track playing (if any) is:
<current_track>
{{CURRENT_TRACK}}
</current_track>

The current track (if any) started playing this long ago:
<current_track_start>
{{CURRENT_TRACK_START}}
</current_track_start>

To select the appropriate background music, follow these steps:

1. Analyze the current scene:
   - Identify the mood, tone, and atmosphere of the scene
   - Consider any specific actions or events taking place
   - Note any cultural or historical context that might influence music choice
   - Ensure the music fits the overall theme and setting of the world (e.g., fantasy, sci-fi, historical)
   - The music should fit the location of the scene (e.g., tavern, battlefield, forest)
   - For example, "alchemist's lab" is a bad choice for a tavern

2. Evaluate the current track (if one is playing):
   - Determine if the current track is suitable for the mood and atmosphere of the scene
   - Consider if the track enhances or at least doesn't detract from the scene's impact
   - Assess if the track's tempo and intensity are appropriate for the action
   - Verify that the track aligns with the world's theme (e.g., avoid modern music in a medieval fantasy setting)

3. Consider the time elapsed since the current track started:
   - If the current track has been playing for less than 10 minutes, there must be an extremely compelling reason to change it
   - Even after 10 minutes, only consider changing if the scene has shifted dramatically

4. If the current track is clearly unsuitable:
   - Review the music library for tracks that better suit the scene and world theme
   - Consider tracks that match the identified mood, tone, and atmosphere
   - Look for music that complements the action without overpowering it
   - Take into account any cultural or historical context
   - Ensure the selected track is appropriate for the world's setting (e.g., no 1920s speakeasy jazz in a high fantasy world)

5. Make your decision:
   - Default to keeping the current track unless there's an absolutely necessary reason to change
   - Only if the current track is entirely inappropriate AND has been playing for a significant amount of time (>10 minutes), OR if there's a drastic change in the scene (e.g., sudden transition from peaceful tavern to intense battle), consider selecting a new track

6. Consider the impact of changing tracks:
   - Changing tracks should be a rare occurrence, not the norm
   - Only recommend a track change if the benefits significantly outweigh the potential disruption
   - If there's any doubt, always keep the current track
   - Avoid changing tracks for subtle shifts in mood or minor scene changes

7. Final check:
   - If the track has been playing for less than 5 minutes, do not change it unless there's an extreme shift in the scene (e.g., from calm to combat)
   - If considering a change, ask yourself: "Is this change absolutely necessary, or can the current track still work?"
   - Remember that consistency in background music is often more important than perfect thematic matching
   - Double-check that the chosen track (whether new or current) fits the world's theme and doesn't create anachronisms or thematic inconsistencies

Provide your response in the following format:
<music_selection>
<reasoning>
[Explain your decision, including why the chosen track (or current track, if kept) is appropriate for the scene. If changing tracks, explain why the current track was not suitable.]
</reasoning>
<decision>[Keep current track/Change track]</decision>
<chosen_track>[Title of chosen track, or "None" if keeping current track]</chosen_track>
</music_selection>

Remember, your goal is to enhance the roleplay experience by selecting music that complements the scene. Make your decision based on the scene description, the current track (if any), and the available options in the music library.`;
        this.editorPrompt = `You are a story editor tasked with identifying disallowed elements in a story excerpt. Follow these instructions carefully:

1. First, review the list of disallowed tropes, events, objects, and other story elements:
<disallowed_list>
{{DISALLOWED_LIST}}
</disallowed_list>

2. Now, carefully read the following story excerpt:
<story_excerpt>
{{STORY_EXCERPT}}
</story_excerpt>

3. Analyze the story excerpt thoroughly, comparing it against the list of disallowed elements. Consider each sentence and phrase carefully, looking for any mentions or implications of items from the disallowed list.

4. For each disallowed element you identify in the story excerpt:
   a. Enclose the disallowed element or phrase in <disallowed></disallowed> tags, without the negatives such as "do not" or "don't" or "not".
   for example: 
   <disallowed>
   The story contains windmills.
   </disallowed>

5. Format your response as follows:
   <analysis>
   [Quotes from original text with disallowed elements marked]
   </analysis>

6. If you find no disallowed elements in the story excerpt, state this clearly within the <analysis> tags.

Remember, your task is solely to identify elements that appear on the disallowed list. Do not editorialize based on your own judgments or ethics. Focus only on the specific instructions and lists provided.`;
        this.speakerPrompt = `You will be given an excerpt from a story. Your task is to identify ALL character dialog within the excerpt and add the character's name in brackets just before their dialog. Here's how to proceed:

1. Read the following story excerpt carefully:
<story_excerpt>
{{STORY_EXCERPT}}
</story_excerpt>

2. Identify ALL instances of character dialog within the excerpt. Do not miss any dialog, even if it's brief or seems insignificant.

3. For each piece of dialog, determine which character is speaking.

4. Add the character's full name enclosed in square brackets, immediately before their dialog.
   Optionally, include emotions with their levels if appropriate for the dialog.

5. A list of potential character names is provided below. If the character's name is not in the list, use the first name only.
<character_list>
Narrator/Game Master
{{CHARACTER_LIST}}
</character_list>

6. Present each line of dialog on a new line, starting with the character's name in brackets.

7. Include ONLY the dialog lines in your output. Do not include any narrative text or descriptions.

8. Do not omit any dialog, regardless of length or perceived importance.

# Emotions (Optional)

All emotion tag levels _add_ the specified emotion to the voice. They _don't_ reduce or remove emotions, but rather add them in varying intensities.

## Emotion Names: (these are the only emotions that can be used)

    anger
    positivity
    surprise
    sadness
    curiosity

## Emotion Levels:

    lowest: Slight addition of the emotion
    low: Mild addition of the emotion
    (omit level for moderate addition of the emotion)
    high: Strong addition of the emotion
    highest: Maximum addition of the emotion

## Example:

[character_name, curiosity, positivity:high, surprise:low]

In this example, the dialog is expressed with:

    High positivity
    Medium curiosity (level omitted)
    Low surprise

Here's an example of how your output should be formatted:

[character_name, positivity:high, curiosity, surprise:low] "This is an example of character dialog."
[another_character] "This is a response from another character."
[character_name, anger:low] "Even a short reply like 'Yes' or 'No' should be included."

Remember:
- Maintain the original punctuation and formatting of the dialog itself.
- Be sure to spell character names correctly. Use the matching name from the character list if possible, otherwise use the first name only.
- Double-check that you've included ALL dialog from the excerpt, no matter how brief.
- Include emotions only if they are clearly implied or stated in the text.
- Your task is complete only when you have identified and formatted ALL dialog in the excerpt as instructed.
- Do NOT include any narration or non-dialog text in your output.
- dialog will always have quotation marks around it.
- Only the emotions listed above are allowed.
- If it's not clear who the dialog is from, assume it's the Narrator/Game Master.

# EXTREMELY IMPORTANT:
- You must, absolute, always, without exception ** ONLY ** include dialog that is enclosed in quotation marks, not the connecting parts, or any narrative text, or any dialog outside of quotation marks.

# Example of BAD output:

<bad_answer>
[Yelina Black, curiosity] "Aelar Virrel III," she says, her voice low and smooth. "What brings you to Ezra's Tavern tonight?"
</bad_answer>

# Example of GOOD output:

<good_answer>
[Yelina Black, curiosity] "Aelar Virrel III,"
[Yelina Black, curiosity:high] "What brings you to Ezra's Tavern tonight?"
</good_answer>

These are examples for your learning how to respond, you will be tasked with filling out the <answer></answer> using dialog from the story excerpt.

Remember, any dialog outside of quotation marks should be ignored. This is extremely important, we only want dialog that is enclosed in quotation marks.

Ignore "What would you like to do next, [NAME]" that often appears at the end of excerpts.

Do not join multiple dialog lines into one, even if one ends in a comma, or if they are separated by only a few words of narration. They must be placed on separate lines with character names in brackets, in the ** exact ** quotes they were in the original text.

<bad_answer>
Original text: "Ah, Inspector Wimbolt, this is Leo, the young paladin from the Royal Palace," Miss Evelyn Train introduces you. "He's offered to help us investigate the recent incidents."
[Miss Evelyn Train] "Ah, Inspector Wimbolt, this is Leo, the young paladin from the Royal Palace. He's offered to help us investigate the recent incidents."
</bad_example>

<good_answer>
Original text: "Ah, Inspector Wimbolt, this is Leo, the young paladin from the Royal Palace," Miss Evelyn Train introduces you. "He's offered to help us investigate the recent incidents."
[Miss Evelyn Train] "Ah, Inspector Wimbolt, this is Leo, the young paladin from the Royal Palace,"
[Miss Evelyn Train] "He's offered to help us investigate the recent incidents."
</good_answer>

These are examples for your learning how to respond, you will be tasked with filling out the <answer></answer> using dialog from the story excerpt.

## This is very important. All your dialog needs to exactly match the original text without abridging, joining together, or changing any punctuation or capitalization.

Please provide your answer within <answer> tags.`;
    }
    
    async runAI(systemMessage, userMessage) {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'runAI',
                apiKey: openaiApiKey,
                model: openaiModel,
                systemMessage: systemMessage,
                userMessage: userMessage
            });
            
            if (response.error) {
                throw new Error(response.error);
            }
            
            return response.data;
        } catch (error) {
            const errorMessage = error.message || 'An unknown error occurred';
            butterup.toast({
                title: 'FableVoice AI Error',
                message: errorMessage,
                location: 'bottom-left',
                icon: false,
                dismissable: true,
                type: 'error',
            });
            console.error('Error running AI:', error);
            throw error;
        }
    }

    async storyEditor(text) {
        let systemMessage = this.editorPrompt;
        const franzMessage = text;
        let disallowedCopy = disallowedElements;
        if (UTILITY.mode == 'relaxed') {
            disallowedCopy = disallowedElements + "```.\n\n # Additionally, I'd like a relaxed story that does not contain any of these elements: ```" + disallowedRelaxed;
        }
        //systemMessage = systemMessage.replace('{{WORLD_DESCRIPTION}}', CAMPAIGN.worldDescription ? CAMPAIGN.worldDescription : (MUSIC.includedTags.size > 0 ? Array.from(MUSIC.includedTags).join(', ') : ''));
        systemMessage = systemMessage.replace('{{DISALLOWED_LIST}}', disallowedCopy);
        systemMessage = systemMessage.replace('{{STORY_EXCERPT}}', franzMessage);
        const feedback = await this.runAI(systemMessage, 'Please analyze the story excerpt for disallowed elements.');
        console.log('systemMessage', systemMessage, 'feedback', feedback);
        if (!feedback) {
            return false;
        }
        // Extract disallowed elements from the suggestion
        const disallowedMatches = feedback.match(/<disallowed>(.*?)<\/disallowed>/gs);
        
        if (disallowedMatches) {
            let disallowedFound = disallowedMatches.map(match => 
                match.replace(/<\/?disallowed>/g, '').trim()
            );
            
            // Remove duplicates
            disallowedFound = [...new Set(disallowedFound)];
            
            console.log('disallowedFound:', disallowedFound);

            UI.updateOverlay('Refining narrative elements... (' + disallowedFound.length + ' found)');

            let editorMessage = "Franz, please change your reply.\n\nHere are things I do not want in the story: ```" + disallowedCopy + "```.\n\nHere is specifically what you did that I ** do not ** want: ```" + disallowedFound.join(', ') + "``` Please do not mention the mistake or apologize, just rewrite the response to either avoid these elements or replace them with suitable alternatives, then providing your response without commenting that you made changes.";
            return editorMessage;
        }

        return false;
    }

    async speakerIdentify(text) {
        let systemMessage = this.speakerPrompt;
        systemMessage = systemMessage.replace('{{STORY_EXCERPT}}', text);
        const characterList = CAMPAIGN.characters.map(character => character.name).join('\n');
        systemMessage = systemMessage.replace('{{CHARACTER_LIST}}', characterList);
        const dialog = await this.runAI(systemMessage, 'Please identify the character dialog and return the dialog only as in instructions.');
        console.log('dialog', dialog);
        if (!dialog || typeof dialog !== 'string') {
            console.error('Invalid dialog:', dialog);
            return false;
        }
        const match = dialog.match(/<answer>([\s\S]*?)<\/answer>/);
        if (match) {
            return match[1].trim();
        }
        console.warn('No <answer> tags found in dialog:', dialog);
        return dialog.trim();
    }
    
    async musicSuggestion(manual = false) {
        let addedAiNotes = '';
        if (manual) {
            addedAiNotes = await new Promise((resolve) => {
                $.confirm({
                    title: 'Enhance Your Scene',
                    content: '<form action="" class="music-suggestion-form">' +
                             '<div class="form-group">' +
                             '<label>Any musical preferences?</label>' +
                             '<textarea class="music-notes form-control" rows="2" placeholder="e.g. calm, energetic, mysterious... (optional)"></textarea>' +
                             '</div></form>',
                    boxWidth: '320px',
                    useBootstrap: false,
                    buttons: {
                        suggest: {
                            text: 'Suggest',
                            btnClass: 'btn-default',
                            action: function () {
                                resolve(this.$content.find('.name').val());
                            }
                        },
                        cancel: function () {
                            resolve('cancelled');
                        },
                    },
                    onContentReady: function () {
                        this.$content.find('form').on('submit', function (e) {
                            e.preventDefault();
                            this.$$suggest.trigger('click');
                        }.bind(this));
                    }
                });
            });
            if (addedAiNotes === 'cancelled') {
                return;
            }
        }
        // get current world context
        const messageDivs = document.querySelectorAll('div.grid.grid-cols-\\[25px_1fr_10px\\].md\\:grid-cols-\\[40px_1fr_30px\\].pb-4.relative');
        let messageList = [];
        let messageCount = 8;
        for (let i = messageDivs.length - 1; i >= 0 && messageCount > 0; i--) {
            const message = messageDivs[i].querySelector('p.text-base');
            if (message) {
                messageList.unshift('Message #' + messageCount + ': ' + message.textContent);
                messageCount--;
            }
        }
        const messages = messageList.join('\n');

        const tracks = MUSIC.filteredTracks;
        // Clean up the tracks JSON by removing "file" and "tags" properties
        const filteredTracks = tracks.map(({ file, tags, ...rest }) => rest);
        const filteredJSON = JSON.stringify(filteredTracks);

        console.log('filteredJSON', filteredJSON);

        const currentTrack = MUSIC.currentTrack ? MUSIC.currentTrack.name : 'None';

        let systemMessage = this.suggestionPrompt;

        systemMessage = systemMessage.replace('{{MUSIC_LIBRARY}}', filteredJSON);
        systemMessage = systemMessage.replace('{{MESSAGE_HISTORY}}', messages);
        systemMessage = systemMessage.replace('{{CURRENT_MESSAGE}}', messageList[messageList.length - 1]);
        systemMessage = systemMessage.replace('{{CURRENT_TRACK}}', MUSIC.currentTrack ? MUSIC.currentTrack.name : 'None');
        
        const formatTime = (seconds) => {
            if (seconds < 60) return `${Math.floor(seconds)} seconds ago`;
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = Math.floor(seconds % 60);
            if (remainingSeconds === 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
            return `${minutes} minute${minutes > 1 ? 's' : ''} ${remainingSeconds} second${remainingSeconds > 1 ? 's' : ''} ago`;
        };

        systemMessage = systemMessage.replace('{{CURRENT_TRACK_START}}', MUSIC.currentTrack ? formatTime((Date.now() - MUSIC.currentTrack.startTime) / 1000) : 'None');

        console.log('systemMessage', systemMessage);

        let startMessage = 'Please suggest a track for the current scene.';
        if (manual && MUSIC.currentTrack) {
            startMessage = 'I do not want the current track. Please suggest a new track for the current scene.';
        }
        
        let userMessage = startMessage + (musicAiNotes ? (' ' + musicAiNotes) : '');
        if (addedAiNotes) {
            userMessage = userMessage + ' - ' + addedAiNotes;
        }
        userMessage = userMessage.replace(/\s{2,}/g, ' ');
        console.log('userMessage', userMessage);
        const suggestion = await this.runAI(systemMessage, userMessage);
        console.log('suggestion', suggestion);

        let chosenTrack = '';
        let trackFile = '';
        const match = suggestion.match(/<chosen_track>(.*?)<\/chosen_track>/);
        if (match) {
            chosenTrack = match[1].trim();
            console.log('Extracted track:', chosenTrack);
            if (MUSIC.trackList.has(chosenTrack)) {
                trackFile = MUSIC.trackList.get(chosenTrack).file;
                console.log('Track found in the tracks map');
            } else {
                // Check if chosenTrack is already a file name
                const trackEntry = Array.from(MUSIC.trackList.entries()).find(([_, trackInfo]) => trackInfo.file === chosenTrack);
                if (trackEntry) {
                    chosenTrack = trackEntry[0];
                    trackFile = trackEntry[1].file;
                    console.log('Track found in the suggestion');
                } else {
                    console.log('No track found in the suggestion');
                    trackFile = '';
                }
            }
        } else {
            console.log('No track found in the suggestion');
        }

        console.log('chosenTrack', chosenTrack);
        console.log('trackFile', trackFile);
        console.log('currentTrack', currentTrack);
        
        if (trackFile && chosenTrack != currentTrack) {
            if (currentTrack != 'None') {
                MUSIC.queueSuggestion(chosenTrack);
            } else {
                console.log('playing track', trackFile);
                MUSIC.play(chosenTrack);
            }
        }
        
        return [chosenTrack, trackFile];
    }

}

// EDITOR

class EditorManager {
    constructor() {
        this.editor = null;
    }
    async storyEditor(messageDiv) {
        const textElements = messageDiv.querySelectorAll('.text-base');
        let text = Array.from(textElements).map(el => el.textContent).join('\n');
        //console.log('text', text);
        const feedback = await AI.storyEditor(text);
        console.log('feedback', feedback);
        if (feedback) {
            await this.sendFeedback(messageDiv, feedback);
            return true; // Indicate that feedback was sent
        } else {
            UI.removeOverlay();
            return false; // Indicate that no feedback was needed
        }
    }
    async sendFeedback(messageDiv, feedback) {
        lastRevised = true;
        const regenerateButton = messageDiv.querySelector('.lucide-refresh-ccw');
        if (regenerateButton) {
            // Start the observer before clicking the regenerate button
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList') {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === Node.ELEMENT_NODE && node.getAttribute('role') === 'dialog') {
                                node.style.opacity = '0';
                            }
                        });
                    }
                });
            });

            observer.observe(document.body, { childList: true, subtree: true });
            try {
                regenerateButton.parentNode.click();

                let dialog;
                const startTime = Date.now();
                while (!dialog && Date.now() - startTime < 2000) {
                    dialog = document.querySelector('div[role="dialog"]');
                    if (!dialog || !dialog.textContent.includes("What didn't you like?")) {
                        await new Promise(resolve => setTimeout(resolve, 10));
                    }
                }

                if (!dialog) {
                    console.error('Dialog not found within 2 seconds');
                    observer.disconnect();
                    return;
                }

                const otherButton = Array.from(dialog.querySelectorAll('button')).find(button => button.textContent.trim() === 'Other');
                console.log('otherButton', otherButton);

                if (otherButton) {
                    otherButton.click();
                } else {
                    console.error('Could not find the "Other" button');
                    observer.disconnect();
                    return;
                }

                await new Promise(resolve => setTimeout(resolve, 100));

                const textarea = dialog.querySelector('textarea');
                if (textarea) {
                    textarea.value = feedback;
                    
                    const inputEvent = new Event('input', { bubbles: true });
                    textarea.dispatchEvent(inputEvent);
                    
                    const submitButton = Array.from(dialog.querySelectorAll('button')).find(button => button.textContent.trim() === 'Submit');
                    if (submitButton) {
                        submitButton.click();
                        console.log('Submitted feedback');
                    } else {
                        console.error('Could not find the submit button');
                        observer.disconnect();
                        return;
                    }
                } else {
                    console.error('Could not find the textarea for feedback');
                    observer.disconnect();
                    return;
                }
            } catch (error) {
                console.error('Error sending feedback', error);
            } finally {
                // Disconnect the observer
                observer.disconnect();
            }
        }
    }
}

// FABLES DATA

class CampaignManager {
    constructor() {
        this.data = {};
        this.campaignId = this.getCampaignId();
        this.apiKey = '';
        this.authToken = '';
        this.characters = [];
        this.loadCharacters();
    }

    getCampaignId() {
        const url = window.location.href;
        const match = url.match(/fables\.gg\/([^/]+)/);
        if (match) {
            this.campaignId = match[1];
        } else {
            console.error('Campaign ID not found in URL');
        }
        return this.campaignId;
    }

    loadCharacters() {
        chrome.storage.local.get(`characters_${this.campaignId}`, (result) => {
            if (result[`characters_${this.campaignId}`]) {
                this.characters = result[`characters_${this.campaignId}`];
                console.log('Characters loaded from cache:', this.characters);
                VOICE.createUI();
                CAPTION.prepareAllTexts();
                this.getCharactersLegacy();
            } else {
                this.getCharactersLegacy();
            }
        });
    }

    getCharactersLegacy() {
        const url = 'https://play.fables.gg/' + this.campaignId + '/play/characters';
        
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);

        iframe.src = url;
        iframe.onload = () => {
            setTimeout(() => {
                const characters = Array.from(iframe.contentDocument.querySelectorAll('button[id^="radix-:r"]'))
                    .map(button => {
                        const nameElement = button.querySelector('.text-xl.font-bold');
                        const typeElement = button.querySelector('.text-xs.text-foreground-muted');
                        const avatarElement = button.querySelector('img');
                        
                        const name = nameElement ? nameElement.textContent.trim() : 'Unknown';
                        
                        if (name === 'Unknown') {
                            return null;
                        }
                        
                        return {
                            name: name,
                            type: typeElement ? typeElement.textContent.trim() : 'Unknown',
                            avatar: avatarElement ? avatarElement.src : null
                        };
                    })
                    .filter(character => character !== null);

                //console.log('Characters found:', characters);
                this.characters = characters;
                
                document.body.removeChild(iframe);
                
                this.cacheCharacters();
                
                VOICE.createUI();
                CAPTION.prepareAllTexts();
            }, 3000);
        };
    }

    cacheCharacters() {
        chrome.storage.local.set({ [`characters_${this.campaignId}`]: this.characters }, () => {
            console.log('Characters cached for campaign:', this.campaignId);
        });
    }

    getCharacters() {
        this.getCampaignId();
        if (!this.campaignId || !this.apiKey || !this.authToken) {
            console.error('Campaign ID, API key, or authentication token not set');
            return;
        }
        let url = 'https://api.fables.gg/rest/v1/characters?select=id%2Cname%2Cslug%2Cimage%2Crace_id%2Cclass_id%2Cbrief_description%2Calignment_id%2Cprofile_id%2Cbackstory%2Cpersonality%2Cappearance%2Cpronouns%2Csubclass%2Chp%2Cac%2Cxp%2Chit_dice_available%2Cmax_hp%2Clevel%2Ccharisma%2Cstrength%2Cdexterity%2Cintelligence%2Cconstitution%2Cwisdom%2Cacrobatics%2Canimal_handling%2Carcana%2Cathletics%2Cdeception%2Chistory%2Cinsight%2Cintimidation%2Cinvestigation%2Cmedicine%2Cnature%2Cperception%2Cperformance%2Cpersuasion%2Creligion%2Csleight_of_hand%2Cstealth%2Csurvival%2Cin_party%2Cis_npc%2Crace%3Araces%28name%29%2Cclass%3Aclasses%28name%29%2Calignment%3Aalignments%28name%29%2Cx%2Cy&campaign_id=eq.' + this.campaignId + '&is_npc=eq.true&in_party=eq.false';
        fetch(url, {
            headers: {
                'Apikey': this.apiKey,
                'Authentication': this.authToken
            }
        })
        .then(response => response.json())
        .then(data => {
            console.log('Characters:', data);
        })
        .catch(error => {
            console.error('Error fetching characters:', error);
        });
    }

    isEncounter() {
        return Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('Edit Encounter')) ? true : false;
    }
}

// VOICES

class VoicesManager {
    constructor() {
        this.temporaryCharacterVoices = {};
        this.emotions = ['anger', 'positivity', 'surprise', 'sadness', 'curiosity'];
        this.emotionLevels = ['none', 'lowest', 'low', '', 'high', 'highest'];
        this.speedLevels = ['slowest', 'slow', 'normal', 'fast', 'fastest'];
    }

    createUI() {

        if (document.getElementById('voices-manager-button')) {
            return;
        }

        const voicesButton = document.createElement('button');
        voicesButton.id = 'voices-manager-button';
        voicesButton.className = 'inline-flex items-center justify-center whitespace-nowrap font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group bg-gray-400 bg-clip-padding backdrop-filter backdrop-blur-md bg-opacity-20 border border-gray-500 hover:border-primary text-gray-300 h-9 rounded-md px-3';
        voicesButton.style.fontSize = '14px';
        voicesButton.style.display = 'flex';
        voicesButton.style.alignItems = 'center';
        voicesButton.style.marginBottom = '10px';
        voicesButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-mic mr-2 h-4 w-4" style="margin-bottom: 2px;">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
            <span style="line-height: 1; margin-top: 1px;">Voices</span>
        `;

        
        const inviteButton = Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('Invite') || button.textContent.includes('Party Full'));
        if (inviteButton && inviteButton.parentNode) {
            inviteButton.parentNode.insertBefore(voicesButton, inviteButton);
        }

        voicesButton.addEventListener('click', () => {
            this.showVoicesDialog();
        });

        // Load character voices from storage
        chrome.storage.local.get('characterVoices', (result) => {
            if (result.characterVoices) {
                characterVoices = result.characterVoices;
            }
        });
    }

    showVoicesDialog() {
        const characters = CAMPAIGN.characters.sort((a, b) => {
            if (a.type === b.type) {
                return a.name.localeCompare(b.name);
            }
            return a.type === 'PC' ? -1 : 1;
        });

        let content = `
            <div id="voices-dialog" class="p-4 rounded-lg shadow-lg">
                <div class="mb-4">
                    <label for="character-select" class="block text-sm font-medium text-gray-300 mb-2">Select Character</label>
                    <select id="character-select" class="w-full bg-gray-700 border border-gray-600 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        ${characters.map(character => `<option value="${character.name}">${character.name}</option>`).join('')}
                    </select>
                </div>
                <div class="aspect-square relative overflow-hidden rounded-lg" style="margin-bottom: 10px;">
                    <div id="character-avatar" class="flex justify-center items-center"></div>
                    <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background to-transparent h-1/2"></div>
                    <div class="absolute inset-0 bg-gradient-to-b from-background from-3% via-transparent via-5% to-transparent to-100%"></div>
                    <div class="absolute inset-0 bg-gradient-to-r from-background from-3% via-transparent via-20% to-transparent to-100%"></div>
                    <div class="absolute inset-0 bg-gradient-to-l from-background from-3% via-transparent via-20% to-transparent to-100%"></div>
                    <div class="absolute inset-0 -top-5 bg-[radial-gradient(circle,transparent_0%,transparent_50%,rgba(1,10,13,0.9)_100%)]"></div>
                    <div id="character-name" class="absolute inset-x-0 bottom-0 text-gray-300">
                    </div>
                </div>

                <div class="mb-4">
                    <label for="voice-select" class="block text-sm font-medium text-gray-300 mb-2">Select Voice</label>
                    <select id="voice-select" class="w-full bg-gray-700 border border-gray-600 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Select voice</option>
                        ${cachedVoices.map(voice => `<option value="${voice.id}">${voice.name}</option>`).join('')}
                    </select>
                </div>

                <div class="mb-4" style="margin-bottom: 0px;">
                    <label for="voice-select" class="block text-sm font-medium text-gray-300 mb-2">Base Settings</label>
                </div>

                <div class="grid grid-cols-2 gap-2 mb-4">
                    ${this.emotions.map(emotion => `
                        <div>
                            <select id="${emotion}-select" class="w-full bg-gray-700 border border-gray-600 text-white text-xs rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                ${this.emotionLevels.map((level, index) => `<option value="${level}">${this.capitalizeFirstLetter(emotion)}: ${index === 0 ? 0 : '+'+index}</option>`).join('')}
                            </select>
                        </div>
                    `).join('')}
                    <div>
                        <select id="speed-select" class="w-full bg-gray-700 border border-gray-600 text-white text-xs rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500">
                            ${this.speedLevels.map(speed => `<option value="${speed}">${this.capitalizeFirstLetter(speed)}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div class="mb-4">
                    <label class="inline-flex items-center">
                        <input type="checkbox" id="disable-emotions-checkbox" class="form-checkbox text-blue-600">
                        <span class="ml-2 text-sm text-gray-300">Disable Emotions</span>
                    </label>
                </div>

                <button id="play-voice" class="w-full" style="margin-left: 0px !important; margin-right: 0px !important;">
                    Play Voice
                </button>
            </div>
        `;

        this.temporaryCharacterVoices = JSON.parse(JSON.stringify(characterVoices));
        
        $.confirm({
            title: 'Character Voices',
            content: content,
            boxWidth: '300px',
            useBootstrap: false,
            buttons: {
                save: {
                    text: 'Save',
                    btnClass: 'btn btn-default',
                    action: () => {
                        this.saveCharacterVoices();
                    }
                },
                cancel: function () {
                    // Discard temporary changes
                }
            },
            onContentReady: () => {
                this.updateCharacterVoice();
                $('#character-select').on('change', () => this.updateCharacterVoice());
                $('#voice-select').on('change', () => this.temporarilySaveVoice());
                $('#speed-select').on('change', () => this.temporarilySaveVoice());
                this.emotions.forEach(emotion => {
                    $(`#${emotion}-select`).on('change', () => this.temporarilySaveVoice());
                });
                $('#disable-emotions-checkbox').on('change', () => this.temporarilySaveVoice());
                $('#play-voice').on('click', async () => await this.playSelectedVoice());
            }
        });
    }

    capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    updateCharacterVoice() {
        const characterName = $('#character-select').val();
        const character = CAMPAIGN.characters.find(c => c.name === characterName);
        if (character && character.avatar) {
            $('#character-avatar').html(`<img src="${character.avatar}" alt="${character.name}" class="object-cover w-full h-full" />`);
            $('#character-name').html(`<div class="text-2xl font-header text-center">${character.name}</div><div class="text-sm font-header text-center">${character.type}</div><div class="text-xs text-center italic font-header mt-1">${character.brief_description || ''}</div>`);
        } else {
            $('#character-avatar').html('');
            $('#character-name').html('');
        }

        const savedVoice = this.temporaryCharacterVoices[characterName];
        if (savedVoice) {
            $('#voice-select').val(savedVoice.voiceId);
            $('#speed-select').val(savedVoice.speed || 'normal');
            this.emotions.forEach(emotion => {
                $(`#${emotion}-select`).val(savedVoice.emotions[emotion] || 'none');
            });
            $('#disable-emotions-checkbox').prop('checked', savedVoice.disableEmotions || false);
        } else {
            $('#voice-select').val('');
            $('#speed-select').val('normal');
            this.emotions.forEach(emotion => {
                $(`#${emotion}-select`).val('none');
            });
            $('#disable-emotions-checkbox').prop('checked', false);
        }
    }

    temporarilySaveVoice() {
        const characterName = $('#character-select').val();
        const voiceId = $('#voice-select').val();
        if (characterName && voiceId) {
            this.temporaryCharacterVoices[characterName] = {
                voiceId: voiceId,
                speed: $('#speed-select').val(),
                emotions: {},
                disableEmotions: $('#disable-emotions-checkbox').is(':checked')
            };
            this.emotions.forEach(emotion => {
                const level = $(`#${emotion}-select`).val();
                if (level !== 'none') {
                    this.temporaryCharacterVoices[characterName].emotions[emotion] = level;
                }
            });
        }
    }

    async playSelectedVoice(tried = false) {
        if (!cartesiaConnected) {
            if (tried) {
                butterup.toast({
                    title: 'Cartesia Info',
                    message: 'Please connect to Cartesia first.',
                    location: 'bottom-left',
                    icon: false,
                    dismissable: true,
                    type: 'warning',
                });
                console.log('Cartesia not connected');
                return;
            }
            TTS.toggleCartesiaConnection();
            setTimeout(async () => {
                await this.playSelectedVoice(true);
            }, 2000);
            return;
        }

        const voiceId = $('#voice-select').val();
        if (voiceId) {
            const characterName = $('#character-select').val();
            const dialogText = 'Hello, my name is '+characterName+'.';
            const speed = $('#speed-select').val();
            const disableEmotions = $('#disable-emotions-checkbox').is(':checked');
            const emotions = disableEmotions ? [] : this.emotions.map(emotion => {
                const level = $(`#${emotion}-select`).val();
                return level !== 'none' ? `${emotion}:${level}` : null;
            }).filter(Boolean);
            
            console.log(`Playing voice: ${voiceId} with speed: ${speed} and emotions: ${emotions.join(', ')}`);

            TTS.cartesiaConnection.uuid = TTS.cartesiaConnection.uuidv4();
            await TTS.sendTTSRequest(dialogText, false, voiceId, emotions, speed);
        }
    }

    saveCharacterVoices() {
        characterVoices = JSON.parse(JSON.stringify(this.temporaryCharacterVoices));
        chrome.storage.local.set({ characterVoices: characterVoices }, () => {
            console.log('Character voices saved');
            butterup.toast({
                title: 'Voices Saved',
                message: 'Character voices have been saved successfully.',
                location: 'bottom-left',
                icon: false,
                dismissable: true,
                type: 'success',
            });
        });
    }

    getCharacterVoice(characterName) {
        const lowerCharacterName = characterName.toLowerCase();
        
        // Try exact match first
        for (const [key, value] of Object.entries(characterVoices)) {
            if (key.toLowerCase() === lowerCharacterName) {
                return value;
            }
        }
        
        // If no exact match, try partial match
        for (const [key, value] of Object.entries(characterVoices)) {
            if (key.toLowerCase().includes(lowerCharacterName)) {
                return value;
            }
        }
        
        return null;
    }
}

// UTILS

class UtilitiesManager {
    constructor() {
        this.mode = 'active'; // Default mode
        this.relaxLevel = 5; // Default relaxation level
        this.loadPreferences();
    }

    createUI() {

        const modeToggleButton = document.createElement('button');
        modeToggleButton.id = 'mode-toggle-button';
        modeToggleButton.className = 'inline-flex items-center justify-center whitespace-nowrap font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group bg-gray-400 bg-clip-padding backdrop-filter backdrop-blur-md bg-opacity-20 border border-gray-500 hover:border-primary text-gray-300 h-9 rounded-md px-3';
        modeToggleButton.style.fontSize = '14px';
        modeToggleButton.style.display = 'flex';
        modeToggleButton.style.alignItems = 'center';
        modeToggleButton.style.marginBottom = '10px';
        modeToggleButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-settings mr-2 h-4 w-4" style="margin-bottom: 2px;">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                <circle cx="12" cy="12" r="3"/>
            </svg>
            <span style="line-height: 1; margin-top: 1px;">${this.mode === 'active' ? 'Active' : 'Relaxed'} Mode</span>
        `;

        const inviteButton = Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('Invite') || button.textContent.includes('Party Full'));
        if (inviteButton && inviteButton.parentNode) {
            inviteButton.parentNode.insertBefore(modeToggleButton, inviteButton);
        }

        modeToggleButton.addEventListener('click', () => {
            this.showPreferencesDialog();
        });
    }

    showPreferencesDialog() {
        let content = `
            <div id="preferences-dialog" class="p-4 rounded-lg shadow-lg">
                <div class="mb-4">
                    <div class="flex items-center space-x-4">
                        <label class="inline-flex items-center">
                            <input type="radio" name="mode" value="relaxed" class="form-radio text-blue-600" ${this.mode === 'relaxed' ? 'checked' : ''}>
                            <span class="ml-2 text-gray-300">Relaxed</span>
                        </label>
                        <label class="inline-flex items-center">
                            <input type="radio" name="mode" value="active" class="form-radio text-blue-600" ${this.mode === 'active' ? 'checked' : ''}>
                            <span class="ml-2 text-gray-300">Active</span>
                        </label>
                    </div>
                </div>
                <!--<div class="mb-4">
                    <label for="relax-level" class="block text-gray-300 mb-2">Relaxation Level: <span id="relax-level-value">${this.relaxLevel}</span></label>
                    <input type="range" id="relax-level" min="1" max="5" value="${this.relaxLevel}" class="w-full" ${this.mode === 'active' ? 'disabled' : ''}>
                </div>
                <p id="relax-level-description" class="text-sm text-gray-400 mb-4">
                    ${this.getRelaxLevelDescription(this.relaxLevel)}
                </p>
                -->
            </div>
        `;
        
        $.confirm({
            title: 'Story Mode Preferences',
            content: content,
            boxWidth: '300px',
            useBootstrap: false,
            buttons: {
                save: {
                    text: 'Save',
                    btnClass: 'btn btn-default',
                    action: () => {
                        this.savePreferences();
                    }
                },
                cancel: function () {
                    // Discard changes
                }
            },
            onContentReady: () => {
                $('input[name="mode"]').on('change', (e) => {
                    this.mode = e.target.value;
                    //$('#relax-level').prop('disabled', this.mode === 'active');
                });
                /*
                $('#relax-level').on('input', (e) => {
                    const value = parseInt(e.target.value);
                    $('#relax-level-value').text(value);
                    $('#relax-level-description').text(this.getRelaxLevelDescription(value));
                    this.relaxLevel = value;
                });
                */
            }
        });
    }

    getRelaxLevelDescription(level) {
        switch(level) {
            case 1:
                return "Very active: Story progresses quickly with minimal pauses.";
            case 2:
                return "Somewhat active: Brief pauses between story beats.";
            case 3:
                return "Balanced: Moderate pacing with occasional prompts for input.";
            case 4:
                return "Relaxed: Frequent pauses, allowing ample time for reflection.";
            case 5:
                return "Very relaxed: Nothing happens without your input.";
            default:
                return "Adjust the slider to set the relaxation level.";
        }
    }

    savePreferences() {
        chrome.storage.local.set({ 
            storyMode: this.mode,
            relaxLevel: this.relaxLevel
        }, () => {
            console.log('Preferences saved');
            butterup.toast({
                title: 'Preferences Saved',
                message: 'Your story mode preferences have been saved successfully.',
                location: 'bottom-left',
                icon: false,
                dismissable: true,
                type: 'success',
            });
            this.updateModeToggleButton();
        });
    }

    loadPreferences() {
        chrome.storage.local.get(['storyMode', 'relaxLevel'], (result) => {
            if (result.storyMode) {
                this.mode = result.storyMode;
            }
            if (result.relaxLevel) {
                this.relaxLevel = result.relaxLevel;
            }
            this.updateModeToggleButton();
        });
    }

    updateModeToggleButton() {
        const modeToggleButton = document.getElementById('mode-toggle-button');
        if (modeToggleButton) {
            modeToggleButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-settings mr-2 h-4 w-4" style="margin-bottom: 2px;">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                    <circle cx="12" cy="12" r="3"/>
                </svg>
                <span style="line-height: 1; margin-top: 1px;">${this.mode === 'active' ? 'Active' : 'Relaxed'} Mode</span>
            `;
        }
    }
}

function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function decodeAudioData(base64Data) {
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768;
    }
    return float32Array;
}

STT = new STTManager();
UI = new UIManager();
OBS = new ObserverManager();
TTS = new TTSManager();
MUSIC = new MusicManager();
AI = new AIManager();
CAMPAIGN = new CampaignManager();
CAPTION = new CaptionManager();
EDITOR = new EditorManager();
VOICE = new VoicesManager();
UTILITY = new UtilitiesManager();

function waitPageLoad() {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 500; // 5 seconds with 100ms interval
        const checkTextarea = () => {
            const textarea = document.querySelector('textarea[name="message"]');
            if (textarea) {
                resolve(textarea);
            } else if (++attempts < maxAttempts) {
                setTimeout(checkTextarea, 100);
            } else {
                reject(new Error('Textarea not found within 50 seconds'));
            }
        };
        checkTextarea();
    });
}

// INITIALIZE

function updateSettings() {
    chrome.storage.local.get(['ttsEnabled', 'autoPlayNew', 'autoPlayOwn', 'autoSendAfterSpeaking', 'apiKey', 'voiceId', 'speed', 'locationBackground', 'openaiApiKey', 'autoSelectMusic', 'musicAiNotes', 'enableStoryEditor', 'disallowedElements', 'disallowedRelaxed', 'cachedVoices', 'characterVoices', 'useNpcVoices', 'maxRevisions'], function(data) {
        ttsEnabled = data.ttsEnabled || false;
        autoPlayNew = data.autoPlayNew !== undefined ? data.autoPlayNew : true;
        autoPlayOwn = data.autoPlayOwn || false;
        autoSendAfterSpeaking = data.autoSendAfterSpeaking || false;
        apiKey = data.apiKey || '';
        voiceId = data.voiceId || '';
        speed = data.speed || 'normal';
        if (data.locationBackground !== 'off' && data.locationBackground !== locationBackground) {
            UI.lastLocation = null;
        }
        locationBackground = data.locationBackground || 'off';
        openaiApiKey = data.openaiApiKey || '';
        openaiModel = data.openaiModel || 'gpt-4o-mini';
        autoSelectMusic = data.autoSelectMusic || false;
        musicAiNotes = data.musicAiNotes || '';
        enableStoryEditor = data.enableStoryEditor || false;
        disallowedElements = data.disallowedElements || '';
        disallowedRelaxed = data.disallowedRelaxed || '';
        cachedVoices = data.cachedVoices || [];
        characterVoices = data.characterVoices || {};
        useNpcVoices = data.useNpcVoices || false;
        maxRevisions = data.maxRevisions || 3;
        if (ttsEnabled) {
            const targetDiv = document.querySelector('.flex.flex-row.items-center.overflow-hidden');
            if (targetDiv) {
                UI.addTTSToggleButton();
            }
        }
        UI.updateBackgroundImage();
    });
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'update_settings') {
        // Update settings
        updateSettings();

        // Show a toast notification
        butterup.toast({
            title: 'Settings Updated',
            message: 'Your settings have been updated successfully.',
            location: 'bottom-left',
            icon: false,
            dismissable: true,
            type: 'success',
        });
    }
});

// INITIALIZE

function updateSettings() {
    chrome.storage.local.get(['ttsEnabled', 'autoPlayNew', 'autoPlayOwn', 'autoSendAfterSpeaking', 'apiKey', 'voiceId', 'speed', 'locationBackground', 'openaiApiKey', 'autoSelectMusic', 'musicAiNotes', 'enableStoryEditor', 'disallowedElements', 'disallowedRelaxed', 'cachedVoices', 'characterVoices', 'useNpcVoices', 'maxRevisions'], function(data) {
        ttsEnabled = data.ttsEnabled || false;
        autoPlayNew = data.autoPlayNew !== undefined ? data.autoPlayNew : true;
        autoPlayOwn = data.autoPlayOwn || false;
        autoSendAfterSpeaking = data.autoSendAfterSpeaking || false;
        //leaveMicOn = data.leaveMicOn || false;
        //deepgramApiKey = data.deepgramApiKey || '';
        apiKey = data.apiKey || '';
        voiceId = data.voiceId || '';
        speed = data.speed || 'normal';
        if (data.locationBackground !== 'off' && data.locationBackground !== locationBackground) {
            UI.lastLocation = null;
        }
        locationBackground = data.locationBackground || 'off';
        openaiApiKey = data.openaiApiKey || '';
        openaiModel = data.openaiModel || 'gpt-4o-mini';
        autoSelectMusic = data.autoSelectMusic || false;
        musicAiNotes = data.musicAiNotes || '';
        enableStoryEditor = data.enableStoryEditor || false;
        disallowedElements = data.disallowedElements || '';
        disallowedRelaxed = data.disallowedRelaxed || '';
        cachedVoices = data.cachedVoices || [];
        characterVoices = data.characterVoices || {};
        useNpcVoices = data.useNpcVoices || false;
        maxRevisions = data.maxRevisions || 3;
        if (ttsEnabled) {
            const targetDiv = document.querySelector('.flex.flex-row.items-center.overflow-hidden');
            if (targetDiv) {
                UI.addTTSToggleButton();
            }
        }
        UI.updateBackgroundImage();
    });
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'update_settings') {
        // Update settings
        updateSettings();

        // Show a toast notification
        butterup.toast({
            title: 'Settings Updated',
            message: 'Your settings have been updated successfully.',
            location: 'bottom-left',
            icon: false,
            dismissable: true,
            type: 'success',
        });
    }
});

waitPageLoad().then(() => {
    updateSettings();

    const targetElement = document.querySelector('div.overflow-hidden');
    console.log('Target element:', targetElement);
    if (targetElement) {
        OBS.observeOverflowHidden();
    }
    OBS.observeBackgroundImage();
    OBS.observeNewMessages();
    OBS.observeURLChanges();
    UI.addMicToggle();
    UI.initialize();
    MUSIC.createUI();
    UTILITY.createUI();
    CAMPAIGN.loadCharacters();
});
