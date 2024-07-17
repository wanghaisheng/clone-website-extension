let currentImage = null;

document.getElementById('captureBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({action: 'captureScreenshot'});
});

document.getElementById('imageUpload').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      currentImage = e.target.result;
      document.getElementById('imagePreview').src = currentImage;
      document.getElementById('imagePreview').style.display = 'block';
      document.getElementById('generateBtn').disabled = false;
      document.getElementById('status').textContent = 'Image uploaded!';
    };
    reader.readAsDataURL(file);
  }
});

document.getElementById('generateBtn').addEventListener('click', () => {
  if (currentImage) {
    chrome.runtime.sendMessage({action: 'generateCode', image: currentImage});
  } else {
    chrome.runtime.sendMessage({action: 'generateCode'});
  }
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
      currentImage = null;
      document.getElementById('imagePreview').style.display = 'none';
      document.getElementById('generateBtn').disabled = false;
    }
  } else if (message.action === 'displayGeneratedCode') {
    const codeElement = document.getElementById('generatedCode');
    codeElement.textContent = message.code;
    document.getElementById('copyBtn').style.display = 'block';
  }
});
