document.addEventListener('DOMContentLoaded', function() {
    const toggleButton = document.getElementById('toggleTTS');
    const statusSpan = document.getElementById('status');
    const apiKeyInput = document.getElementById('apiKey');
    // Remove this line
    // const deepgramApiKeyInput = document.getElementById('deepgramApiKey');
    const voiceSelect = document.getElementById('voiceSelect');
    const speedSelect = document.getElementById('speedSelect');
    const loadVoicesButton = document.getElementById('loadVoices');
    const saveButton = document.getElementById('saveSettings');
    const autoPlayNewCheckbox = document.getElementById('autoPlayNew');
    const autoPlayOwnCheckbox = document.getElementById('autoPlayOwn');
    const autoSendAfterSpeakingCheckbox = document.getElementById('autoSendAfterSpeaking');
    const locationBackgroundSelect = document.getElementById('locationBackground');
    const openaiApiKeyInput = document.getElementById('openaiApiKey');
    const autoSelectMusicCheckbox = document.getElementById('autoSelectMusic');
    const musicAiNotesTextarea = document.getElementById('musicAiNotes');
    const enableStoryEditorCheckbox = document.getElementById('enableStoryEditor');
    const disallowedElementsTextarea = document.getElementById('disallowedElements');
    const useNpcVoicesCheckbox = document.getElementById('useNpcVoices');
    const disallowedRelaxedTextarea = document.getElementById('disallowedRelaxed');
    const maxRevisionsInput = document.getElementById('maxRevisions');
    const improvedLocationDetectionCheckbox = document.getElementById('improvedLocationDetection');

    let cachedVoices = null;

    // Load saved settings
    chrome.storage.local.get(['ttsEnabled', 'apiKey', 'openaiApiKey', 'voiceId', 'cachedVoices', 'speed', 'autoPlayNew', 'autoPlayOwn', 'autoSendAfterSpeaking', 'locationBackground', 'autoSelectMusic', 'musicAiNotes', 'enableStoryEditor', 'disallowedElements', 'useNpcVoices', 'disallowedRelaxed', 'maxRevisions', 'improvedLocationDetection'], function(data) {
        const ttsEnabled = data.ttsEnabled || false;
        updateUI(ttsEnabled);
        apiKeyInput.value = data.apiKey || '';
        openaiApiKeyInput.value = data.openaiApiKey || '';
        cachedVoices = data.cachedVoices;
        if (data.apiKey && cachedVoices) {
            populateVoiceSelect(cachedVoices, data.voiceId);
        } else if (data.apiKey) {
            loadCartesiaVoices(); // Automatically load voices if API key is present but voices are not cached
        }
        speedSelect.value = data.speed || 'normal';
        autoPlayNewCheckbox.checked = data.autoPlayNew !== undefined ? data.autoPlayNew : true;
        autoPlayOwnCheckbox.checked = data.autoPlayOwn || false;
        autoSendAfterSpeakingCheckbox.checked = data.autoSendAfterSpeaking || false;
        locationBackgroundSelect.value = data.locationBackground || 'off';
        autoSelectMusicCheckbox.checked = data.autoSelectMusic || false;
        musicAiNotesTextarea.value = data.musicAiNotes || '';
        enableStoryEditorCheckbox.checked = data.enableStoryEditor || false;
        disallowedElementsTextarea.value = data.disallowedElements || '';
        useNpcVoicesCheckbox.checked = data.useNpcVoices || false;
        disallowedRelaxedTextarea.value = data.disallowedRelaxed || '';
        maxRevisionsInput.value = data.maxRevisions || 3;
        improvedLocationDetectionCheckbox.checked = data.improvedLocationDetection || false;
        updateVoiceSelectStatus();
    });

    apiKeyInput.addEventListener('input', updateVoiceSelectStatus);

    toggleButton.addEventListener('click', function() {
        chrome.storage.local.get('ttsEnabled', function(data) {
            const newState = !data.ttsEnabled;
            chrome.storage.local.set({ttsEnabled: newState}, function() {
                updateUI(newState);
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    chrome.tabs.sendMessage(tabs[0].id, {type: 'tts_state_changed', enabled: newState});
                });
            });
        });
    });

    loadVoicesButton.addEventListener('click', loadCartesiaVoices);

    saveButton.addEventListener('click', function() {
        const apiKey = apiKeyInput.value.trim();
        const openaiApiKey = openaiApiKeyInput.value.trim();
        const voiceId = voiceSelect.value;
        const speed = speedSelect.value;
        const autoPlayNew = autoPlayNewCheckbox.checked;
        const autoPlayOwn = autoPlayOwnCheckbox.checked;
        const autoSendAfterSpeaking = document.getElementById('autoSendAfterSpeaking').checked;
        const locationBackground = locationBackgroundSelect.value;
        const autoSelectMusic = autoSelectMusicCheckbox.checked;
        const musicAiNotes = musicAiNotesTextarea.value.trim();
        const enableStoryEditor = enableStoryEditorCheckbox.checked;
        const disallowedElements = disallowedElementsTextarea.value.trim();
        const useNpcVoices = useNpcVoicesCheckbox.checked;
        const disallowedRelaxed = disallowedRelaxedTextarea.value.trim();
        const maxRevisions = parseInt(maxRevisionsInput.value, 10);
        const improvedLocationDetection = improvedLocationDetectionCheckbox.checked;

        chrome.storage.local.get(['voiceId', 'speed', 'cachedVoices'], function(data) {
            const oldVoiceId = data.voiceId;
            const oldSpeed = data.speed;
            const oldOwnVoiceId = data.ownVoiceId;

            chrome.storage.local.set({
                apiKey: apiKey,
                openaiApiKey: openaiApiKey,
                voiceId: voiceId, 
                speed: speed,
                autoPlayNew: autoPlayNew,
                autoPlayOwn: autoPlayOwn,
                autoSendAfterSpeaking: autoSendAfterSpeaking,
                cachedVoices: data.cachedVoices, // Ensure cached voices are not overwritten
                locationBackground: locationBackground,
                autoSelectMusic: autoSelectMusic,
                musicAiNotes: musicAiNotes,
                enableStoryEditor: enableStoryEditor,
                disallowedElements: disallowedElements,
                useNpcVoices: useNpcVoices,
                disallowedRelaxed: disallowedRelaxed,
                maxRevisions: maxRevisions,
                improvedLocationDetection: improvedLocationDetection
            }, function() {
                if (oldVoiceId !== voiceId || oldSpeed !== speed) {
                    // Clear voice cache if voice or speed has changed
                    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                        chrome.tabs.sendMessage(tabs[0].id, {type: 'clear_audio_cache'});
                    });
                }
                chrome.runtime.sendMessage({type: 'settings_updated'});
                
                // Send message to content script to update settings
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        type: 'update_settings'
                    });
                });
            });
        });
    });

    function updateUI(enabled) {
        statusSpan.textContent = enabled ? 'enabled' : 'disabled';
        toggleButton.textContent = enabled ? 'Disable Addon' : 'Enable Addon';
    }

    function updateVoiceSelectStatus() {
        if (!apiKeyInput.value.trim()) {
            voiceSelect.innerHTML = '<option value="">Add API Key</option>';
        } else if (!cachedVoices) {
            voiceSelect.innerHTML = '<option value="">Press Load Voices</option>';
        }
    }

    function loadCartesiaVoices() {
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            alert('Please enter a Cartesia API key first.');
            return;
        }

        voiceSelect.innerHTML = '<option value="">Loading voices...</option>';

        const url = 'https://api.cartesia.ai/voices';
        const headers = new Headers({
            'Accept': 'application/json',
            'X-API-Key': apiKey,
            'Content-Type': 'application/json',
            'Cartesia-Version': '2024-08-27'
        });

        fetch(url, { headers })
            .then(response => response.json())
            .then(data => {
                cachedVoices = data;
                chrome.storage.local.set({cachedVoices: data}, function() {
                    console.log('Voices cached');
                });
                populateVoiceSelect(data);
                chrome.runtime.sendMessage({type: 'voices_loaded'});
            })
            .catch(error => {
                console.error('Error fetching voices:', error);
                voiceSelect.innerHTML = '<option value="">Error loading voices</option>';
            });
    }

    function populateVoiceSelect(voices, selectedVoiceId = '') {
        voiceSelect.innerHTML = '';
        let wizardmanId = '';
        voices.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.id;
            option.textContent = `${voice.name}`;
            if (voice.name === 'Wizardman') {
                wizardmanId = voice.id;
            }
            voiceSelect.appendChild(option);
        });
        
        if (selectedVoiceId) {
            voiceSelect.value = selectedVoiceId;
        } else if (wizardmanId) {
            voiceSelect.value = wizardmanId;
        }
        
        if (voiceSelect.selectedIndex === -1 && voiceSelect.options.length > 0) {
            voiceSelect.selectedIndex = 0;
        }
    }
});
