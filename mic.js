class AudioProcessor extends AudioWorkletProcessor {
	constructor() {
		super();
		this.bufferSize = 2048 * 2;
		this.buffer = new Float32Array(this.bufferSize);
		this.bufferIndex = 0;
	}

	process(inputs, outputs, parameters) {
		const input = inputs[0];
		const channel = input[0];

		if (channel && channel.length > 0) {
			for (let i = 0; i < channel.length; i++) {
				this.buffer[this.bufferIndex] = channel[i];
				this.bufferIndex++;

				if (this.bufferIndex >= this.bufferSize) {
					// Convert Float32Array to Int16Array
					const int16Array = new Int16Array(this.bufferSize);
					for (let j = 0; j < this.bufferSize; j++) {
						int16Array[j] = Math.max(-32768, Math.min(32767, Math.floor(this.buffer[j] * 32768)));
					}

					// Send the buffer to the main thread
					this.port.postMessage(int16Array);

					// Reset buffer index
					this.bufferIndex = 0;
				}
			}
		}

		return true;
	}
}

registerProcessor('mic-processor', AudioProcessor);