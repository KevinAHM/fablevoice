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

  if (request.action === 'runNotebookAI') {
    console.log('Running Notebook AI request');
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
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "createEntry",
              description: "Create a new entry in the notebook",
              parameters: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  name: { type: "string" },
                  data: { type: "object" }
                },
                required: ["type", "name", "data"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "doNothing",
              description: "Do nothing",
              parameters: {
                type: "object",
                properties: {
                  reason: { type: "string" }
                },
                required: ["reason"]
              }
            }
          },
          /*
          {
            type: "function",
            function: {
              name: "getEntryById",
              description: "Retrieve an entry by its ID",
              parameters: {
                type: "object",
                properties: {
                  id: { type: "string" }
                },
                required: ["id"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "findEntries",
              description: "Find entries by type and query",
              parameters: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  query: { type: "object" }
                },
                required: ["type", "query"]
              }
            }
          },
          */
          {
            type: "function",
            function: {
              name: "updateEntry",
              description: "Update an entry by its ID or Name (if unique identifier)",
              parameters: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  data: { type: "object" }
                },
                required: ["id", "name", "data"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "updateEntryProperty",
              description: "Update a specific property of an entry by its ID or Name (if unique identifier)",
              parameters: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  key: { type: "string" },
                  value: { 
                    type: ["string", "number", "boolean", "object", "array", "null"],
                    items: {}
                  }
                },
                required: ["id", "name", "key", "value"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "deleteEntryProperty",
              description: "Delete a specific property of an entry by its ID or Name (if unique identifier)",
              parameters: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  key: { type: "string" }
                },
                required: ["id", "name", "key"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "appendToEntry",
              description: "Append a value to an array field in an entry by its ID or Name (if unique identifier)",
              parameters: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  field: { type: "string" },
                  value: { type: "string" }
                },
                required: ["id", "name", "field", "value"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "deleteEntry",
              description: "Delete an entry by its ID or Name (if unique identifier)",
              parameters: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" }
                },
                required: ["id", "name"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "replaceEntry",
              description: "Replace an entry by its ID or Name (if unique identifier)",
              parameters: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  data: { type: "object" }
                },
                required: ["id", "name", "data"]
              }
            }
          }
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
        sendResponse({ data: data.choices[0].message.content, tool_calls: data.choices[0].message.tool_calls });
      }
    })
    .catch(error => {
      console.error('Error running LLM:', error);
      sendResponse({ error: error.message });
    });
    return true; // Indicates that the response is sent asynchronously
  }
});
