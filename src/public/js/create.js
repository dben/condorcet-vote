document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('create-poll-form');
  const optionsContainer = document.getElementById('options-container');
  const addOptionBtn = document.getElementById('add-option');
  const pollCreatedSection = document.getElementById('poll-created');
  const pollLinkInput = document.getElementById('poll-link');
  const copyLinkBtn = document.getElementById('copy-link');
  const goToPollLink = document.getElementById('go-to-poll');

  let optionCount = 2;

  // Add new option input
  addOptionBtn.addEventListener('click', () => {
    optionCount++;
    const div = document.createElement('div');
    div.className = 'option-input';
    div.innerHTML = `
      <input type="text" name="options[]" placeholder="Option ${optionCount}" required>
      <button type="button" class="btn-icon remove-option" title="Remove option">&times;</button>
    `;
    optionsContainer.appendChild(div);
    div.querySelector('input').focus();
  });

  // Remove option input
  optionsContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-option')) {
      const inputs = optionsContainer.querySelectorAll('.option-input');
      if (inputs.length > 2) {
        e.target.closest('.option-input').remove();
        updatePlaceholders();
      }
    }
  });

  function updatePlaceholders() {
    const inputs = optionsContainer.querySelectorAll('.option-input input');
    inputs.forEach((input, index) => {
      input.placeholder = `Option ${index + 1}`;
    });
    optionCount = inputs.length;
  }

  // Form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('title').value.trim();
    const optionInputs = optionsContainer.querySelectorAll('input[name="options[]"]');
    const options = Array.from(optionInputs).map(input => input.value.trim()).filter(v => v);
    const allowNewOptions = document.getElementById('allow-new-options').checked;

    if (options.length < 2) {
      alert('Please provide at least 2 options');
      return;
    }

    try {
      const response = await fetch('/api/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, options, allowNewOptions }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create poll');
      }

      const data = await response.json();
      const pollUrl = window.location.origin + data.url;

      // Show success section
      form.classList.add('hidden');
      pollCreatedSection.classList.remove('hidden');
      pollLinkInput.value = pollUrl;
      goToPollLink.href = data.url;
    } catch (error) {
      alert(error.message);
    }
  });

  // Copy link
  copyLinkBtn.addEventListener('click', () => {
    pollLinkInput.select();
    navigator.clipboard.writeText(pollLinkInput.value).then(() => {
      copyLinkBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyLinkBtn.textContent = 'Copy';
      }, 2000);
    });
  });
});
