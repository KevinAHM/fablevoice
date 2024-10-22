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
let improvedLocationDetection = false;
let aiEnhancedTranscriptions = false;
let instructionsText = '';

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
let notebookEnabled = true;
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
let NOTEBOOK;

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

        // Add keyboard shortcut to open AI Editor
        document.addEventListener('keydown', (event) => {
            if (event.key === 'F4') {
                event.preventDefault(); // Prevent default F4 behavior
                //AI.notebookHandler();
            } else if (event.ctrlKey && event.key === 'm') {
                event.preventDefault(); // Prevent default Ctrl+M behavior
                //AI.notebookHandler();
            }
            if (event.key === 'F6') {
                event.preventDefault(); // Prevent default F4 behavior
                //NOTEBOOK.eraseNotebook(true);
            }
            if (event.key === 'F3') {
                event.preventDefault(); // Prevent default F4 behavior
                //CAMPAIGN.updateNotebook();
            }
        });
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

    // LOCATION SUGGESTION
    
    addLocationSuggestion() {
        if (document.getElementById('location-suggestion-button')) {
            return;
        }

        const locationButton = document.createElement('button');
        locationButton.id = 'location-suggestion-button';
        locationButton.className = 'inline-flex items-center justify-center whitespace-nowrap font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group bg-gray-400 bg-clip-padding backdrop-filter backdrop-blur-md bg-opacity-20 border border-gray-500 hover:border-primary text-gray-300 h-9 rounded-md px-3';
        locationButton.style.fontSize = '14px';
        locationButton.style.display = 'flex';
        locationButton.style.alignItems = 'center';
        locationButton.style.marginBottom = '10px';
        locationButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin mr-2 h-4 w-4" style="margin-bottom: 2px;">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
            </svg>
            <span style="line-height: 1; margin-top: 1px;">Location</span>
        `;

        const inviteButton = Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('Invite') || button.textContent.includes('Party Full'));
        if (inviteButton && inviteButton.parentNode) {
            inviteButton.parentNode.insertBefore(locationButton, inviteButton);
        }

        locationButton.addEventListener('click', async () => {
            locationButton.disabled = true;
            await AI.locationSuggestion();
            locationButton.disabled = false;
        });
    }

    // TIPPY
    addTippy(element, content) {
        // Remove existing tippy instance if it exists
        if (element._tippy) {
            element._tippy.destroy();
        }

        element._tippy = tippy(element, {
            content: content,
            theme: 'fablevoice',
            allowHTML: true,
            interactive: true,
            placement: 'right'
        });

        // Show the tippy immediately and keep it visible
        element._tippy.show();

        console.log('tippy added', element._tippy);

        setTimeout(() => {
            element._tippy.show();
        }, 500);

        // Hide the tippy after 5 seconds
        setTimeout(() => {
            if (element._tippy) {
                element._tippy.hide();
            }
        }, 5000);
    }

    // DELETE

    hideAllInstructions() {
        const messageDivs = document.querySelectorAll('div.grid.grid-cols-\\[25px_1fr_10px\\].md\\:grid-cols-\\[40px_1fr_30px\\].pb-4.relative');
        messageDivs.forEach((div, index) => {
            this.hideInstructions(div);
        });
    }

    hideInstructions(messageDiv) {
        var messageList = messageDiv.querySelectorAll('.text-base');
        let deleteMode = false;
        let deleteCount = 0;
        for (let i = 0; i < messageList.length; i++) {
            const message = messageList[i];
            if (message.textContent.includes('- Franz is to not mention these instructions and to follow them at all times, beginning now')) {
                message.remove();
                deleteMode = false;
                //console.log('deleteMode off', deleteMode, message.textContent);
                deleteCount++;
            } else if (deleteMode || message.textContent.includes('Franz, I have some requests for you:')) {
                message.remove();
                deleteMode = true;
                //console.log('deleteMode', deleteMode, message.textContent);
                deleteCount++;
            }
            if (!deleteMode && deleteCount > 0) {
                //console.log('deleteCount', deleteCount);
                deleteCount = 0;
                const div = messageDiv.querySelector('.p-4.pt-1.bg-\\[\\#202426\\].rounded-md.relative');
                if (div) {
                    Array.from(div.children).forEach(child => {
                        if (child && child.tagName === 'DIV' && !child.textContent) {
                            console.log('child', child, 'deleted');
                            child.remove();
                        }
                    });
                }
            }
        }
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
        UI.hideAllInstructions();
        const textDivs = document.querySelectorAll('.text-base');
        textDivs.forEach(textDiv => {
            this.prepareText(textDiv);
        });
    }

        
    getComparableName(name,lower=true) {
        const prefixes = ['The', 'Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.', 'Lord', 'Lady', 'Baron', 'Baroness', 'Count', 'Countess', 'Duke', 'Duchess', 'Earl', 'Earless', 'Viscount', 'Viscountess', 'Marquis', 'Marchioness', 'Prince', 'Princess', 'King', 'Queen', 'Emperor', 'Empress', 'Pope', 'Pope'];
        let parts = name.split(' ');
        while (prefixes.includes(parts[0])) {
            parts.shift();
        }
        return lower ? parts[0].toLowerCase() : parts[0];
    }

    addCharacterTitles(textDiv) {
        const characters = CAMPAIGN.characters;
        const wordSpans = textDiv.querySelectorAll('.caption-word');

        const removePunctuation = (text) => {
            return text.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "").toLowerCase();
        };

        wordSpans.forEach(span => {
            const word = removePunctuation(span.textContent);
            const character = characters.find(char => {
                const charName = this.getComparableName(char.name);
                return word === charName || (word.startsWith(charName) && !characters.some(c => word === this.getComparableName(c.name)));
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
        text = text.replaceAll('Hideout','hideout').replaceAll('hideout','hide out');
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

class STTManager {
    constructor() {
        this.recognition = null;
        this.isRecording = false;
        this.baseDndTermsGrammar = `
  #JSGF V1.0;
  grammar dndTerms;
  public <dndTerm> = 
    // Character Classes
    barbarian | bard | cleric | druid | fighter | monk | paladin | ranger | rogue | sorcerer | warlock | wizard |
    
    // Races
    human | elf | dwarf | halfling | half-orc | tiefling | dragonborn | gnome | aasimar | goliath | tabaxi | lizardfolk | kenku | orc | goblin |
    
    // Monsters
    beholder | dragon | lich | vampire | werewolf | kobold | goblin | orc | troll | ogre | giant | demon | devil | imp | wraith | ghost | skeleton | zombie | mimic | mind flayer | aboleth | basilisk | chimera | hydra | manticore | owlbear | beholder | bugbear | gnoll | griffon | wyvern | balor | golem | treant | wyvern |
    
    // Spells
    fireball | lightning bolt | magic missile | healing word | cure wounds | mage hand | shield | invisibility | polymorph | fly | teleport | fire shield | dispel magic | counterspell | identify | detect magic | levitate | mirror image | scorching ray | eldritch blast | hex | thunderwave | shield of faith | bless | bane | charm person | command | guiding bolt | spirit guardians |
    
    // Weapons
    sword | greatsword | longsword | shortsword | rapier | dagger | axe | battleaxe | greataxe | halberd | spear | javelin | club | mace | warhammer | crossbow | longbow | shortbow | sling | staff | quarterstaff |
    
    // Armor and Gear
    shield | helmet | breastplate | chainmail | leather armor | scale mail | studded leather | cloak | boots | gloves | gauntlets | amulet | ring | necklace | robe | bracers | cape |
    
    // Items
    potion | healing potion | invisibility potion | scroll | spellbook | wand | staff | rod | orb | crystal | gem | pearl | ruby | diamond | emerald | sapphire | bag of holding | magic carpet | lamp | lantern | rope | torch | thieves' tools | lockpick | trap | chest | key |
    
    // Locations
    dungeon | fortress | castle | village | town | city | tavern | inn | guild | forest | mountain | river | swamp | desert | cave | temple | ruins | crypt | tower | stronghold | lair |
    
    // Abilities
    strength | dexterity | constitution | intelligence | wisdom | charisma | stealth | perception | athletics | arcana | survival | insight | intimidation | deception | persuasion | acrobatics | sleight of hand | investigation | animal handling |
    
    // Status Effects and Conditions
    stunned | poisoned | paralyzed | frightened | charmed | blinded | deafened | grappled | restrained | unconscious | petrified | exhausted |
    
    // Alignments
    lawful good | lawful neutral | lawful evil | neutral good | true neutral | neutral evil | chaotic good | chaotic neutral | chaotic evil |
    
    // Miscellaneous Fantasy Terms
    adventurer | quest | treasure | gold | silver | copper | platinum | coin | guild | faction | alliance | rival | deity | god | goddess | cult | demon lord | devil prince | prophecy | artifact | relic | scroll | ritual | spell components | arcane focus | holy symbol | druidic totem | warlock patron | planar travel | portal | rift | dimension | planar shift |
    
    // DnD Terms for Skills, Feats, and Equipment
    acrobatics | animal handling | arcana | athletics | deception | history | insight | intimidation | investigation | medicine | nature | perception | performance | persuasion | religion | sleight of hand | stealth | survival |
    
    // Planes of Existence
    material plane | feywild | shadowfell | astral plane | ethereal plane | elemental plane of fire | elemental plane of water | elemental plane of air | elemental plane of earth | abyss | nine hells | mount celestia | limbo | pandemonium | mechanus | ysgard | beastlands | arborea | bytopia | eberron | ravnica | faerun | forgotten realms | dark sun | dragonlance |
    
    // Deities and Pantheons
    moradin | bahamut | tiamat | pelor | lathander | bane | lolth | vecna | helm | tymora | mystra | corellon | gruumsh | melora | avandra | zehir | asmodeus | tharzidun | io | anubis | thor | odin | hera | zeus | poseidon | hades | ares | athena | hecate | freyja | loki | bastet | sobek | ra |
    
    // Guilds and Organizations
    thieves' guild | adventurers' guild | mages' guild | warriors' guild | merchant guild | assassins' guild | templars | order of the gauntlet | harpers | zentarim | red wizards of thay | emerald enclave | lords' alliance | xanathar's guild | cult of the dragon | cult of vecna;
`;
    this.baseDndTerms = [
        // Character Classes
        'barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk', 'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard',
        
        // Races
        'human', 'elf', 'dwarf', 'halfling', 'half-orc', 'tiefling', 'dragonborn', 'gnome', 'aasimar', 'goliath', 'tabaxi', 'lizardfolk', 'kenku', 'orc', 'goblin',
        
        // Monsters
        'beholder', 'dragon', 'lich', 'vampire', 'werewolf', 'kobold', 'goblin', 'orc', 'troll', 'ogre', 'giant', 'demon', 'devil', 'imp', 'wraith', 'ghost', 'skeleton', 'zombie', 'mimic', 'mind flayer', 'aboleth', 'basilisk', 'chimera', 'hydra', 'manticore', 'owlbear', 'beholder', 'bugbear', 'gnoll', 'griffon', 'wyvern', 'balor', 'golem', 'treant', 'wyvern',
        
        // Spells
        'fireball', 'lightning bolt', 'magic missile', 'healing word', 'cure wounds', 'mage hand', 'shield', 'invisibility', 'polymorph', 'fly', 'teleport', 'fire shield', 'dispel magic', 'counterspell', 'identify', 'detect magic', 'levitate', 'mirror image', 'scorching ray', 'eldritch blast', 'hex', 'thunderwave', 'shield of faith', 'bless', 'bane', 'charm person', 'command', 'guiding bolt', 'spirit guardians',
        
        // Weapons
        'sword', 'greatsword', 'longsword', 'shortsword', 'rapier', 'dagger', 'axe', 'battleaxe', 'greataxe', 'halberd', 'spear', 'javelin', 'club', 'mace', 'warhammer', 'crossbow', 'longbow', 'shortbow', 'sling', 'staff', 'quarterstaff',
        
        // Armor and Gear
        'shield', 'helmet', 'breastplate', 'chainmail', 'leather armor', 'scale mail', 'studded leather', 'cloak', 'boots', 'gloves', 'gauntlets', 'amulet', 'ring', 'necklace', 'robe', 'bracers', 'cape',
        
        // Items
        'potion', 'healing potion', 'invisibility potion', 'scroll', 'spellbook', 'wand', 'staff', 'rod', 'orb', 'crystal', 'gem', 'pearl', 'ruby', 'diamond', 'emerald', 'sapphire', 'bag of holding', 'magic carpet', 'lamp', 'lantern', 'rope', 'torch', 'thieves\' tools', 'lockpick', 'trap', 'chest', 'key',
        
        // Locations
        'dungeon', 'fortress', 'castle', 'village', 'town', 'city', 'tavern', 'inn', 'guild', 'forest', 'mountain', 'river', 'swamp', 'desert', 'cave', 'temple', 'ruins', 'crypt', 'tower', 'stronghold', 'lair',
        
        // Abilities
        'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma', 'stealth', 'perception', 'athletics', 'arcana', 'survival', 'insight', 'intimidation', 'deception', 'persuasion', 'acrobatics', 'sleight of hand', 'investigation', 'animal handling',
        
        // Status Effects and Conditions
        'stunned', 'poisoned', 'paralyzed', 'frightened', 'charmed', 'blinded', 'deafened', 'grappled', 'restrained', 'unconscious', 'petrified', 'exhausted',
        
        // Alignments
        'lawful good', 'lawful neutral', 'lawful evil', 'neutral good', 'true neutral', 'neutral evil', 'chaotic good', 'chaotic neutral', 'chaotic evil',
        
        // Miscellaneous Fantasy Terms
        'adventurer', 'quest', 'treasure', 'gold', 'silver', 'copper', 'platinum', 'coin', 'guild', 'faction', 'alliance', 'rival', 'deity', 'god', 'goddess', 'cult', 'demon lord', 'devil prince', 'prophecy', 'artifact', 'relic', 'scroll', 'ritual', 'spell components', 'arcane focus', 'holy symbol', 'druidic totem', 'warlock patron', 'planar travel', 'portal', 'rift', 'dimension', 'planar shift',
        
        // DnD Terms for Skills, Feats, and Equipment
        'acrobatics', 'animal handling', 'arcana', 'athletics', 'deception', 'history', 'insight', 'intimidation', 'investigation', 'medicine', 'nature', 'perception', 'performance', 'persuasion', 'religion', 'sleight of hand', 'stealth', 'survival',
        
        // Planes of Existence
        'material plane', 'feywild', 'shadowfell', 'astral plane', 'ethereal plane', 'elemental plane of fire', 'elemental plane of water', 'elemental plane of air', 'elemental plane of earth', 'abyss', 'nine hells', 'mount celestia', 'limbo', 'pandemonium', 'mechanus', 'ysgard', 'beastlands', 'arborea', 'bytopia', 'eberron', 'ravnica', 'faerun', 'forgotten realms', 'dark sun', 'dragonlance',
        
        // Deities and Pantheons
        'moradin', 'bahamut', 'tiamat', 'pelor', 'lathander', 'bane', 'lolth', 'vecna', 'helm', 'tymora', 'mystra', 'corellon', 'gruumsh', 'melora', 'avandra', 'zehir', 'asmodeus', 'tharzidun', 'io', 'anubis', 'thor', 'odin', 'hera', 'zeus', 'poseidon', 'hades', 'ares', 'athena', 'hecate', 'freyja', 'loki', 'bastet', 'sobek', 'ra',
        
        // Guilds and Organizations
        'thieves\' guild', 'adventurers\' guild', 'mages\' guild', 'warriors\' guild', 'merchant guild', 'assassins\' guild', 'templars', 'order of the gauntlet', 'harpers', 'zentarim', 'red wizards of thay', 'emerald enclave', 'lords\' alliance', 'xanathar\'s guild', 'cult of the dragon', 'cult of vecna'
    ];
    }

    async startRecording() {
        try {
            if (!('webkitSpeechRecognition' in window)) {
                throw new Error('Web Speech API is not supported in this browser.');
            }

            
            let fullGrammar;
            let fullTerms;
            if (CAMPAIGN.characters && CAMPAIGN.characters.length > 0) {
                // Example of adding character names
                const characterNames = CAMPAIGN.characters.map(character => character.name);
                // Convert the array of character names to a grammar-friendly format
                const characterNamesGrammar = characterNames.map(name => CAPTION.getComparableName(name,false)).join(' | ');

            
                // Add the character names to the existing grammar
                fullGrammar = `
                ${this.baseDndTermsGrammar}
                public <characterNames> = ${characterNamesGrammar};
                `;
                fullTerms = characterNames.map(name => CAPTION.getComparableName(name,false)).concat(this.baseDndTerms);
            } else {
                fullGrammar = this.baseDndTermsGrammar;
                fullTerms = this.baseDndTerms;
            }

            console.log('fullGrammar', fullGrammar);
            const grammarList = new webkitSpeechGrammarList();
            grammarList.addFromString(fullGrammar, 1);  // Full weight for DnD terms

            this.recognition = new webkitSpeechRecognition();
            this.recognition.continuous = true;
            this.recognition.interimResults = false;
            this.recognition.lang = 'en-US';
            this.recognition.grammars = grammarList;
            this.recognition.maxAlternatives = 100;

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

            this.recognition.onresult = async (event) => {
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        let bestMatch = '';
                        let bestMatchIndex = 0;
                        for (let j = 0; j < event.results[i].length; ++j) {
                            const transcript = event.results[i][j].transcript.trim().toLowerCase();
                            if (fullTerms.includes(transcript)) {
                                bestMatch = transcript;
                                console.log('bestMatch', bestMatch);
                                break;
                            } else if (j === 0) {
                                bestMatch = transcript;
                            }
                        }
                        finalTranscript += bestMatch + ' ';
                        await this.sendTranscriptToChat(finalTranscript.trim(), true);
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

    async sendTranscriptToChat(transcript, isFinal) {

        const activeElement = document.activeElement;
        const isMessageTextarea = activeElement.matches('textarea[name="message"]');
        const isTextInput = activeElement.matches('input:not([type]), input[type="text"], textarea');

        if (isTextInput) {
            const cursorPosition = activeElement.selectionStart;
            const currentValue = activeElement.value;
            let trimmedTranscript = transcript.trim();
            
            // Check if we need to add a space before the new text
            if (cursorPosition > 0 && 
                currentValue[cursorPosition - 1] !== ' ' && 
                currentValue[cursorPosition - 1] !== '"' &&
                trimmedTranscript !== '') {
                trimmedTranscript = ' ' + trimmedTranscript;
            }
            
            // Check if we need to add a space after the new text
            if (cursorPosition < currentValue.length && 
                currentValue[cursorPosition] !== ' ' && 
                currentValue[cursorPosition] !== '"' &&
                trimmedTranscript !== '') {
                trimmedTranscript += ' ';
            }

            let newValue = currentValue.slice(0, cursorPosition) + trimmedTranscript + currentValue.slice(cursorPosition);

            if (transcript && openaiApiKey && aiEnhancedTranscriptions) {
                const newTranscript = await AI.transcriptImprovement(newValue);
                if (newTranscript) {
                    console.log('newTranscript', newTranscript);
                    newValue = newTranscript;
                }
            }

            activeElement.value = newValue;
            activeElement.setSelectionRange(newValue.length, newValue.length);
            activeElement.dispatchEvent(new Event('input', { bubbles: true }));
            
            if (isMessageTextarea && isFinal && autoSendAfterSpeaking) {
                const sendButton = document.getElementById('send');
                if (sendButton) {
                    sendButton.click();
                }
            }
        }
    }
    
    addAIButton() {
        if (document.getElementById('aiButton') || !openaiApiKey) {
            return;
        }
        // Add microphone toggle
        const sendButton = document.getElementById('send');
        if (sendButton) {
            const aiButton = document.createElement('button');
            aiButton.id = 'aiButton';
            aiButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" class="mr-2" style=""><path d="M7.5 5.6L5 7l1.4-2.5L5 2l2.5 1.4L10 2 8.6 4.5 10 7 7.5 5.6zm12 9.8L22 14l-1.4 2.5L22 19l-2.5-1.4L17 19l1.4-2.5L17 14l2.5 1.4zM22 2l-2.5 1.4L17 2l1.4 2.5L17 7l2.5-1.4L22 7l-1.4-2.5L22 2zm-7.63 5.29c-.39-.39-1.02-.39-1.41 0L1.29 18.96c-.39.39-.39 1.02 0 1.41l2.34 2.34c.39.39 1.02.39 1.41 0L16.7 11.05c.39-.39.39-1.02 0-1.41l-2.33-2.35zm-1.03 5.49l-2.12-2.12 2.44-2.44 2.12 2.12-2.44 2.44z"/></svg>';
            aiButton.style.cssText = `
                position: absolute;
                right: 55px;
                bottom: 15px;
                display: inline;
                background: none;
                border: none;
                cursor: pointer;
                opacity: 0.3;
                color: #fff;
                transition: opacity 300ms, color 300ms;
            `;
    
            aiButton.addEventListener('click', async (event) => {
                event.preventDefault();
                console.log('aiButton clicked');
                const textarea = document.querySelector('textarea[name="message"]');
                console.log('textarea', textarea);
                if (textarea && textarea.value.trim() !== '') {
                    console.log('textarea is not empty', textarea.value);
                    aiButton.style.opacity = '0.3';
                    aiButton.style.color = '';
                    const newMessage = await AI.transcriptImprovement(textarea.value);
                    textarea.value = newMessage ? newMessage : textarea.value;
                    const inputEvent = new Event('input', { bubbles: true });
                    textarea.dispatchEvent(inputEvent);
                }
            });
    
            sendButton.parentNode.insertBefore(aiButton, sendButton);
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
            this.keys = [...new Set(data.flatMap(track => [...track.keys]).filter(tag => tag.toLowerCase() !== 'music'))];
            
            console.log(this.keys);
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
        const overflowElement = document.querySelector('div.overflow-hidden');
        if (!overflowElement) { return; }
        const targetElement = document.querySelector('.lucide-dice3');
        if (!targetElement || targetElement.classList.contains('fable-dice3')) { return; }
        targetElement.classList.add('fable-dice3');
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
                UI.hideAllInstructions();
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
                console.log('isPlayerMessage', isPlayerMessage);
                UI.hideInstructions(node);
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
            let setMusic = false;

            if (!isPlayerMessage) {
                lastRevised = false;
                //console.log('Debounce triggered: All messages have stopped coming in', autoSelectMusic, MUSIC.manuallyStopped);
                if (autoSelectMusic && openaiApiKey && !MUSIC.manuallyStopped && !musicLocked && !CAMPAIGN.isEncounter()) {
                    AI.musicSuggestion();
                    setMusic = true;
                }
            }

            console.log('setMusic',setMusic, 'improvedLocationDetection',improvedLocationDetection);
            if (improvedLocationDetection && openaiApiKey && !setMusic && !CAMPAIGN.isEncounter()) {
                console.log('Improved location detection');
                AI.locationSuggestion();
            }

            if (notebookEnabled && openaiApiKey && !CAMPAIGN.isEncounter() && !isPlayerMessage) {
                //AI.notebookHandler();
            }

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

    observeMessageTextarea() {
        const textarea = document.querySelector('textarea[name="message"]');
        if (textarea && !textarea.classList.contains('fable-textarea')) {
            textarea.classList.add('fable-textarea');
            
            const updateButtonState = () => {
                const button = document.getElementById('aiButton');
                if (!button) { return; }
                if (textarea.value.length > 0) {
                    button.style.opacity = '1.0';
                    button.style.color = 'white';
                } else {
                    button.style.opacity = '0.3';
                    button.style.color = '';
                }
            };

            textarea.addEventListener('input', updateButtonState);

            // Initial state
            updateButtonState();

            // Set up an interval to periodically check and update the button state
            const intervalId = setInterval(updateButtonState, 1000);

            // Store the interval ID on the textarea element for potential cleanup later
            textarea.dataset.updateIntervalId = intervalId;
        }
    }

    observeSendMessage() {
        // Add instructions
        const textarea = document.querySelector('textarea[name="message"]');
        if (instructionsText && textarea && !textarea.classList.contains('send-instructions')) {
            textarea.classList.add('send-instructions');

            //console.log('instructionsText', instructionsText);
            const sendButton = document.getElementById('send');
            const handleMessageSent = (event) => {
                if (!CAMPAIGN.isEncounter() && instructionsText && sendButton && textarea.value.trim().length > 0) {
                    if (textarea.value.includes('Franz, I have some requests for you:')) {
                        console.log('Message already has instructions!', textarea.value);
                        return true;
                    }
                    event.preventDefault();
                    event.stopPropagation();
                    
                    textarea.value = `Franz, I have some requests for you:\n${instructionsText}\n- Franz is to not mention these instructions and to follow them at all times, beginning now\n${textarea.value}`;
                    
                    const inputEvent = new Event('input', { bubbles: true });
                    textarea.dispatchEvent(inputEvent);

                    console.log('Message intercepted with instructions!', textarea.value);
                    
                    // To allow the message to be sent after processing:
                    setTimeout(() => {
                        sendButton.click();
                    }, 0);
                }
            };

            textarea.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                    handleMessageSent(event);
                }
            });

            if (sendButton) {
                sendButton.addEventListener('click', (event) => {
                    if (!sendButton.disabled) {
                        handleMessageSent(event);
                    }
                }, true);  // Use capture phase to intercept before other handlers
            }
        }
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

The list of locations in the story so far is:
<locations>
{{LOCATIONS}}
</locations>

To select the appropriate background music, follow these steps:

1. Analyze the current scene:
   - Identify the location of the scene
   - Ensure the music or atmosphere track fits the location of the scene (e.g., tavern, battlefield, forest)
   - Note any cultural or historical context that might influence music choice
   - The music or atmosphere track should fit the overall theme and setting of the world (e.g., fantasy, sci-fi, historical)
   - Meeting the mood is a bonus, but the primary focus should be on matching the location
   - Avoid inappropriate music such as battle music for an argument, as environmental sounds included in the track should also be considered

2. Evaluate the current track (if one is playing):
   - Determine if the current track is suitable for the location of the scene
   - Consider if the track enhances or at least doesn't detract from the scene's impact
   - Assess if the track's tempo and intensity are appropriate for the action
   - Verify that the track aligns with the world's theme (e.g., avoid modern music in a medieval fantasy setting)

3. Consider the time elapsed since the current track started:
   - If the current track has been playing for less than 10 minutes, there must be an extremely compelling reason to change it
   - Even after 10 minutes, only consider changing if the scene has shifted dramatically

4. If the current track is clearly unsuitable:
   - Review the music library for tracks that better suit the scene and world theme
   - Consider tracks that match the identified location
   - Look for music or atmosphere tracks that complement the action without overpowering it
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

8. Determine the most likely current location:
   - Review the list of locations provided
   - Based on the latest message and overall context, identify the location where the current scene takes place
   - Pay special attention to any location changes mentioned in the latest message, as scenes can sometimes shift locations
   - Use "Uncertain" if you are not 100% sure or if they are not in the list
   - Only provide a location if you are completely sure of the location
   - Before providing the location, state your justification for your decision, including a brief summary of the chain of events that led to the current location or your reasoning for using "Uncertain".

9. Location reasoning:
   - Before providing the location, state your justification for your decision, including a quote from the story that 100% confirms the location. If no quote is provided, you must choose "Uncertain".

10. Important notes:
   - Just because the characters are discussing a location, it does not mean they are currently in that location.
   - Remember that you are tracking location _changes_ rather than deciding the location based off inconclusive evidence such as mentions of locations.
   - The story will mention when characters move between locations, so look for that, rather than assuming they are in a location.
   - Only provide a location if you are completely sure that they are there. We are not looking for "reasonable assumptions", we are looking for definitive locations that the characters are explicitly mentioned as being in within the text.
   - It is better that you say "Uncertain" than to guess at a location.

Provide your response in the following format:
<music_selection>
<reasoning>
[Explain your decision, including why the chosen track (or current track, if kept) is appropriate for the scene. If changing tracks, explain why the current track was not suitable.]
</reasoning>
<decision>[Keep current track/Change track]</decision>
<best_matching_tracks>
[List of tracks (up to 5) from <music_library> that are the best match, separated by commas]
</best_matching_tracks>
<chosen_track>[Title of chosen track, or "None" if keeping current track]</chosen_track>
<location_reasoning>
[Explain your decision for what the current location must be, based on the latest message and overall context.]
</location_reasoning>
<current_location>[The location from the provided <locations> list where the latest scene takes place or ends at - use "Uncertain" if not 100% sure or if they are not in the list]</current_location>
</music_selection>

Remember, your goal is to enhance the roleplay experience by selecting music that complements the scene. Make your decision based on the scene description, the current track (if any), and the available options in the music library. Additionally, provide the most likely current location to help set the scene accurately.`;
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
        this.locationPrompt = `You are an AI assistant tasked with determining the current location in a roleplay scene. You will be provided with a description of the current scene and a list of known locations.

Now, here is a message history to help determine the current location in the roleplay:
<message_history>
{{MESSAGE_HISTORY}}
</message_history>

This is the latest message, which is most relevant to the current scene:
<current_message>
{{CURRENT_MESSAGE}}
</current_message>

The list of locations in the story so far is:
<locations>
{{LOCATIONS}}
</locations>

To determine the current location, follow these steps:

1. Analyze the current scene:
   - Identify any mentions of specific locations or environmental details
   - Consider the context of the conversation and actions taking place

2. Review the list of known locations:
   - Check if any of the locations in the list match the details from the current scene
   - Consider if the characters might still be in a previously mentioned location

3. Make your decision:
   - Choose the most likely location from the provided list
   - If unsure or if the location is not in the list, use "Uncertain"

4. Final check:
   - Ensure your chosen location aligns with the latest message and overall context
   - Only provide a location if you are completely sure

5. Reasoning:
   - Before providing the location, state your justification for your decision, including a quote from the story that 100% confirms the location. If no quote is provided, you must choose "Uncertain".

6. Important notes:
   - Just because the characters are discussing a location, it does not mean they are currently in that location.
   - Remember that you are tracking location _changes_ rather than deciding the location based off inconclusive evidence such as mentions of locations.
   - The story will mention when characters move between locations, so look for that, rather than assuming they are in a location.
   - Only provide a location if you are completely sure that they are there. We are not looking for "reasonable assumptions", we are looking for definitive locations that the characters are explicitly mentioned as being in within the text.
   - It is better that you say "Uncertain" than to guess at a location.

Provide your response in the following format:
<location_selection>
<location_reasoning>[Briefly explain your decision for what the current location must be, based on the latest message and overall context.]</location_reasoning>
<current_location>[The location from the provided <locations> list where the latest scene takes place or ends at - use "Uncertain" if not 100% sure or if they are not in the list]</current_location>
</location_selection>

Remember, your goal is to accurately determine the current location to help set the scene. Only provide a location if you are completely sure it matches one from the given list.`;
        this.transcriptPrompt = `You are tasked with formatting and correcting speech-to-text transcriptions from a Dungeons & Dragons (DnD) or roleplaying game session. These transcriptions may contain grammar imperfections, spelling errors, and fantasy-related words and phrases. Your goal is to output grammatically correct, properly phrased speech and actions while preserving the original meaning and words.

Here is the transcript you need to format and correct:

<transcript>
{{TRANSCRIPT}}
</transcript>

Follow these rules when formatting and correcting the text:

1. Correct grammar and spelling errors, but do not change the words or meaning of the text.
2. Format speech by placing it in quotation marks: "Like this."
3. Format actions by placing them between asterisks: *Like this.*
4. If the speaker is clearly addressing the Dungeon Master/Game Master (DM/GM) named Franz out of character, format it as: (OOC: Like this.)
5. Capitalize proper nouns, including character and place names.
6. Separate distinct actions and speech into different segments.
7. Speech ALWAYS goes in quotes, even if it's a single word or short phrase.
8. Actions ALWAYS go in asterisks, even if they're short.

When handling speech, actions, and OOC comments:
- Only use the (OOC: ) format when you are 100% certain the speaker is talking to the DM/GM Franz out of character. Otherwise, leave it as regular dialogue in quotes.
- Ensure that actions and speech are clearly distinguished from each other.
- Maintain the order of actions and speech as they appear in the original transcript.
- Never combine speech and actions in the same set of quotes or asterisks.

Examples:
- Correct: "Hey there!" *Walks over to Merlin.*
- Incorrect: *Hey there, walks over to Merlin.*

Remember, it's crucial that you don't actually change the words or meaning of the text. Your task is to format it, correct grammar and spelling, and ensure proper capitalization.

Please provide your formatted and corrected version of the transcript, following the rules and guidelines above. Place your corrected transcription in <corrected_transcript></corrected_transcript> tags.`
        this.notebookPrompt = `You are an AI assistant responsible for managing memory in a roleplay scenario. Your task is to analyze recent messages, identify important information, and update the memory accordingly using provided functions.

The list of locations in the story so far is:
<locations>
{{LOCATIONS}}
</locations>

The list of characters in the story so far is:
<characters>
{{CHARACTERS}}
</characters>

First, review the existing memory entries:

<existing_memory>
{{EXISTING_MEMORY}}
</existing_memory>

Now, analyze the following previous messages for context:

<message_history>
{{MESSAGE_HISTORY}}
</message_history>

And then analyze the following current messages to determine any necessary updates to the memory:

<current_message>
{{CURRENT_MESSAGE}}
</current_message>

Your task is to:
1. Analyze the messages to extract significant information.
2. Determine if this information warrants updating or adding to the memory.
3. Use appropriate functions to update the memory, ensuring no duplicates and maintaining data integrity.
4. Due to limited memory space, only store information that is important for future interactions.

Here are the available functions you can use to interact with the memory:

<available_functions>
createEntry(type, data, name)
updateEntry(id, name, data)
updateEntryProperty(id, name, key, value)
deleteEntryProperty(id, name, key)
appendToEntry(id, name, field, value)
deleteEntry(id, name)
replaceEntry(id, name, data)
doNothing(reason)
</available_functions>

Functions:
- You must createEntry if no entry exists for a type and id.
- For example, if memory does not contain an entry for a character, you must create one using createEntry.
- When creating an entry, set the data you are planning to add within the creation function call instead of updating the entry after creating it.
- If using createEntry, use it BEFORE updating the entry with updateEntry.
- Use deleteEntry to remove an entry if it is no longer needed, for example, if a character's full name is revealed to be different than the alias you have been using, you must delete the old entry and create a new one while preserving the properties from the old entry.
  - This can happen when you are using the the best known information to identify a character (e.g. using "So and so's father" instead of the father's name), or if a character reveals their true name or identity.
Provide your response as a series of function calls, if any are needed. Do not include explanations or additional text—only the necessary function calls.
- Please keep redundancy to minimum, so do not mention the character's name within their own entry details because it is already stored in the entry.

Affinity System:
- Affinities are a measure of how close two characters are, and can affect how they interact with each other.
- Affinities are stored as a number between 0 and 10, and are updated based on the characters' actions and interactions in the story.
- Affinities can be positive or negative, and can affect the story in a variety of ways.
- Affinities are stored in the memory under the character's entity.
- Affinities are updated based on the characters' actions and interactions in the story.
- An affinity should only change when logical and significant events happen in the story or in the interactions between the characters.
- The affinities should be incremented or decremented naturally without rising or falling too much at once unless characters explicitly state or indicate otherwise.
- If an affinity is not set yet, you may make your best guess when enough context is available, but do not set it to 0 or 10.
- Affininity is a numerical score from 1 to 10, 10 being the highest and 1 being the lowest - higher means more positive.
- At the moment, affinity _only applies_ to the characters affinity towards the player, who is referred to as "you" in the story, and also the name {{CHARACTER}} in the story.
- This means that only interactions between the characters and the player will affect the affinity, and not interactions between characters.

Backstory System:
- Character interactions that may seem to be important should not be stored in memory unless they have an extremely significant impact on the story or the characters involved.
- The affinity system is there to track the characters' relationships to each other, so if a player character has a significant interaction with another character you should update their affinities rather than their backstory, unless the relationship is moving from platonic to romantic, etc.
- Avoid adding minor details or repetitive information that can be handled by the affinity system.
- Please don't add backstory to characters unless it's extremely significant and has a direct impact on the story. For example, if a character reveals a major secret, or makes a major decision that changes the story, or a character's backstory is revealed to be different than previously thought, etc.
- Write with extreme brevity, making your writing compact and to the point.
- Backstory should only be updated with extremely important information that has a direct and significant impact on the story or the character's development.

Types:
- These are the only valid data types: character, location, item, world
- An item is any significant item that has story/plot/sentimental significance.
- A basic weapon or piece of gear, or an ornate box, even if magical, would not be considered an item.
- A character is an NPC, player, named animal, or other character (except Franz, the DM/Game Master and narrator).
- World is for any changing world condition that encompasses the entire story and not just a single location, such as war, peace, natural disaster, or other significant change.
- Do _NOT_ store quest information, a separate system handles quests.

Remember:
- Be sure that you have the correct character or location names - always use the full name from <characters> or <locations> lists.
- If you are unsure which character or location is being referenced, _do not guess_, simply avoid running any function calls unless you are 100% sure.
- Avoid duplicates by checking for existing entries and property entries before creating or appending.
- Prioritize significance by only storing information likely to impact future interactions.
- Be concise due to limited memory space, keeping stored information brief and essential.
- Ensure all updates are consistent with existing memory entries.
- Consider updating affinities if implied in the messages.
- If the messages are about Franz, do not store them in the memory.
- Franz should not be included in any memories as he is the DM and not a player character or NPC.
- If you cannot find anything to update or add in the memory, call doNothing(reason) to avoid unnecessary function calls while stating your reason.

# Really important:
- Entries should be written from the perspective of the player character, using "you" and "your" to refer to them. This is the player character's notebook, after all.
  - For example, if backstory is being added to a character regarding an interaction with the player, use "you" and "your" to refer to the player rather than the player's character name which is {{CHARACTER}}.
- Entries should be written in the past tense, as they are memories.

Proceed with analyzing the recent messages and run any necessary function calls to update the memory.
Please refrain from adding unnecessary information. If there are no changes, simply use doNothing.
Avoid adding duplicate backstory entries. Check <existing_memory> to ensure you are not repeating information.
Write extremely concisely, using only as many words as necessary to convey the information.
Do not adjust affinity if both characters are not physically present in the scene.
`;
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
                title: 'FableVoice OpenAI Error',
                message: errorMessage.length > 80 ? errorMessage.substring(0, 77) + '...' : errorMessage,
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
            const messages = messageDivs[i].querySelectorAll('p.text-base');
            if (messages.length > 0) {
                let messageText = Array.from(messages).map(p => p.textContent).join(' ');
                messageList.unshift('Message #' + messageCount + ': ' + messageText);
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
        systemMessage = systemMessage.replace('{{LOCATIONS}}', CAMPAIGN.locations.join('\n'));
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
        let location = '';
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

        
        const locationMatch = suggestion.match(/<current_location>(.*?)<\/current_location>/);
        if (locationMatch) {
            location = locationMatch[1].trim();
            console.log('Extracted location:', location);
            if (CAMPAIGN.locations.some(loc => loc.name === location)) {
                console.log('Location found in the campaign');
                if (improvedLocationDetection) { CAMPAIGN.requestLocation(location); }
            } else {
                console.log('Location not found in the campaign');
            }
        }
        
        return [chosenTrack, trackFile, location];
    }

    async locationSuggestion() {
        let systemMessage = this.locationPrompt;

        // get current world context
        const messageDivs = document.querySelectorAll('div.grid.grid-cols-\\[25px_1fr_10px\\].md\\:grid-cols-\\[40px_1fr_30px\\].pb-4.relative');
        let messageList = [];
        let messageCount = 8;
        for (let i = messageDivs.length - 1; i >= 0 && messageCount > 0; i--) {
            const messages = messageDivs[i].querySelectorAll('p.text-base');
            if (messages.length > 0) {
                let messageText = Array.from(messages).map(p => p.textContent).join(' ');
                messageList.unshift('Message #' + messageCount + ': ' + messageText);
                messageCount--;
            }
        }
        const messages = messageList.join('\n');
        systemMessage = systemMessage.replace('{{MESSAGE_HISTORY}}', messages);
        systemMessage = systemMessage.replace('{{CURRENT_MESSAGE}}', messageList[messageList.length - 1]);
        systemMessage = systemMessage.replace('{{LOCATIONS}}', CAMPAIGN.locations.join('\n'));

        console.log('systemMessage', systemMessage);

        const userMessage = 'Please determine the current location that the scene is taking place in, prioritizing the most recent location.';
        console.log('userMessage', userMessage);
        const suggestion = await this.runAI(systemMessage, userMessage);
        console.log('suggestion', suggestion);

        let location = '';
        const locationMatch = suggestion.match(/<current_location>(.*?)<\/current_location>/);
        if (locationMatch && locationMatch[1] && locationMatch[1].trim() != 'Uncertain') {
            location = locationMatch[1].trim();
            console.log('Extracted location:', location);
            if (CAMPAIGN.locations.some(loc => loc.name === location)) {
                console.log('Location found in the campaign');
                CAMPAIGN.requestLocation(location);
            } else {
                UI.addTippy(document.getElementById('location-suggestion-button'), 'Location: ' + location);
                console.log('Location not found in the campaign');
            }
        } else {
            UI.addTippy(document.getElementById('location-suggestion-button'), 'Error running AI');
        }

        return location;
    }

    async transcriptImprovement(text) {
        let systemMessage = this.transcriptPrompt;
        systemMessage = systemMessage.replace('{{TRANSCRIPT}}', text);
        const suggestion = await this.runAI(systemMessage, 'Please improve the transcript as per the instructions.');
        console.log('suggestion', suggestion);
        const transcriptionMatch = suggestion.match(/<corrected_transcript>([\s\S]*?)<\/corrected_transcript>/s);
        if (transcriptionMatch && transcriptionMatch[1]) {
            let transcription = transcriptionMatch[1].trim();
            console.log('Extracted transcription:', transcription);
            return transcription;
        }
        return false;
    }

    async toolCalls(tool_calls) {
        console.log('tool_calls', tool_calls);
        tool_calls.sort((a, b) => {
            if (a.function.name === "createEntry" && b.function.name !== "createEntry") {
                return -1;
            } else if (a.function.name !== "createEntry" && b.function.name === "createEntry") {
                return 1;
            }
            return 0;
        });

        for (const tool_call of tool_calls) {
            const { name: functionName, arguments: functionArgs } = tool_call.function;
            const parsedArgs = JSON.parse(functionArgs);

            switch (functionName) {
                case "createEntry":
                    console.log(`Creating entry: ${parsedArgs.type}`);
                    await this.handleNotebookAction(NOTEBOOK.createEntry.bind(NOTEBOOK), parsedArgs.type, parsedArgs.name, parsedArgs.data, 'Entry created successfully', 'Failed to create entry');
                    break;
                case "getEntryById":
                    console.log(`Getting entry by ID: ${parsedArgs.id}`);
                    await this.handleNotebookAction(NOTEBOOK.getEntryByIdOrName.bind(NOTEBOOK), parsedArgs.id, parsedArgs.name, 'Entry retrieved successfully', 'Failed to retrieve entry');
                    break;
                case "findEntries":
                    console.log(`Finding entries of type: ${parsedArgs.type}`);
                    await this.handleNotebookAction(NOTEBOOK.findEntries.bind(NOTEBOOK), parsedArgs.type, parsedArgs.query, 'Entries found successfully', 'Failed to find entries');
                    break;
                case "updateEntry":
                    console.log(`Updating entry with ID: ${parsedArgs.id}`);
                    await this.handleNotebookAction(NOTEBOOK.updateEntry.bind(NOTEBOOK), parsedArgs.id, parsedArgs.name, parsedArgs.data, 'Entry updated successfully', 'Failed to update entry');
                    break;
                case "appendToEntry":
                    console.log(`Appending to entry with ID: ${parsedArgs.id}`);
                    await this.handleNotebookAction(NOTEBOOK.appendToEntry.bind(NOTEBOOK), parsedArgs.id, parsedArgs.name, parsedArgs.field, parsedArgs.value, 'Value appended successfully', 'Failed to append value');
                    break;
                case "deleteEntry":
                    console.log(`Deleting entry with ID: ${parsedArgs.id}`);
                    await this.handleNotebookAction(NOTEBOOK.deleteEntry.bind(NOTEBOOK), parsedArgs.id, parsedArgs.name, 'Entry deleted successfully', 'Failed to delete entry');
                    break;
                case "replaceEntry":
                    console.log(`Replacing entry with ID: ${parsedArgs.id}`);
                    await this.handleNotebookAction(NOTEBOOK.replaceEntry.bind(NOTEBOOK), parsedArgs.id, parsedArgs.name, parsedArgs.data, 'Entry replaced successfully', 'Failed to replace entry');
                    break;
                case "touchEntry":
                    console.log(`Touching entry with ID: ${parsedArgs.id}`);
                    await this.handleNotebookAction(NOTEBOOK.touchEntry.bind(NOTEBOOK), parsedArgs.id, parsedArgs.name, 'Entry timestamp updated successfully', 'Failed to update entry timestamp');
                    break;
                case "updateEntryProperty":
                    console.log(`Updating property of entry with ID: ${parsedArgs.id}`);
                    await this.handleNotebookAction(NOTEBOOK.updateEntryProperty.bind(NOTEBOOK), parsedArgs.id, parsedArgs.name, parsedArgs.key, parsedArgs.value, 'Entry property updated successfully', 'Failed to update entry property');
                    break;
                case "deleteEntryProperty":
                    console.log(`Deleting property of entry with ID: ${parsedArgs.id}`);
                    await this.handleNotebookAction(NOTEBOOK.deleteEntryProperty.bind(NOTEBOOK), parsedArgs.id, parsedArgs.name, parsedArgs.key, 'Entry property deleted successfully', 'Failed to delete entry property');
                    break;
                case "doNothing":
                    console.log(`Doing nothing: ${parsedArgs.reason}`);
                    break;
                default:
                    console.error(`Unknown function: ${functionName}`);
            }
        }
    }

    async handleNotebookAction(action, ...args) {
        try {
            const result = await action(...args);
            if (result) {
                console.log(args[args.length - 2]);
            } else {
                console.error(args[args.length - 1]);
            }
        } catch (error) {
            console.error('Error executing notebook action:', error);
        }
    }
    
    async runNotebookAI(systemMessage, userMessage) {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'runNotebookAI',
                apiKey: openaiApiKey,
                model: openaiModel,
                systemMessage: systemMessage,
                userMessage: userMessage
            });
            
            if (response.error) {
                throw new Error(response.error);
            }

            console.log('response', response);

            if (response.tool_calls) {
                this.toolCalls(response.tool_calls);
            }
            
            return response.data;
        } catch (error) {
            const errorMessage = error.message || 'An unknown error occurred';
            butterup.toast({
                title: 'FableVoice OpenAI Error',
                message: errorMessage.length > 80 ? errorMessage.substring(0, 77) + '...' : errorMessage,
                location: 'bottom-left',
                icon: false,
                dismissable: true,
                type: 'error',
            });
            console.error('Error running AI:', error);
            throw error;
        }
    }

    async notebookHandler() {
        let systemMessage = this.notebookPrompt;

        // get current world context
        const messageDivs = document.querySelectorAll('div.grid.grid-cols-\\[25px_1fr_10px\\].md\\:grid-cols-\\[40px_1fr_30px\\].pb-4.relative');
        let messageList = [];
        let messageCount = 8;
        for (let i = messageDivs.length - 1; i >= 0 && messageCount > 0; i--) {
            const messages = messageDivs[i].querySelectorAll('p.text-base');
            if (messages.length > 0) {
                let messageText = Array.from(messages).map(p => p.textContent).join(' ');
                messageList.unshift('Message #' + messageCount + ': ' + messageText);
                messageCount--;
            }
        }

        //const messages = messageList.join('\n');
        systemMessage = systemMessage.replace('{{MESSAGE_HISTORY}}', messageList.slice(0, -1).join('\n'));
        systemMessage = systemMessage.replace('{{CURRENT_MESSAGE}}', messageList[messageList.length - 1]);
        systemMessage = systemMessage.replace('{{LOCATIONS}}', CAMPAIGN.locations.join('\n'));

        const characters = CAMPAIGN.characters.sort((a, b) => {
            if (a.type === b.type) {
                return a.name.localeCompare(b.name);
            }
            return a.type === 'PC' ? -1 : 1;
        });

        const characterNames = characters
            .map(character => character.name)
            .filter(name => !characters.some(other => other.name.includes(name + ' ')))
            .join("\n");
        systemMessage = systemMessage.replace('{{CHARACTERS}}', characterNames);
        systemMessage = systemMessage.replace('{{CHARACTER}}', characters[0].name);

        systemMessage = systemMessage.replace('{{EXISTING_MEMORY}}', JSON.stringify(NOTEBOOK.entries));

        console.log('systemMessage', systemMessage);

        const userMessage = 'Please run any necessary function calls.';
        console.log('userMessage', userMessage);
        const suggestion = await this.runNotebookAI(systemMessage, userMessage);
        console.log('suggestion', suggestion);
        return suggestion;
    }

}

// NOTEBOOK

class NotebookManager {
    constructor() {
        this.logging = true;
        this.entries = {};
        this.saveEntriesTimeout = null;
        this.tippyMessages = [];
        this.tippyTimeout = null;
        this.loadEntries();
    }

    toast(message) {
        butterup.toast({
            title: 'FableVoice Notebook',
            message: message,
            location: 'bottom-left',
            icon: false,
            dismissable: true,
            type: 'success',
        });
        console.log('Toast message:', message);
        console.log('Notebook entries:', this.entries);
    }

    tippyInfo(message) {
        this.tippyMessages.push(message);

        clearTimeout(this.tippyTimeout);
        this.tippyTimeout = setTimeout(() => {
            const combinedMessage = this.tippyMessages.join('\n');
            UI.addTippy(document.getElementById('notebook-button'), combinedMessage);
            this.tippyMessages = [];
        }, 1000);
    }

    eraseNotebook(all=false) {
        const campaignId = CAMPAIGN.campaignId;
        if (all) {
            this.entries = {};
            this.saveEntries();
            this.toast('Notebook erased successfully.');
        } else if (this.entries[campaignId]) {
            this.entries[campaignId] = [];
            this.saveEntries();
            this.toast('Notebook for this campaign erased successfully.');
        } else {
            this.toast('No entries found for this campaign.');
        }
    }

    getNotebook() {
        if (!notebookEnabled) { return ''; }
        const campaignId = CAMPAIGN.campaignId;
        if (!this.entries[campaignId]) { return ''; }
        
        const descriptions = {
            'character': 'NPCs should act accordingly based on the information below. Note, information here overrides any NPC backstories as this is the most current information available:',
            'location': 'Locations have the current state:',
            'item': 'Items have the current state:',
            'event': 'Events have the current state:',
            'world': 'The world has the current state:',
        };

        const groupedEntries = this.entries[campaignId].reduce((acc, entry) => {
            if (Object.keys(entry.properties).length === 0) {
                return acc;
            }
            if (!acc[entry.type]) {
                acc[entry.type] = [];
            }
            acc[entry.type].push(entry);
            return acc;
        }, {});

        const formattedEntries = Object.keys(groupedEntries)
            .sort()
            .map(type => {
                let description = '';
                if (descriptions[type]) {
                    description = `##  ${descriptions[type]}\n\n`;
                }
                const entries = groupedEntries[type]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(entry => {
                        const displayProperties = { ...entry.properties };
                        if (displayProperties.affinity !== undefined) {
                            displayProperties["affinity for me"] = `${displayProperties.affinity}/10`;
                            delete displayProperties.affinity;
                        }
                        return `### ${entry.name}:\n${JSON.stringify(displayProperties, null, 2)}`;
                    })
                    .join('\n\n');
                return `# ${type.charAt(0).toUpperCase() + type.slice(1)}:\n\n${description}${entries}`;
            })
            .join('\n\n');
        
        return formattedEntries;
    }

    loadEntries() {
        chrome.storage.local.get(['notebookEntries'], (result) => {
            if (result.notebookEntries) {
                this.entries = result.notebookEntries;
                if (false) {
                    this.entries = {'7bb4a5e8-538a-4826-84c4-22e4dbff436a' : [
                        {
                            "id": "character_1727176596099",
                            "lastAccessed": "2024-09-24T12:45:45.662Z",
                            "name": "Leif Gunnarson",
                            "properties": {
                                "affinity": 5,
                                "backstory": [
                                    "Leif Gunnarson has a personal vendetta against Fjallheim as they killed his family and burned their farm.",
                                    "Leif Gunnarson appreciates Eirik's offer of comfort during a difficult moment."
                                ]
                            },
                            "type": "character"
                        }
                    ]};
                }
                //this.toast('Entries loaded successfully.');
            } else {
                //this.toast('No entries found.');
            }
        });
    }

    saveEntries() {
        clearTimeout(this.saveEntriesTimeout);
        this.saveEntriesTimeout = setTimeout(() => {
            // clean up entries by removing empty parameters etc.
            function cleanProperties(properties) {
                for (const key in properties) {
                    if (properties[key] === null || properties[key] === undefined || properties[key] === '') {
                        delete properties[key];
                    } else if (Array.isArray(properties[key])) {
                        cleanProperties(properties[key]);
                    } else if (typeof properties[key] === 'object') {
                        cleanProperties(properties[key]);
                    }
                }
            }

            for (const campaignId in this.entries) {
                for (const entry of this.entries[campaignId]) {
                    cleanProperties(entry.properties);
                }
            }
            
            chrome.storage.local.set({ notebookEntries: this.entries }, () => {
                //this.toast('Entries saved successfully.');
                CAMPAIGN.updateNotebook();
            });
        }, 1000);
    }

    typifyData(data) {
        if (typeof data === 'string' && !isNaN(data)) {
            return parseInt(data, 10);
        } else if (Array.isArray(data)) {
            return data.map(item => this.typifyData(item));
        } else if (typeof data === 'object' && data !== null) {
            for (const key in data) {
                data[key] = this.typifyData(data[key]);
            }
            return data;
        } else {
            return data;
        }
    }

    createEntry(type, name, data) {
        const campaignId = CAMPAIGN.campaignId;
        if (!this.entries[campaignId]) {
            this.entries[campaignId] = [];
        }
        if (!name) { return; }
        console.log('Creating entry:', type, name, data);
        console.log('Existing entries:', this.entries[campaignId]);
        const existingEntry = this.entries[campaignId].find(entry => entry.type === type && entry.name === name);
        if (existingEntry) {
            const message = `Entry with name ${name} already exists.`;
            this.toast(message);
            return message;
        }
        const newEntry = {
            id: `${type}_${Date.now()}`,
            type: type,
            name: name,
            properties: this.typifyData(data ?? {}),
            lastAccessed: new Date().toISOString()
        };
        this.entries[campaignId].push(newEntry);
        this.saveEntries();
        const message = `Entry with name ${name} created.`;
        this.tippyInfo(message+( data ? "<br><br>"+JSON.stringify(data, null, 2)+"" : "" ));
        this.toast(message);
        return newEntry.id;
    }

    getEntryByIdOrName(id, name) {
        const campaignId = CAMPAIGN.campaignId;
        if (!this.entries[campaignId]) {
            this.toast(`No entries found for this campaign.`);
            return null;
        }
        const entry = this.entries[campaignId].find(entry => id && entry.id === id || name && entry.name === name);
        if (entry) {
            entry.lastAccessed = new Date().toISOString();
            this.saveEntries();
            this.toast(`Entry with id ${id} or name ${name} accessed successfully.`);
            return entry;
        }
        const message = `Entry with id ${id} or name ${name} not found.`;
        this.toast(message);
        return null;
    }

    findEntries(type, query) {
        const campaignId = CAMPAIGN.campaignId;
        if (!this.entries[campaignId]) {
            this.toast(`No entries found for this campaign.`);
            return [];
        }
        const results = this.entries[campaignId].filter(entry => entry.type === type && Object.keys(query).every(key => entry.properties[key] === query[key]));
        results.forEach(entry => entry.lastAccessed = new Date().toISOString());
        this.saveEntries();
        this.toast(`${results.length} entries found.`);
        return results;
    }

    updateEntry(id, name, data) {
        const campaignId = CAMPAIGN.campaignId;
        if (!this.entries[campaignId]) {
            this.toast(`No entries found for this campaign.`);
            return `Entry with id ${id} or name ${name} not found.`;
        }
        const entry = this.entries[campaignId].find(entry => id && entry.id === id || name && entry.name === name || id && entry.name === id);
        if (entry) {
            const previousAffinity = entry.properties.affinity ?? 0;
            console.log('previousAffinity', previousAffinity, 'data', data);
            Object.assign(entry.properties, this.typifyData(data));
            entry.lastAccessed = new Date().toISOString();
            this.saveEntries();
            let message = `${entry.name} updated.`;
            this.tippyInfo(message);
            this.toast(message);
            return message;
        }
        const message = `Entry with id ${id} or name ${name} not found.`;
        this.toast(message);
        console.warn(message,campaignId,this.entries);
        return message;
    }

    updateEntryProperty(id, name, key, value) {
        const campaignId = CAMPAIGN.campaignId;
        if (!this.entries[campaignId]) {
            this.toast(`No entries found for this campaign.`);
            return `Entry with id ${id} or name ${name} not found.`;
        }
        const entry = this.entries[campaignId].find(entry => id && entry.id === id || name && entry.name === name);
        if (entry) {
            const previousAffinity = entry.properties.affinity ?? 0;
            entry.properties[key] = this.typifyData(value);
            entry.lastAccessed = new Date().toISOString();
            this.saveEntries();
            let message;
            if (key === "affinity" && previousAffinity) {
                if (parseInt(value) > parseInt(previousAffinity)) {
                    message = `${entry.name} liked that. 🎉`;
                } else if (parseInt(value) < parseInt(previousAffinity)) {
                    message = `${entry.name} disliked that. 💔`;
                } else {
                    message = `${entry.name} updated.`;
                }
            } else {
                message = `${entry.name} updated.`;
            }
            this.tippyInfo(message);
            this.toast(message);
            return message;
        }
        const message = `Entry with id ${id} or name ${name} not found.`;
        this.toast(message);
        return message;
    }

    deleteEntryProperty(id, name, key) {
        const campaignId = CAMPAIGN.campaignId;
        if (!this.entries[campaignId]) {
            this.toast(`No entries found for this campaign.`);
            return `Entry with id ${id} or name ${name} not found.`;
        }
        const entry = this.entries[campaignId].find(entry => id && entry.id === id || name && entry.name === name);
        if (entry) {
            delete entry.properties[key];
            entry.lastAccessed = new Date().toISOString();
            this.saveEntries();
            const message = `${entry.name} - ${key} deleted.`;
            this.tippyInfo(message);
            this.toast(message);
            return message;
        }
        const message = `Entry with id ${id} or name ${name} not found.`;
        this.toast(message);
        return message;
    }

    appendToEntry(id, name, field, value) {
        const campaignId = CAMPAIGN.campaignId;
        if (!this.entries[campaignId]) {
            this.toast(`No entries found for this campaign.`);
            return `Entry with id ${id} or name ${name} not found.`;
        }
        const entry = this.entries[campaignId].find(entry => id && entry.id === id || name && entry.name === name);
        if (entry) {
            if (!Array.isArray(entry.properties[field])) {
                entry.properties[field] = [];
            }
            if (typeof value === 'array') {
                value = value.join(', ');
            }
            entry.properties[field].push(this.typifyData(value));
            entry.lastAccessed = new Date().toISOString();
            this.saveEntries();
            const message = `${entry.name} - ${field} updated.`;
            this.tippyInfo(message+"<br><br><code>"+JSON.stringify({field:value}, null, 2)+"</code>");
            this.toast(message);
            return message;
        }
        const message = `Entry with id ${id} or name ${name} not found.`;
        this.toast(message);
        return message;
    }

    deleteEntry(id, name) {
        const campaignId = CAMPAIGN.campaignId;
        if (!this.entries[campaignId]) {
            this.toast(`No entries found for this campaign.`);
            return `Entry with id ${id} or name ${name} not found.`;
        }
        const index = this.entries[campaignId].findIndex(entry => entry.id === id || entry.name === name);
        if (index !== -1) {
            this.entries[campaignId].splice(index, 1);
            this.saveEntries();
            let identifier = id ? `id ${id}` : `name ${name}`;
            const message = `${entry.name} deleted.`;
            this.toast(message);
            return message;
        }
        const message = `Entry with id ${id} or name ${name} not found.`;
        this.tippyInfo(message);
        this.toast(message);
        return message;
    }

    replaceEntry(id, name, data) {
        const campaignId = CAMPAIGN.campaignId;
        if (!this.entries[campaignId]) {
            this.toast(`No entries found for this campaign.`);
            return `Entry with id ${id} or name ${name} not found.`;
        }
        const index = this.entries[campaignId].findIndex(entry => entry.id === id || entry.name === name);
        if (index !== -1) {
            this.entries[campaignId][index] = {
                id: id,
                type: data.type,
                name: data.name,
                properties: this.typifyData(data),
                lastAccessed: new Date().toISOString()
            };
            this.saveEntries();
            const message = `${entry.name} replaced.`;
            this.tippyInfo(message+"<br><br><code>"+JSON.stringify(data, null, 2)+"</code>");
            this.toast(message);
            return message;
        }
        const message = `Entry with id ${id} or name ${name} not found.`;
        this.toast(message);
        return message;
    }

    touchEntry(id, name) {
        const campaignId = CAMPAIGN.campaignId;
        if (!this.entries[campaignId]) {
            this.toast(`No entries found for this campaign.`);
            return `Entry with id ${id} or name ${name} not found.`;
        }
        const entry = this.entries[campaignId].find(entry => id && entry.id === id || name && entry.name === name);
        if (entry) {
            entry.lastAccessed = new Date().toISOString();
            this.saveEntries();
            let identifier = id ? `id ${id}` : `name ${name}`;
            const message = `${identifier} - ${entry.type} timestamp updated.`;
            //this.toast(message);
            return message;
        }
        let identifier = id ? `id ${id}` : `name ${name}`;
        const message = `${identifier} - ${entry.type} not found.`;
        this.toast(message);
        return message;
    }

    showNotebookDialog() {
        const campaignId = CAMPAIGN.campaignId;
        if (!this.entries[campaignId]) {
            this.toast('No entries found for this campaign.');
            return;
        }

        console.info('Notebook entries', this.entries[campaignId]);

        const types = [...new Set(this.entries[campaignId].map(entry => entry.type))];
        let content = `
            <div id="notebook-dialog" class="p-4 rounded-lg shadow-lg">
                <div class="mb-4">
                    <label for="type-select" class="block text-sm font-medium text-gray-300 mb-2">Select Type</label>
                    <select id="type-select" class="w-full bg-gray-700 border border-gray-600 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Select type</option>
                        ${types.map(type => `<option value="${type}">${type.charAt(0).toUpperCase() + type.slice(1)}</option>`).join('')}
                    </select>
                </div>
                <div class="mb-4">
                    <label for="name-select" class="block text-sm font-medium text-gray-300 mb-2">Select Name</label>
                    <select id="name-select" class="w-full bg-gray-700 border border-gray-600 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Select name</option>
                    </select>
                </div>
                <div id="entry-properties" class="bg-gray-800 p-4 rounded-md text-white text-left"></div>
                <button id="save-button" class="mt-4 bg-blue-500 text-white px-4 py-2 rounded-md">Save</button>
                <button id="delete-button" class="mt-4 bg-red-500 text-white px-4 py-2 rounded-md">Delete</button>
            </div>
        `;

        $.confirm({
            title: 'Notebook Entries',
            content: content,
            boxWidth: '400px',
            useBootstrap: false,
            buttons: {
                close: {
                    text: 'Close',
                    btnClass: 'btn btn-default',
                    action: function () {}
                }
            },
            onContentReady: () => {
                $('#type-select').on('change', () => {
                    const selectedType = $('#type-select').val();
                    const names = this.entries[campaignId]
                        .filter(entry => entry.type === selectedType)
                        .map(entry => entry.name);
                    $('#name-select').html('<option value="">Select name</option>' + names.map(name => `<option value="${name}">${name}</option>`).join(''));
                });

                $('#name-select').on('change', () => {
                    const selectedName = $('#name-select').val();
                    const entry = this.entries[campaignId].find(entry => entry.name === selectedName);
                    if (entry) {
                        $('#entry-properties').html(this.generateEditableFields(entry.properties));
                    } else {
                        $('#entry-properties').html('');
                    }
                });

                $('#save-button').on('click', () => {
                    const selectedName = $('#name-select').val();
                    const entry = this.entries[campaignId].find(entry => entry.name === selectedName);
                    if (entry) {
                        const updatedProperties = this.collectUpdatedProperties();
                        this.updateEntry(entry.id, entry.name, updatedProperties);
                    }
                });

                $('#delete-button').on('click', () => {
                    const selectedName = $('#name-select').val();
                    const entry = this.entries[campaignId].find(entry => entry.name === selectedName);
                    if (entry) {
                        this.deleteEntry(entry.id, entry.name);
                        $('#entry-properties').html('');
                    }
                });
            }
        });
    }

    generateEditableFields(properties, prefix = '') {
        let fields = '';
        Object.keys(properties).forEach((key, index) => {
            console.log('key', key, typeof key);
            const displayKey = prefix ? `${prefix}[${key}]` : key;
            const value = properties[key];
            if (Array.isArray(value)) {
                fields += `<div class="mb-4">
                    <label class="block text-sm font-medium text-gray-300 mb-2">${displayKey}</label>
                    ${value.map((item, idx) => this.generateEditableFields({ [idx]: item }, `${displayKey}`)).join('')}
                </div>`;
            } else if (typeof value === 'object' && value !== null) {
                fields += `<div class="mb-4">
                    <label class="block text-sm font-medium text-gray-300 mb-2">${displayKey}</label>
                    ${this.generateEditableFields(value, displayKey)}
                </div>`;
            } else {
                const isLongText = typeof value === 'string' && value.length > 50;
                fields += `<div class="mb-4">
                    <label for="${displayKey}" class="block text-sm font-medium text-gray-300 mb-2">${displayKey}</label>
                    ${isLongText ? 
                        `<textarea id="${displayKey}" class="w-full bg-gray-700 border border-gray-600 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">${value}</textarea>` :
                        `<input type="text" id="${displayKey}" class="w-full bg-gray-700 border border-gray-600 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" value="${value}">`
                    }
                </div>`;
            }
        });
        return fields;
    }

    collectUpdatedProperties() {
        const updatedProperties = {};
        $('#entry-properties input, #entry-properties textarea').each(function() {
            const id = $(this).attr('id');
            let value = $(this).val();
            if (value === null || value === '' || (typeof value === 'string' && value.trim() === '')) {
                return; // Skip empty/null/NaN values
            }
            const keys = id.split(/[\[\]]+/).filter(Boolean);
            let current = updatedProperties;
            for (let i = 0; i < keys.length; i++) {
                if (i === keys.length - 1) {
                    current[keys[i]] = value;
                } else {
                    current = current[keys[i]] = current[keys[i]] || (isNaN(keys[i + 1]) ? {} : []);
                }
            }
        });

        function cleanProperties(properties) {
            for (const key in properties) {
                if (properties[key] === null || properties[key] === '' || (typeof properties[key] === 'string' && properties[key].trim() === '')) {
                    delete properties[key];
                } else if (typeof properties[key] === 'object') {
                    cleanProperties(properties[key]);
                    if (Object.keys(properties[key]).length === 0) {
                        delete properties[key];
                    }
                }
            }
        }

        cleanProperties(updatedProperties);
        return updatedProperties;
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
        this.areas = [];
        this.pointsOfInterest = [];
        this.locations = []; // areas + points of interest
        this.loadCharacters();
        this.loadLocations();
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
                //this.getCharactersLegacy();
            } else {
                //this.getCharactersLegacy();
            }
        });
    }

    loadLocations() {
        chrome.storage.local.get(`locations_${this.campaignId}`, (result) => {
            if (result[`locations_${this.campaignId}`]) {
                this.locations = result[`locations_${this.campaignId}`];
                console.log('Locations loaded from cache:', this.locations);
                //VOICE.createUI();
                //CAPTION.prepareAllTexts();
                this.getLocationsLegacy();
            } else {
                console.log('Locations not found in cache, fetching from Fables');
                this.getLocationsLegacy();
            }
        });
    }

    async getCharactersLegacy() {
        const worldLink = document.querySelector(`a[href="/${this.campaignId}/play/world"]`);
        if (worldLink) {
            worldLink.click();
        } else {
            console.error('World link not found');
            return false;
        }
        // get button with text Characters
        let charactersButton;
        const startTime = Date.now();
        while (!charactersButton && Date.now() - startTime < 5000) {
            charactersButton = Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('Characters') && !button.textContent.includes('Load'));
            if (!charactersButton) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }
        if (!charactersButton) {
            console.log('Characters button not found');
            return false;
        }
        console.log('Characters button found', charactersButton);
        setTimeout(() => {
            charactersButton.click();
            // Press enter on the button
            charactersButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            charactersButton.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true }));
            charactersButton.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
            setTimeout(() => {
                const characters = Array.from(document.querySelectorAll('button[id^="radix-:r"]'))
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

                console.log('Characters found:', characters);
                this.characters = characters;
                
                this.cacheCharacters();
                
                VOICE.createUI();
                CAPTION.prepareAllTexts();

                if (characters.length > 0) {
                    alert(characters.length + ' characters loaded from Fables campaign');
                }
            }, 1500);
        }, 500);
        return true;
    }

    cacheCharacters() {
        chrome.storage.local.set({ [`characters_${this.campaignId}`]: this.characters }, () => {
            console.log('Characters cached for campaign:', this.campaignId);
        });
    }

    async locationList() {
        //console.log('Getting location list');

        const waitForButton = async (text, timeout = 5000) => {
            const start = Date.now();
            while (Date.now() - start < timeout) {
                const button = Array.from(document.querySelectorAll('button')).find(
                    button => button.textContent.includes(text)
                );
                if (button) return button;
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return null;
        };

        const waitForElement = async (selector, timeout = 5000) => {
            const start = Date.now();
            while (Date.now() - start < timeout) {
                const element = document.querySelector(selector);
                if (element) return element;
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return null;
        };

        // Find and click the "Change location" button
        const changeLocationButton = await waitForButton('Change location');
        if (!changeLocationButton) {
            console.log('Change location button not found');
            return [];
        } else {
            changeLocationButton.click();
            //console.log('Clicked "Change location" button');
        }

        // If location not found, click "Select a Location" button
        const selectLocationButton = await waitForButton('Select a Location');
        if (!selectLocationButton) {
            console.log('"Select a Location" button not found');
            return [];
        }
        selectLocationButton.click();
        //console.log('Clicked "Select a Location" button');

        const locationList = [];

        // Find and click the location in the list
        const locationsReady = await waitForElement('div[cmdk-item]', 2000);
        if (!locationsReady) {
            console.log('Locations not ready');
            return [];
        }
        const locationElements = document.querySelectorAll('div.relative.flex.cursor-default.select-none.items-center.rounded-sm.px-2.py-1\\.5.text-sm.outline-none');
        //console.log('Location elements:', locationElements);
        for (const element of locationElements) {
            const location = element.getAttribute('data-value');
            if (location !== 'undefined' && location !== null) {
                locationList.push(location);
            }
        }
        if (!locationList.length) {
            console.log(`Locations not found in the list of available locations`);
        }
        changeLocationButton.click();
        return locationList;
    }

    async getLocationsLegacy() {
        //console.log('Getting locations...');
        const locations = await this.locationList();
        //console.log('Locations:', locations);
        if (locations.length > 0) {
            this.locations = locations;
            this.cacheLocations();
        }
        return locations;
    }

    async getLocations() {
        const url = 'https://play.fables.gg/' + this.campaignId + '/play/world';
        
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);

        iframe.src = url;
        iframe.onload = () => {
            setTimeout(() => {
                // get areas
                // then switch to points of interest
                const areas = Array.from(iframe.contentDocument.querySelectorAll('div.p-4.rounded-md.bg-card'))
                    .map(card => {
                        const divs = card.querySelectorAll('div');
                        let nameElement;
                        let typeElement = 'N/A';
                        let descriptionElement;
                        let coordinatesElement;
                        if (divs.length < 4) {
                            nameElement = divs[0];
                            descriptionElement = divs[1];
                            coordinatesElement = divs[2];
                        } else {
                            nameElement = divs[0];
                            typeElement = divs[1];
                            descriptionElement = divs[2];
                            coordinatesElement = divs[3];
                        }
                        
                        const name = nameElement ? nameElement.textContent.trim() : 'Unknown';
                        
                        if (name === 'Unknown') {
                            return null;
                        }
                        
                        return {
                            name: name,
                            type: (typeof typeElement === 'string' ? typeElement : (typeElement && typeElement.textContent ? typeElement.textContent.trim() : '')),
                            description: descriptionElement ? descriptionElement.textContent && descriptionElement.textContent.trim() : '',
                            coordinates: coordinatesElement ? coordinatesElement.textContent.trim() : ''
                        };
                    })
                    .filter(location => location !== null);

                console.log('Areas found:', areas);
                this.areas = areas ? areas : self.areas;
                
                const pointsOfInterestButton = Array.from(iframe.contentDocument.querySelectorAll('button')).filter(button => button.textContent.includes('Points of Interest'));
                if (pointsOfInterestButton.length > 0) {
                    console.log('Points of Interest button found');
                    pointsOfInterestButton[0].focus();
                    pointsOfInterestButton[0].dispatchEvent(new KeyboardEvent('keydown', {
                        key: 'Enter',
                        bubbles: true,
                        cancelable: true
                    }));
                    setTimeout(() => {
                        const pointsOfInterest = Array.from(iframe.contentDocument.querySelectorAll('div.p-4.rounded-md.bg-card'))
                        .map(card => {
                            const nameElement = card.querySelector('.text-2xl');
                            const descriptionElement = card.querySelector('div:nth-child(2)');
                            const coordinatesElement = card.querySelector('div.mt-4');
                            
                            const name = nameElement ? nameElement.textContent.trim() : 'Unknown';
                            
                            if (name === 'Unknown') {
                                return null;
                            }
                            
                            return {
                                name: name,
                                type: 'POI',
                                description: descriptionElement ? descriptionElement.textContent.trim() : '',
                                coordinates: coordinatesElement ? coordinatesElement.textContent.trim() : ''
                            };
                        })
                        .filter(location => location !== null);

                        this.pointsOfInterest = pointsOfInterest ? pointsOfInterest : self.pointsOfInterest;
                        console.log('Points of Interest:', this.pointsOfInterest);

                        this.locations = [...this.areas, ...this.pointsOfInterest];
                        this.cacheLocations();
                        //CAPTION.prepareAllTexts();
                
                        document.body.removeChild(iframe);
                    }, 1500);
                }
            }, 3000);
        };
    }

    cacheLocations() {
        chrome.storage.local.set({ [`locations_${this.campaignId}`]: this.locations }, () => {
            console.log('Locations cached for campaign:', this.campaignId);
        });
    }

    formatLocations(fields = [], join = "\n", type = null) {
        if (typeof fields === 'string') {
            fields = [fields];
        }
        return this.locations.filter(location => {
            if (type === null) return true;
            if (type.toLowerCase() === 'poi') return location.type === 'POI';
            if (type.toLowerCase() === 'area') return location.type !== 'POI';
            return true;
        }).map(location => {
            if (fields.length === 0) {
                return `${location.name}`;
            } else {
                return fields.map(field => location[field]).join(' ');
            }
        }).join(join);
    }

    async requestLocation(location) {
        console.log('Requesting location:', location);
        
        UI.addTippy(document.getElementById('location-suggestion-button'), 'Location: ' + location);

        // Check if we're already at the requested location
        const currentLocationElements = document.querySelectorAll('h3.text-lg');
        const isAlreadyAtLocation = Array.from(currentLocationElements).some(element => 
            element.textContent.trim() === location
        );
        
        if (isAlreadyAtLocation) {
            //console.log('Already at the requested location:', location);
            return;
        }

        const waitForButton = async (text, timeout = 5000) => {
            const start = Date.now();
            while (Date.now() - start < timeout) {
                const button = Array.from(document.querySelectorAll('button')).find(
                    button => button.textContent.includes(text)
                );
                if (button) return button;
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return null;
        };

        const waitForElement = async (selector, timeout = 5000) => {
            const start = Date.now();
            while (Date.now() - start < timeout) {
                const element = document.querySelector(selector);
                if (element) return element;
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return null;
        };

        // Find and click the "Change location" button
        const changeLocationButton = await waitForButton('Change location');
        if (!changeLocationButton) {
            console.log('Change location button not found');
            //return;
        } else {
            changeLocationButton.click();
            //console.log('Clicked "Change location" button');
        }

        // If location not found, click "Select a Location" button
        const selectLocationButton = await waitForButton('Select a Location');
        if (!selectLocationButton) {
            console.log('"Select a Location" button not found');
            return;
        }
        selectLocationButton.click();
        //console.log('Clicked "Select a Location" button');

        // Find and click the location in the list
        const locationElement = await waitForElement(`div[data-value="${location}"]`, 2000);
        if (!locationElement) {
            console.log(`Location "${location}" not found in the list of available locations`);
            changeLocationButton.click();
            return;
        }

        locationElement.click();
        //console.log(`Selected location: ${location}`);

        // Click the "Update Location" button
        const updateLocationButton = await waitForButton('Update Location');
        if (!updateLocationButton) {
            console.log('"Update Location" button not found');
            return;
        }
        updateLocationButton.click();
        //console.log('Clicked "Update Location" button');
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

    updateNotebook() {
        // let's edit the custom instructions
        console.log('Updating notebook...');
        var url = `https://play.fables.gg/${this.campaignId}/play/settings`;
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);

        iframe.src = url;
        iframe.onload = () => {
            setTimeout(() => {
                // get areas
                // then switch to points of interest
                const textarea = iframe.contentDocument.querySelector('textarea');
                if (!textarea) {
                    console.log('Textarea not found');
                    return;
                }
                // let's find the notebook entry <notebook></notebook> within the textarea value
                const instructions = textarea.value;
                let notebookStart = instructions.indexOf("<notebook>");
                let notebookEnd = instructions.indexOf('</notebook>');
                let newNotebookContent = NOTEBOOK.getNotebook();

                if (notebookStart === -1 || notebookEnd === -1) {
                    console.log('Notebook not found');
                    // let's create it and add the new notebook content
                    textarea.value = instructions + "\n\n<notebook>\n" + newNotebookContent + "\n</notebook>\n";
                } else {
                    // replace the content between <notebook> and </notebook> with the new notebook content
                    textarea.value = instructions.substring(0, notebookStart + "<notebook>".length) + "\n" + newNotebookContent + "\n</notebook>";
                }
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                console.log('Notebook content replaced:', newNotebookContent);

                // let's wait for the save button to appear
                setTimeout(() => {  
                    const saveButton = Array.from(iframe.contentDocument.querySelectorAll('button')).find(button => button.textContent.includes('Save'));
                    console.log('Save button:', saveButton);
                    if (saveButton) {
                        saveButton.click();
                        console.log('Save button clicked');
                        setTimeout(() => {
                            document.body.removeChild(iframe);
                        }, 2000);
                    }
                }, 500);
            }, 3000);
        };
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
                    <label for="voice-select" class="block text-sm font-medium text-gray-300 mb-2">Emotion Preview</label>
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

                <div class="mb-4">
                    <label for="dialog-select" class="block text-sm font-medium text-gray-300 mb-2">Select Dialog</label>
                    <select id="dialog-select" class="w-full bg-gray-700 border border-gray-600 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="Hello, my name is...">Hello, my name is...</option>
                        <option value="Prepare for battle!">Prepare for battle!</option>
                        <option value="By the gods, what have we stumbled upon?">By the gods, what have we stumbled upon?</option>
                        <option value="I'm overjoyed to see you all again!">I'm overjoyed to see you all again!</option>
                        <option value="This loss weighs heavily on my heart.">This loss weighs heavily on my heart.</option>
                        <option value="What secrets does this ancient tome hold?">What secrets does this ancient tome hold?</option>
                        <option value="How dare you betray us!">How dare you betray us!</option>
                        <option value="Victory is ours! Let us celebrate!">Victory is ours! Let us celebrate!</option>
                        <option value="Great Scott! A dragon approaches!">Great Scott! A dragon approaches!</option>
                        <option value="I fear we may not survive this encounter...">I fear we may not survive this encounter...</option>
                        <option value="I wonder what lies beyond that mysterious portal?">I wonder what lies beyond that mysterious portal?</option>
                    </select>
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
                $('#dialog-select').on('change', () => this.temporarilySaveVoice());
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
            const selectedDialog = $('#dialog-select').val();
            const dialogText = selectedDialog && selectedDialog != 'Hello, my name is...' ? selectedDialog : 'Hello, my name is '+characterName+'.';
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
        
        const loadCharactersButton = document.createElement('button');
        loadCharactersButton.id = 'load-characters-button';
        loadCharactersButton.className = 'inline-flex items-center justify-center whitespace-nowrap font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group bg-gray-400 bg-clip-padding backdrop-filter backdrop-blur-md bg-opacity-20 border border-gray-500 hover:border-primary text-gray-300 h-9 rounded-md px-3';
        loadCharactersButton.style.fontSize = '14px';
        loadCharactersButton.style.display = 'flex';
        loadCharactersButton.style.alignItems = 'center';
        loadCharactersButton.style.marginBottom = '10px';
        loadCharactersButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-book mr-2 h-4 w-4" style="margin-bottom: -2px;">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M4 4v16"/>
                <path d="M4 4a2.5 2.5 0 0 1 2.5-2.5H20v16H6.5A2.5 2.5 0 0 1 4 15.5z"/>
            </svg>
            <span style="line-height: 1; margin-top: 1px;">Load Characters</span>
        `;

        const notebookButton = document.createElement('button');
        notebookButton.id = 'notebook-button';
        notebookButton.className = 'inline-flex items-center justify-center whitespace-nowrap font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group bg-gray-400 bg-clip-padding backdrop-filter backdrop-blur-md bg-opacity-20 border border-gray-500 hover:border-primary text-gray-300 h-9 rounded-md px-3';
        notebookButton.style.fontSize = '14px';
        notebookButton.style.display = 'flex';
        notebookButton.style.alignItems = 'center';
        notebookButton.style.marginBottom = '10px';
        notebookButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-book mr-2 h-4 w-4" style="margin-bottom: -2px;">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M4 4v16"/>
                <path d="M4 4a2.5 2.5 0 0 1 2.5-2.5H20v16H6.5A2.5 2.5 0 0 1 4 15.5z"/>
            </svg>
            <span style="line-height: 1; margin-top: 1px;">Notebook</span>
        `;

        const inviteButton = Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('Invite') || button.textContent.includes('Party Full'));
        if (inviteButton && inviteButton.parentNode) {
            inviteButton.parentNode.insertBefore(modeToggleButton, inviteButton);
            inviteButton.parentNode.insertBefore(loadCharactersButton, inviteButton);
            //inviteButton.parentNode.insertBefore(notebookButton, inviteButton);
        }

        modeToggleButton.addEventListener('click', () => {
            this.showPreferencesDialog();
        });

        loadCharactersButton.addEventListener('click', () => {
            CAMPAIGN.getCharactersLegacy();
        });

        //notebookButton.addEventListener('click', () => {
        //    NOTEBOOK.showNotebookDialog();
        //});
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
//NOTEBOOK = new NotebookManager();

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
    chrome.storage.local.get(['ttsEnabled', 'autoPlayNew', 'autoPlayOwn', 'autoSendAfterSpeaking', 'apiKey', 'voiceId', 'speed', 'locationBackground', 'openaiApiKey', 'autoSelectMusic', 'musicAiNotes', 'enableStoryEditor', 'disallowedElements', 'disallowedRelaxed', 'cachedVoices', 'characterVoices', 'useNpcVoices', 'maxRevisions', 'improvedLocationDetection', 'aiEnhancedTranscriptions', 'instructionsText'], function(data) {
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
        improvedLocationDetection = data.improvedLocationDetection || false;
        aiEnhancedTranscriptions = data.aiEnhancedTranscriptions || false;
        instructionsText = data.instructionsText || '';
        //console.log('instructionsText', instructionsText);
        if (ttsEnabled) {
            const targetDiv = document.querySelector('.flex.flex-row.items-center.overflow-hidden');
            if (targetDiv) {
                UI.addTTSToggleButton();
            }
        }
        UI.updateBackgroundImage();
        STT.addAIButton();
        OBS.observeOverflowHidden();
        OBS.observeMessageTextarea();
        OBS.observeSendMessage();
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
    if (message.type === 'voices_loaded') {
        console.log('Voices loaded');

        // Show a toast notification
        butterup.toast({
            title: 'Voices Loaded',
            message: 'Your voices have been loaded successfully.',
            location: 'bottom-left',
            icon: false,
            dismissable: true,
            type: 'success',
        });
    }
});

waitPageLoad().then(() => {
    updateSettings();

    OBS.observeBackgroundImage();
    OBS.observeNewMessages();
    OBS.observeURLChanges();
    OBS.observeOverflowHidden();
    OBS.observeMessageTextarea();
    UI.addMicToggle();
    UI.addLocationSuggestion();
    UI.hideAllInstructions();
    UI.initialize();
    STT.addAIButton();
    MUSIC.createUI();
    UTILITY.createUI();
    CAMPAIGN.loadCharacters();
});
