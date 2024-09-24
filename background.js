chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchAudio') {
    console.log('Fetching audio from URL:', request.url);
    fetch(request.url)
      .then(response => {
        console.log('Fetch response status:', response.status);
        return response.blob();
      })
      .then(blob => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Data = reader.result.split(',')[1];
          console.log('Audio data received as base64');
          sendResponse({ data: { buffer: base64Data } });
        };
        reader.readAsDataURL(blob);
      })
      .catch(error => {
        console.error('Error fetching audio:', error);
        sendResponse({ error: error.message });
      });
    return true; // Indicates that the response is sent asynchronously
  }

  if (request.action === 'runAI') {
    console.log('Running AI request');
    fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${request.apiKey}`
      },
      body: JSON.stringify({
        model: request.model,
        messages: [
          { role: "system", content: request.systemMessage },
          { role: "user", content: request.userMessage }
        ]
      })
    })
    .then(response => response.json())
    .then(data => {
      console.log('LLM response received', data);
      if (data.error) {
        console.error('Error from OpenAI API:', data.error);
        sendResponse({ error: data.error.message || 'An error occurred with the OpenAI API' });
      } else {
        sendResponse({ data: data.choices[0].message.content });
      }
    })
    .catch(error => {
      console.error('Error running LLM:', error);
      sendResponse({ error: error.message });
    });
    return true; // Indicates that the response is sent asynchronously
  }
});
