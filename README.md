# FableVoice
An unofficial Chrome extension for Friends & Fables.

For Text-To-Speech, get an API key from https://www.cartesia.ai
They have a free plan for testing purposes. Cost ends up around $2.4-$3.0 per hour of audio generated.

Please see the Cartesia's [acceptable use policies](https://cartesia.ai/legal/acceptable-use.html) and OpenAI's [usage policies](https://openai.com/policies/usage-policies/) before using this addon.

For AI Music suggestions, AI-assisted story editing, and NPC voice segmented dialog, get an API key from https://platform.openai.com/account/api-keys
These features use gpt-4o-mini and will cost a fraction of a penny per message.

# Features

## Text-To-Speech (Cartesia)
- NPC voice segmented dialog
  - Each PC and NPC can be assigned a different voice, and the dialog will be segmented into separate voices.

## Speech-To-Text (Built-in to Chrome)

## AI-assisted story editing
- You can specify elements you do not want in the story, and the AI will analyze the story and suggest changes to Franz.

## Active/Relaxed mode toggle
- Similar to AI-assisted story editing, but has a list of items specific to the "relaxed" mode that you can specify such as combat, questing, etc.

## AI-generated music suggestions
- 400+ tracks of DnD music and ambiences provided by Table Top Audio hosted on my server and streamed through the extension.
- Please visit https://tabletopaudio.com/ for more information, and to donate to their Patreon if you enjoy their music.
- Manual or Automatic mode with ability to lock the current track
- Optional notes for the AI to consider when generating music

## Chat Background
- Background of chat has an image of the current location
- Normal and Dark mode options

## Character Information
- Automatic insertion of character names and images when hovering over their names in the chat.

# Installation
The addon isn't yet in the official Chrome store, so you must use developer method of loading unpacked extensions.

- Go to Chrome Settings using three dots on the top right corner. 
- Then Select Extensions.
- Now, Enable developer mode  (Top right toggle)
- Click on Load Unpacked and select your Unzip folder.
- The extension will be installed now.

https://webkul.com/blog/how-to-install-the-unpacked-extension-in-chrome/

If you have any trouble, try reloading the extension and then the fables.gg page.

# Setup

After enabling it..
- Go to an active campaign on fables.gg
- Click the extension icon in the top right hand corner of browser
- Click "Enable Addon"
- Enter your API keys
- Click "Load Voices"
- Select your voices
- Enable/Disable the settings you prefer
- Click "Save Settings"

# Usage

- Enable text-to-speech by clicking the volume icon next to the text entry area at bottom of screen.
- Enable speech-to-text by clicking the microphone icon after selecting a text entry area.
- Setup the "World Tags" for your campaign (the button on the left sidebar) to narrow down the possible selection of music.
- Setup the "Voices" for your campaign's characters. (need to press "Load Voices" in popup menu first)

# Notes

- Text-To-Speech and AI Story Editing are disabled during combat. This is both to help compliance with Cartesia's and OpenAI's acceptable use policies, and to not interfere with the combat encounter mechanics and pacing.
- Cost of Text-To-Speech averages around $2.40 - $3.00 per hour of audio generated.
- Cost of other features (AI story editing, NPC voice diarization) is minimal, less than a fraction of a penny per message, with AI music using the most at around $0.0025 to $0.005 (half a penny) per message. While a track is locked or suggestions are set to manual, no AI music suggestion cost is incurred.
- Not tested on Mac devices.
- There's a chance OpenAI may refuse to generate NPC segmented dialog if it's in violation of their content blocking policies.
- Likewise, please read Cartesia's [acceptable use policies](https://cartesia.ai/legal/acceptable-use.html) and don't include any text that's in violation of their policies. If you are not going over the top, you should be fine.

# Limitations

- The AI story editing depends on Franz to listen to the feedback. It's limited to the capabilities of Franz's AI to listen to instructions.
- There may be unintended consequences of blocking certain elements from the story, such as blocking types of loot which may reduce overall loot if Franz does not listen to the request to come up with suitable alternatives.
- Cartesia text-to-speech is amazing, but has some shortcomings which they are working on (as of September 2024.) There may be clicks and pops in the audio, or rarely, words get repeated or mispronounced.
- "Base Emotion" settings are not used in the story text-to-speech generations, they're for previewing only at the moment. Emotions are detected and applied in the NPC voice segmentation for each voice based on the dialog, unless "Disable Emotion" is selected for a character.

# Known Issues

- Playing TTS on a reply, pausing it while it's still generating, then attempting to play another before the previous generation from Cartesia is finished can cause sound glitches. The solution is to wait for the TTS to finish generting, and then play the next message.
- Sometimes the page requires a refresh if you navigate away and then back to the campaign chat.
- The AI may suggest music changes too frequently or occasionally, to inappropriate tracks. You can accept/deny a suggestion within 5 seconds using the toast notification. You can also click the AI button next to music generator to request a new track, or toggle "Lock" to lock in a track you like.
- When the editor suggests changes to Franz, item pickups and such are cleared by off the screen by Franz, which is ideal, but may cause some confusion if the items are not actually gone, and are just off the screen. This is a Fables.gg bug and not an addon bug.

# To-Do

- Support for other AI services and models like Llama 3 on Ollama, Groq, and so on
- Fixing known bugs
- Adding features
