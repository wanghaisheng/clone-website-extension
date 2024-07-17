
// background.js
let screenshot = null;
const CLAUDE_API_KEY = 'YOUR_CLAUDE_API_KEY';
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'captureScreenshot') {
    captureFullPageScreenshot();
  } else if (message.action === 'generateCode') {
    generateCodeFromScreenshot();
  }
});

async function captureFullPageScreenshot() {
  const tab = await getCurrentTab();
  chrome.scripting.executeScript({
    target: {tabId: tab.id},
    function: getFullPageScreenshot
  });
}

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  return tab;
}

function getFullPageScreenshot() {
  const scrollHeight = Math.max(
    document.documentElement.scrollHeight,
    document.body.scrollHeight
  );
  const viewportHeight = window.innerHeight;
  const numScreens = Math.ceil(scrollHeight / viewportHeight);
  
  let fullPageCanvas = document.createElement('canvas');
  fullPageCanvas.width = window.innerWidth;
  fullPageCanvas.height = scrollHeight;
  let ctx = fullPageCanvas.getContext('2d');
  
  function captureScreen(screenNum) {
    return new Promise((resolve) => {
      window.scrollTo(0, screenNum * viewportHeight);
      setTimeout(() => {
        chrome.runtime.sendMessage({action: 'captureVisibleTab'}, (dataUrl) => {
          let img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 0, screenNum * viewportHeight);
            resolve();
          };
          img.src = dataUrl;
        });
      }, 100);
    });
  }
  
  (async () => {
    for (let i = 0; i < numScreens; i++) {
      await captureScreen(i);
    }
    chrome.runtime.sendMessage({
      action: 'screenshotCaptured',
      dataUrl: fullPageCanvas.toDataURL()
    });
  })();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'captureVisibleTab') {
    chrome.tabs.captureVisibleTab(null, {format: 'png'}, sendResponse);
    return true;
  } else if (message.action === 'screenshotCaptured') {
    screenshot = message.dataUrl;
    chrome.runtime.sendMessage({action: 'updateStatus', status: 'Screenshot captured!'});
  }
});

async function sendMessageToModel(prompt, screenshot) {
  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: "claude-3-opus-20240229",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: screenshot.split(',')[1]
              }
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

async function generateCodeFromScreenshot() {
  if (!screenshot) {
    chrome.runtime.sendMessage({action: 'updateStatus', status: 'No screenshot available.'});
    return;
  }

  try {
    // Step 1: Describe the UI
    chrome.runtime.sendMessage({action: 'updateStatus', status: '🧑‍💻 Looking at your UI...'});
    const describePrompt = "Describe this UI in accurate details. When you reference a UI element put its name and bounding box in the format: [object name (y_min, x_min, y_max, x_max)]. Also Describe the color of the elements.";
    const description = await sendMessageToModel(describePrompt, screenshot);

    // Step 2: Refine the description
    chrome.runtime.sendMessage({action: 'updateStatus', status: '🔍 Refining description with visual comparison...'});
    const refinePrompt = `Compare the described UI elements with the provided image and identify any missing elements or inaccuracies. Also Describe the color of the elements. Provide a refined and accurate description of the UI elements based on this comparison. Here is the initial description: ${description}`;
    const refinedDescription = await sendMessageToModel(refinePrompt, screenshot);

    // Step 3: Generate HTML
    chrome.runtime.sendMessage({action: 'updateStatus', status: '🛠️ Generating website...'});
    const framework = "Regular CSS use flex grid etc"; // You can make this configurable if needed
    const htmlPrompt = `Create an HTML file based on the following UI description, using the UI elements described in the previous response. Include ${framework} CSS within the HTML file to style the elements. Make sure the colors used are the same as the original UI. The UI needs to be responsive and mobile-first, matching the original UI as closely as possible. Do not include any explanations or comments. Avoid using \`\`\`html. and \`\`\` at the end. ONLY return the HTML code with inline CSS. Here is the refined description: ${refinedDescription}`;
    const initialHtml = await sendMessageToModel(htmlPrompt, screenshot);

    // Step 4: Refine HTML
    chrome.runtime.sendMessage({action: 'updateStatus', status: '🔧 Refining website...'});
    const refineHtmlPrompt = `Validate the following HTML code based on the UI description and image and provide a refined version of the HTML code with ${framework} CSS that improves accuracy, responsiveness, and adherence to the original design. ONLY return the refined HTML code with inline CSS. Avoid using \`\`\`html. and \`\`\` at the end. Here is the initial HTML: ${initialHtml}`;
    const refinedHtml = await sendMessageToModel(refineHtmlPrompt, screenshot);

    // Store and display the final result
    chrome.storage.local.set({generatedCode: refinedHtml}, () => {
      chrome.runtime.sendMessage({
        action: 'displayGeneratedCode', 
        code: refinedHtml
      });
      chrome.runtime.sendMessage({
        action: 'updateStatus', 
        status: 'Code generated successfully!'
      });
    });
  } catch (error) {
    console.error('Error generating code:', error);
    chrome.runtime.sendMessage({
      action: 'updateStatus', 
      status: 'Error generating code. Please try again.'
    });
  }
}
