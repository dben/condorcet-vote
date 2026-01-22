document.addEventListener('DOMContentLoaded', () => {
  const POLL_ID = window.POLL_ID;

  // Elements
  const loadingEl = document.getElementById('loading');
  const errorEl = document.getElementById('error');
  const notAllowedEl = document.getElementById('not-allowed');
  const addOptionsContainer = document.getElementById('add-options-container');
  const pollTitleEl = document.getElementById('poll-title');
  const currentOptionsList = document.getElementById('current-options');
  const newOptionText = document.getElementById('new-option-text');
  const addNewOptionBtn = document.getElementById('add-new-option');
  const goToPollLink = document.getElementById('go-to-poll');
  const goToPollNotAllowedLink = document.getElementById('go-to-poll-not-allowed');

  let pollData = null;

  // Initialize
  async function init() {
    try {
      const pollResponse = await fetch(`/api/polls/${POLL_ID}`);
      if (!pollResponse.ok) {
        showError();
        return;
      }
      pollData = await pollResponse.json();

      loadingEl.classList.add('hidden');

      // Check if adding options is allowed
      if (!pollData.poll.allow_new_options) {
        showNotAllowed();
        return;
      }

      showAddOptions();
    } catch (error) {
      console.error('Error loading poll:', error);
      showError();
    }
  }

  function showError() {
    loadingEl.classList.add('hidden');
    errorEl.classList.remove('hidden');
  }

  function showNotAllowed() {
    notAllowedEl.classList.remove('hidden');
    goToPollNotAllowedLink.href = `/poll/${POLL_ID}`;
  }

  function showAddOptions() {
    pollTitleEl.textContent = pollData.poll.title;
    goToPollLink.href = `/poll/${POLL_ID}`;
    addOptionsContainer.classList.remove('hidden');
    renderCurrentOptions();
  }

  function renderCurrentOptions() {
    currentOptionsList.innerHTML = '';
    pollData.options.forEach(opt => {
      const li = document.createElement('li');
      li.textContent = opt.text;
      currentOptionsList.appendChild(li);
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Add new option
  addNewOptionBtn.addEventListener('click', async () => {
    const text = newOptionText.value.trim();
    if (!text) return;

    try {
      const response = await fetch(`/api/polls/${POLL_ID}/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add option');
      }

      const data = await response.json();
      pollData.options.push(data.option);
      newOptionText.value = '';
      renderCurrentOptions();
      newOptionText.focus();
    } catch (error) {
      alert(error.message);
    }
  });

  // Allow Enter key to add option
  newOptionText.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addNewOptionBtn.click();
    }
  });

  // Start
  init();
});
