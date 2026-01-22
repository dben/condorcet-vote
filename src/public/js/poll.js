document.addEventListener('DOMContentLoaded', () => {
  const POLL_ID = window.POLL_ID;
  const STORAGE_KEY = `vote_${POLL_ID}`;

  // Elements
  const loadingEl = document.getElementById('loading');
  const errorEl = document.getElementById('error');
  const voteFormContainer = document.getElementById('vote-form-container');
  const resultsContainer = document.getElementById('results-container');
  const pollTitleEl = document.getElementById('poll-title');
  const resultsTitleEl = document.getElementById('results-title');
  const voteForm = document.getElementById('vote-form');
  const voterNameInput = document.getElementById('voter-name');
  const optionsList = document.getElementById('options-list');
  const addOptionSection = document.getElementById('add-option-section');
  const newOptionText = document.getElementById('new-option-text');
  const addNewOptionBtn = document.getElementById('add-new-option');
  const viewResultsBtn = document.getElementById('view-results-btn');
  const editVoteBtn = document.getElementById('edit-vote-btn');
  const backToVoteBtn = document.getElementById('back-to-vote-btn');

  let pollData = null;
  let voterToken = null;
  let existingVote = null;
  let rankedOptions = [];
  let unrankedOptions = [];

  // Get or create voter token
  function getVoterToken() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      return data.token;
    }
    const token = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token }));
    return token;
  }

  // Initialize
  async function init() {
    voterToken = getVoterToken();

    try {
      // Load poll data
      const pollResponse = await fetch(`/api/polls/${POLL_ID}`);
      if (!pollResponse.ok) {
        showError();
        return;
      }
      pollData = await pollResponse.json();

      // Check for existing vote
      const voteResponse = await fetch(`/api/polls/${POLL_ID}/vote/${voterToken}`);
      const voteData = await voteResponse.json();

      if (voteData.exists) {
        existingVote = voteData.vote;
      }

      loadingEl.classList.add('hidden');

      if (existingVote) {
        // Show results for returning voter
        await showResults();
      } else {
        // Show voting form
        showVoteForm();
      }
    } catch (error) {
      console.error('Error loading poll:', error);
      showError();
    }
  }

  function showError() {
    loadingEl.classList.add('hidden');
    errorEl.classList.remove('hidden');
  }

  function showVoteForm() {
    pollTitleEl.textContent = pollData.poll.title;
    voteFormContainer.classList.remove('hidden');
    resultsContainer.classList.add('hidden');

    if (existingVote) {
      voterNameInput.value = existingVote.voterName;
      backToVoteBtn.classList.remove('hidden');
    }

    // Setup options
    setupOptions();

    // Show add option if allowed
    if (pollData.poll.allow_new_options) {
      addOptionSection.classList.remove('hidden');
    }
  }

  function setupOptions() {
    rankedOptions = [];
    unrankedOptions = [];

    if (existingVote && existingVote.rankings) {
      // Restore previous rankings
      const rankedIds = [];
      const unrankedIds = [];

      for (const opt of pollData.options) {
        const rank = existingVote.rankings[opt.id];
        if (rank !== null && rank !== undefined) {
          rankedIds.push({ id: opt.id, rank });
        } else {
          unrankedIds.push(opt.id);
        }
      }

      rankedIds.sort((a, b) => a.rank - b.rank);
      rankedOptions = rankedIds.map(r => pollData.options.find(o => o.id === r.id));
      unrankedOptions = unrankedIds.map(id => pollData.options.find(o => o.id === id));
    } else {
      // All options unranked initially
      unrankedOptions = [...pollData.options];
    }

    renderOptions();
  }

  function renderOptions() {
    optionsList.innerHTML = '';

    // Ranked options
    rankedOptions.forEach((opt, idx) => {
      const li = createOptionElement(opt, idx + 1, false);
      optionsList.appendChild(li);
    });

    // Unranked options
    unrankedOptions.forEach(opt => {
      const li = createOptionElement(opt, null, true);
      optionsList.appendChild(li);
    });

    setupDragAndDrop();
  }

  function createOptionElement(option, rank, isUnranked) {
    const li = document.createElement('li');
    li.className = 'sortable-item' + (isUnranked ? ' unranked' : '');
    li.dataset.id = option.id;
    li.draggable = true;

    li.innerHTML = `
      <span class="drag-handle">&#9776;</span>
      <span class="rank">${rank !== null ? rank : '-'}</span>
      <span class="option-text">${escapeHtml(option.text)}</span>
      <button type="button" class="unrank-btn">${isUnranked ? 'Rank' : 'Unrank'}</button>
    `;

    li.querySelector('.unrank-btn').addEventListener('click', () => {
      toggleRank(option.id);
    });

    // Auto-rank unranked items when clicked (but not when clicking the button)
    li.addEventListener('click', (e) => {
      if (isUnranked && !e.target.closest('.unrank-btn')) {
        toggleRank(option.id);
      }
    });

    return li;
  }

  function toggleRank(optionId) {
    const inRanked = rankedOptions.findIndex(o => o.id === optionId);
    const inUnranked = unrankedOptions.findIndex(o => o.id === optionId);

    if (inRanked !== -1) {
      // Move to unranked
      const [opt] = rankedOptions.splice(inRanked, 1);
      unrankedOptions.push(opt);
    } else if (inUnranked !== -1) {
      // Move to ranked (at end)
      const [opt] = unrankedOptions.splice(inUnranked, 1);
      rankedOptions.push(opt);
    }

    renderOptions();
  }

  function setupDragAndDrop() {
    const items = optionsList.querySelectorAll('.sortable-item');
    let draggedItem = null;

    items.forEach(item => {
      item.addEventListener('dragstart', (e) => {
        draggedItem = item;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';

        // Auto-rank unranked items when dragging starts
        if (item.classList.contains('unranked')) {
          item.classList.remove('unranked');
        }
      });

      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        draggedItem = null;
        updateRankingsFromDOM();
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        if (draggedItem && draggedItem !== item) {
          const rect = item.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;

          if (e.clientY < midY) {
            item.parentNode.insertBefore(draggedItem, item);
          } else {
            item.parentNode.insertBefore(draggedItem, item.nextSibling);
          }
        }
      });
    });
  }

  function updateRankingsFromDOM() {
    const items = optionsList.querySelectorAll('.sortable-item');
    rankedOptions = [];
    unrankedOptions = [];

    items.forEach(item => {
      const id = parseInt(item.dataset.id, 10);
      const opt = pollData.options.find(o => o.id === id);
      if (!opt) return;

      if (item.classList.contains('unranked')) {
        unrankedOptions.push(opt);
      } else {
        rankedOptions.push(opt);
      }
    });

    renderOptions();
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
      unrankedOptions.push(data.option);
      newOptionText.value = '';
      renderOptions();
    } catch (error) {
      alert(error.message);
    }
  });

  // Submit vote
  voteForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const voterName = voterNameInput.value.trim();
    if (!voterName) {
      alert('Please enter your name');
      return;
    }

    // Build rankings
    const rankings = {};
    rankedOptions.forEach((opt, idx) => {
      rankings[opt.id] = idx + 1;
    });
    unrankedOptions.forEach(opt => {
      rankings[opt.id] = null;
    });

    try {
      const response = await fetch(`/api/polls/${POLL_ID}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voterName,
          voterToken,
          rankings,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit vote');
      }

      existingVote = { voterName, rankings };
      await showResults();
    } catch (error) {
      alert(error.message);
    }
  });

  // View results
  viewResultsBtn.addEventListener('click', () => showResults());

  // Edit vote
  editVoteBtn.addEventListener('click', () => {
    showVoteForm();
  });

  // Back to results
  backToVoteBtn.addEventListener('click', () => {
    showResults();
  });

  async function showResults() {
    voteFormContainer.classList.add('hidden');
    resultsContainer.classList.remove('hidden');

    try {
      const response = await fetch(`/api/polls/${POLL_ID}/results`);
      const data = await response.json();

      resultsTitleEl.textContent = data.poll.title;
      document.getElementById('vote-count').textContent = data.voteCount;

      if (data.voteCount === 0) {
        document.getElementById('no-votes').classList.remove('hidden');
        document.getElementById('results-content').classList.add('hidden');
      } else {
        document.getElementById('no-votes').classList.add('hidden');
        document.getElementById('results-content').classList.remove('hidden');

        // Render ranking
        const rankingList = document.getElementById('ranking-list');
        rankingList.innerHTML = '';
        data.results.rankedOptions.forEach(opt => {
          const li = document.createElement('li');
          li.textContent = opt.name;
          rankingList.appendChild(li);
        });

        // Render voters
        document.getElementById('voter-names').textContent = data.voters.join(', ');

        // Render matrix
        renderMatrix(data.results.matrix);
      }

      // Show edit button if user has voted
      if (existingVote) {
        editVoteBtn.classList.remove('hidden');
      } else {
        editVoteBtn.classList.add('hidden');
      }
    } catch (error) {
      console.error('Error loading results:', error);
    }
  }

  function renderMatrix(matrix) {
    const table = document.getElementById('matrix-table');
    table.innerHTML = '';

    if (!matrix || matrix.length === 0) return;

    // Header row
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = '<th></th>';
    matrix.forEach(row => {
      headerRow.innerHTML += `<th>${escapeHtml(row.row)}</th>`;
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Data rows
    const tbody = document.createElement('tbody');
    matrix.forEach((row, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<th>${escapeHtml(row.row)}</th>`;

      row.cells.forEach((cell, j) => {
        let className = '';
        if (i === j) {
          className = 'self';
        } else if (cell.prefer > cell.oppose) {
          className = 'win';
        } else if (cell.prefer < cell.oppose) {
          className = 'lose';
        } else {
          className = 'tie';
        }

        const td = document.createElement('td');
        td.className = className;
        td.textContent = i === j ? '-' : cell.prefer;
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Start
  init();
});
