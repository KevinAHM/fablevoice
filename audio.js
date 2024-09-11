class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.buffer = [];
        this.isPlaying = false;
        this.currentPosition = 0;
        this.isDone = false;
        this.currentTime = 0;
        this.sampleRate = 44100;
        this.wordTimestamps = [];
        this.currentWordIndex = 0;

        this.port.onmessage = (event) => {
            if (event.data.type === 'play') {
                console.log('Received play command');
                this.currentPosition = 0;
                this.currentTime = 0;
                this.currentWordIndex = 0;
                this.isPlaying = true;
            } else if (event.data.type === 'pause') {
                this.isPlaying = false;
            } else if (event.data.type === 'stop') {
                console.log('Received stop command');
                this.isPlaying = false;
                this.buffer = [];
                this.currentPosition = 0;
                this.isDone = false;
                this.currentTime = 0;
                this.wordTimestamps = [];
                this.currentWordIndex = 0;
            } else if (event.data.type === 'reset') {
                console.log('Received reset command');
                this.buffer = [];
                this.currentPosition = 0;
                this.isDone = false;
                this.currentTime = 0;
                this.wordTimestamps = [];
                this.currentWordIndex = 0;
            } else if (event.data.type === 'append') {
                this.isDone = false;
                if (event.data.buffer && event.data.buffer.length > 0) {
                    //console.log(`Received append message, buffer length: ${event.data.buffer.length}`);
                    this.buffer.push(event.data.buffer);
                } else {
                    console.error('Received empty or invalid buffer');
                }
            } else if (event.data.type === 'done') {
                this.isDone = true;
            } else if (event.data.type === 'timestamps') {
                this.wordTimestamps = event.data.data.words.map((word, index) => ({
                    word,
                    start: event.data.data.start[index],
                    end: event.data.data.end[index]
                }));
            }
        };
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const channelData = output[0];

        if (this.isPlaying && this.buffer.length > 0) {
            let remainingSamples = channelData.length;
            let outputIndex = 0;

            while (remainingSamples > 0 && this.buffer.length > 0) {
                const currentBuffer = this.buffer[0];
                const availableSamples = currentBuffer.length - this.currentPosition;
                const samplesToProcess = Math.min(remainingSamples, availableSamples);

                //if (this.currentTime < 5) { console.log('samplesToProcess', samplesToProcess, 'currentTime', this.currentTime, 'currentPosition', this.currentPosition, 'buffer', currentBuffer.length); }

                channelData.set(currentBuffer.subarray(this.currentPosition, this.currentPosition + samplesToProcess), outputIndex);

                this.currentPosition += samplesToProcess;
                outputIndex += samplesToProcess;
                remainingSamples -= samplesToProcess;

                this.currentTime += samplesToProcess / this.sampleRate;
                this.checkAndPostActiveWord();

                if (this.currentPosition >= currentBuffer.length) {
                    this.buffer.shift();
                    this.currentPosition = 0;
                }
            }

            if (remainingSamples > 0) {
                channelData.fill(0, outputIndex);
            }

            if (this.buffer.length === 0 && this.isDone) {
                this.isPlaying = false;
                this.port.postMessage({ type: 'finished' });
            } else if (this.buffer.length === 0) {
                console.log('buffer is empty and isDone is false');
            }
        } else {
            channelData.fill(0);
        }

        return true;
    }

    checkAndPostActiveWord() {
        const epsilon = 0.001; // Small threshold to account for floating-point imprecision

        while (this.currentWordIndex < this.wordTimestamps.length) {
            const activeWord = this.wordTimestamps[this.currentWordIndex];
            
            // Skip words that have already ended
            if (this.currentTime > activeWord.end + epsilon) {
                this.currentWordIndex++;
                continue;
            }
            
            // Check if the current time is within the word's duration
            if (this.currentTime >= activeWord.start - epsilon && this.currentTime <= activeWord.end + epsilon) {
                //console.log('activeWord', activeWord.word, this.currentTime, activeWord.start, activeWord.end);
                this.port.postMessage({
                    type: 'activeWord',
                    word: activeWord.word,
                    start: activeWord.start,
                    end: activeWord.end,
                    index: this.currentWordIndex
                });
                this.currentWordIndex++;
            } else {
                // If we haven't reached the start of the next word, break the loop
                break;
            }
        }
    }
}

registerProcessor('tts-audio-processor', AudioProcessor);
