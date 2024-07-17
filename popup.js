document.getElementById('captureBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({action: 'captureScreenshot'});
});

document.getElementById('generateBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({action: 'generateCode'});
});

document.getElementById('copyBtn').addEventListener('click', () => {
  const codeElement = document.getElementById('generatedCode');
  navigator.clipboard.writeText(codeElement.textContent)
    .then(() => {
      document.getElementById('status').textContent = 'Code copied to clipboard!';
    })
    .catch(err => {
      console.error('Failed to copy: ', err);
    });
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'updateStatus') {
    document.getElementById('status').textContent = message.status;
    if (message.status === 'Screenshot captured!') {
      document.getElementById('generateBtn').disabled = false;
    }
  } else if (message.action === 'displayGeneratedCode') {
    const codeElement = document.getElementById('generatedCode');
    codeElement.textContent = message.code;
    document.getElementById('copyBtn').style.display = 'block';
  }
});
