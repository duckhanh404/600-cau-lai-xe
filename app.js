const state = {
  all: [],
  mode: 'learn',
  questions: [],
  index: 0,
  answers: {},
  submitted: false,
  examStarted: false,
  examDuration: 20 * 60,
  examRemaining: 20 * 60,
  timerId: null,
  learnChapterFilter: '__ALL__',
};

const el = {
  status: document.getElementById('status'),
  learnModeBtn: document.getElementById('learnModeBtn'),
  reviewWrongModeBtn: document.getElementById('reviewWrongModeBtn'),
  examModeBtn: document.getElementById('examModeBtn'),
  resetBtn: document.getElementById('resetBtn'),
  examInfo: document.getElementById('examInfo'),
  examStartOverlay: document.getElementById('examStartOverlay'),
  examStartBtn: document.getElementById('examStartBtn'),
  chapterSelect: document.getElementById('chapterSelect'),
  navPanel: document.getElementById('navPanel'),
  questionNav: document.getElementById('questionNav'),
  questionCard: document.getElementById('questionCard'),
  qIndex: document.getElementById('qIndex'),
  qCategory: document.getElementById('qCategory'),
  qText: document.getElementById('qText'),
  qImageWrap: document.getElementById('qImageWrap'),
  qImage: document.getElementById('qImage'),
  options: document.getElementById('options'),
  actions: document.getElementById('actions'),
  explain: document.getElementById('explain'),
  resultBox: document.getElementById('resultBox'),
};

const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);
const pickN = (arr, n) => shuffle(arr).slice(0, n);
const WRONG_IDS_KEY = 'gplx_wrong_question_ids_v1';

function getWrongIds() {
  try {
    const raw = localStorage.getItem(WRONG_IDS_KEY);
    const arr = JSON.parse(raw || '[]');
    return new Set(Array.isArray(arr) ? arr : []);
  } catch (_) {
    return new Set();
  }
}

function saveWrongIds(idsSet) {
  localStorage.setItem(WRONG_IDS_KEY, JSON.stringify([...idsSet]));
}

function addWrongId(id) {
  const ids = getWrongIds();
  ids.add(id);
  saveWrongIds(ids);
}

function removeWrongId(id) {
  const ids = getWrongIds();
  ids.delete(id);
  saveWrongIds(ids);
}

function stopTimer() {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateExamInfo() {
  if (state.mode !== 'exam') {
    el.examInfo.classList.add('hidden');
    return;
  }
  el.examInfo.classList.remove('hidden');
  const timerText = state.examStarted ? `Thời gian còn lại: ${fmtTime(state.examRemaining)}` : 'Thời gian làm bài: 20:00';
  const showSubmit = state.examStarted && !state.submitted;
  el.examInfo.innerHTML = `
    <div class="exam-info-row">
      <div class="timer-box ${state.examRemaining <= 60 ? 'danger' : ''}">
        <div class="timer-label">Thời gian</div>
        <div class="timer">${timerText}</div>
      </div>
      ${showSubmit ? '<button id="examSubmitTopBtn" class="exam-submit-top">Nộp bài</button>' : ''}
    </div>
  `;
  if (showSubmit) {
    const submitTopBtn = document.getElementById('examSubmitTopBtn');
    if (submitTopBtn) submitTopBtn.onclick = () => submitExam(false);
  }
}

function startExamTimer() {
  stopTimer();
  state.examStarted = true;
  updateExamInfo();
  state.timerId = setInterval(() => {
    if (state.submitted) {
      stopTimer();
      return;
    }
    state.examRemaining -= 1;
    updateExamInfo();
    if (state.examRemaining <= 0) {
      state.examRemaining = 0;
      stopTimer();
      submitExam(true);
    }
  }, 1000);
}

function mapImagePath(image) {
  const raw = String(image || '').trim();
  if (!raw) return '';
  const m = raw.match(/c(\d+)\.(webp|jpeg|jpg|png)$/i);
  if (m) return `img/c${m[1]}.jpeg`;
  return raw.startsWith('img/') ? raw : `img/${raw}`;
}

function normalizeData(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.questions)) return raw.questions;
  if (raw && raw.id && raw.question) return [raw];
  return [];
}

function hasTopic(q, re) {
  return Array.isArray(q.topics) && q.topics.some(t => re.test(String(t)));
}

function groupQuestions(all) {
  return {
    concept: all.filter(q => /Chương I/i.test(q.category || '') || hasTopic(q, /khái niệm|quy tắc/i)),
    ethics: all.filter(q => /Chương II/i.test(q.category || '') || hasTopic(q, /nghiệp vụ|đạo đức/i)),
    tech: all.filter(q => /Chương III|Chương IV/i.test(q.category || '') || hasTopic(q, /kỹ thuật|cấu tạo|sửa chữa/i)),
    signs: all.filter(q => /Chương V/i.test(q.category || '') || hasTopic(q, /biển báo/i)),
    scenario: all.filter(q => /Chương VI/i.test(q.category || '') || hasTopic(q, /sa hình|tình huống|xử lý/i)),
  };
}

function uniqueById(list) {
  const map = new Map();
  list.forEach(q => map.set(q.id, q));
  return [...map.values()];
}

function makeExam30() {
  const g = groupQuestions(state.all);
  const conceptN = 8 + Math.floor(Math.random() * 3);
  const signsN = 9 + Math.floor(Math.random() * 3);
  const scenarioN = 30 - (conceptN + 1 + 1 + signsN);

  let set = [
    ...pickN(g.concept, conceptN),
    ...pickN(g.ethics, 1),
    ...pickN(g.tech, 1),
    ...pickN(g.signs, signsN),
    ...pickN(g.scenario, scenarioN),
  ];

  set = uniqueById(set);
  while (set.length < 30) {
    const remain = state.all.filter(x => !set.find(y => y.id === x.id));
    if (!remain.length) break;
    set = uniqueById([...set, ...pickN(remain, 30 - set.length)]);
  }
  if (set.length > 30) set = pickN(set, 30);
  return shuffle(set);
}

function setMode(mode) {
  stopTimer();
  state.mode = mode;
  state.index = 0;
  state.answers = {};
  state.submitted = false;
  state.examStarted = false;
  state.examRemaining = state.examDuration;
  el.resultBox.classList.add('hidden');
  el.resultBox.innerHTML = '';
  el.examStartOverlay.classList.add('hidden');
  el.questionCard.classList.remove('blurred');
  el.navPanel.classList.remove('blurred');

  if (mode === 'learn') {
    state.questions = [...state.all];
    el.examInfo.classList.add('hidden');
  } else if (mode === 'reviewWrong') {
    const wrongIds = getWrongIds();
    state.questions = state.all.filter(q => wrongIds.has(q.id));
    el.examInfo.classList.remove('hidden');
    el.examInfo.textContent = state.questions.length
      ? `Đang ôn ${state.questions.length} câu đã trả lời sai.`
      : 'Chưa có câu trả lời sai.';
  } else {
    state.questions = makeExam30();
    updateExamInfo();
    el.examStartOverlay.classList.remove('hidden');
    el.questionCard.classList.add('blurred');
    el.navPanel.classList.add('blurred');
  }
  updateModeButtons();
  updateReviewWrongButtonState();
  renderNav();
  renderQuestion();
}

function resetCurrentSession() {
  stopTimer();
  state.index = 0;
  state.answers = {};
  state.submitted = false;
  state.examStarted = false;
  state.examRemaining = state.examDuration;
  el.resultBox.classList.add('hidden');
  el.resultBox.innerHTML = '';
  el.questionCard.classList.remove('blurred');
  el.navPanel.classList.remove('blurred');

  if (state.mode === 'exam') {
    el.examStartOverlay.classList.remove('hidden');
    updateExamInfo();
    el.questionCard.classList.add('blurred');
    el.navPanel.classList.add('blurred');
  } else {
    el.examStartOverlay.classList.add('hidden');
  }

  if (state.mode === 'reviewWrong') {
    refreshReviewWrongQuestionsIfNeeded();
  }

  updateReviewWrongButtonState();
  renderNav();
  renderQuestion();
}

function updateModeButtons() {
  const map = {
    learn: el.learnModeBtn,
    reviewWrong: el.reviewWrongModeBtn,
    exam: el.examModeBtn,
  };
  [el.learnModeBtn, el.reviewWrongModeBtn, el.examModeBtn].forEach(b => b.classList.remove('mode-active'));
  if (map[state.mode]) map[state.mode].classList.add('mode-active');
}

function updateReviewWrongButtonState() {
  const hasWrong = getWrongIds().size > 0;
  el.reviewWrongModeBtn.disabled = !hasWrong;
}

function updateReviewWrongInfo() {
  if (state.mode !== 'reviewWrong') return;
  el.examInfo.classList.remove('hidden');
  el.examInfo.textContent = state.questions.length
    ? `Đang ôn ${state.questions.length} câu đã trả lời sai.`
    : 'Chưa có câu trả lời sai.';
}

function refreshReviewWrongQuestionsIfNeeded() {
  if (state.mode !== 'reviewWrong') return;
  const wrongIds = getWrongIds();
  state.questions = state.all.filter(q => wrongIds.has(q.id));
  if (state.index >= state.questions.length) {
    state.index = Math.max(0, state.questions.length - 1);
  }
  updateReviewWrongInfo();
}

function updateChapterSelect() {
  if (state.mode !== 'learn' || !state.questions.length) {
    el.chapterSelect.classList.add('hidden');
    el.chapterSelect.innerHTML = '';
    return;
  }
  const categories = [...new Set(state.questions.map(q => q.category || 'Không rõ nhóm'))];
  el.chapterSelect.classList.remove('hidden');
  el.chapterSelect.innerHTML = [`<option value="__ALL__">Toàn bộ câu hỏi</option>`, ...categories
    .map(c => `<option value="${c}">${c}</option>`)
  ].join('');

  if (!categories.includes(state.learnChapterFilter)) state.learnChapterFilter = '__ALL__';
  el.chapterSelect.value = state.learnChapterFilter;
}

function renderNav() {
  if (!state.questions.length) {
    el.navPanel.classList.add('hidden');
    return;
  }
  el.navPanel.classList.remove('hidden');
  el.questionNav.innerHTML = '';

  const visibleQuestions = state.mode === 'learn' && state.learnChapterFilter !== '__ALL__'
    ? state.questions.filter(q => (q.category || 'Không rõ nhóm') === state.learnChapterFilter)
    : state.questions;

  let lastCategory = '';
  visibleQuestions.forEach((q) => {
    const i = state.questions.findIndex(x => x.id === q.id);
    const category = q.category || 'Không rõ nhóm';
    if (state.mode === 'learn' && category !== lastCategory) {
      const sep = document.createElement('div');
      sep.className = 'chapter-sep';
      sep.textContent = category;
      el.questionNav.appendChild(sep);
      lastCategory = category;
    }

    const btn = document.createElement('button');
    btn.className = 'qnav-btn';
    const chosen = state.answers[q.id];
    const isWrongInLearn = state.mode === 'learn' && chosen && chosen !== q.correctAnswer;
    const isWrongInExamAfterSubmit = state.mode === 'exam' && state.submitted && chosen && chosen !== q.correctAnswer;
    if (i === state.index) btn.classList.add('active');
    if (chosen) btn.classList.add('answered');
    if (isWrongInLearn || isWrongInExamAfterSubmit) btn.classList.add('wrong');
    btn.textContent = String(i + 1);
    btn.onclick = () => {
      if (state.mode === 'exam' && !state.examStarted) return;
      state.index = i;
      renderQuestion();
    };
    el.questionNav.appendChild(btn);
  });
}

function renderQuestion() {
  const q = state.questions[state.index];
  if (!q) {
    el.questionCard.classList.add('hidden');
    if (state.mode === 'reviewWrong') {
      el.resultBox.classList.remove('hidden');
      el.resultBox.innerHTML = '<h3>Học lại câu sai</h3><p>Chưa có câu trả lời sai.</p>';
    }
    return;
  }

  el.questionCard.classList.remove('hidden');
  el.qIndex.textContent = `Câu ${state.index + 1}/${state.questions.length}`;
  el.qCategory.textContent = q.category || 'Không rõ nhóm';
  el.qText.textContent = q.question || '';

  if (q.hasImage && q.image) {
    el.qImageWrap.classList.remove('hidden');
    el.qImage.src = mapImagePath(q.image);
  } else {
    el.qImageWrap.classList.add('hidden');
    el.qImage.removeAttribute('src');
  }

  el.options.innerHTML = '';
  Object.entries(q.options || {}).forEach(([key, text]) => {
    const btn = document.createElement('button');
    btn.className = 'option';
    btn.textContent = `${key.toUpperCase()}. ${text}`;
    btn.onclick = () => chooseAnswer(key);

    if (state.answers[q.id] === key) btn.classList.add('selected');

    const showResult = ((state.mode === 'learn' || state.mode === 'reviewWrong') && state.answers[q.id]) || (state.mode === 'exam' && state.submitted);
    if (showResult) {
      if (key === q.correctAnswer) btn.classList.add('correct');
      if (state.answers[q.id] === key && key !== q.correctAnswer) btn.classList.add('wrong');
    }

    el.options.appendChild(btn);
  });

  const showExplain = ((state.mode === 'learn' || state.mode === 'reviewWrong') && state.answers[q.id]) || (state.mode === 'exam' && state.submitted);
  if (showExplain) {
    el.explain.classList.remove('hidden');
    el.explain.textContent = `Đáp án đúng: ${String(q.correctAnswer || '').toUpperCase()}. ${q.explanation || ''}`;
  } else {
    el.explain.classList.add('hidden');
    el.explain.textContent = '';
  }

  renderActions();
  updateChapterSelect();
  renderNav();
}

function chooseAnswer(answer) {
  if (state.mode === 'exam' && !state.examStarted) return;
  if (state.mode === 'exam' && state.submitted) return;
  const q = state.questions[state.index];
  state.answers[q.id] = answer;

  if (state.mode === 'learn' && answer !== q.correctAnswer) {
    addWrongId(q.id);
    refreshReviewWrongQuestionsIfNeeded();
  }

  if (state.mode === 'reviewWrong' && answer === q.correctAnswer) {
    removeWrongId(q.id);
    refreshReviewWrongQuestionsIfNeeded();
    delete state.answers[q.id];
    updateReviewWrongButtonState();
  }

  renderQuestion();
}

function renderActions() {
  el.actions.innerHTML = '';

  const prev = document.createElement('button');
  prev.textContent = 'Câu trước';
  prev.disabled = state.index === 0;
  prev.onclick = () => { state.index -= 1; renderQuestion(); };

  const next = document.createElement('button');
  next.textContent = 'Câu sau';
  next.disabled = state.index === state.questions.length - 1;
  next.onclick = () => { state.index += 1; renderQuestion(); };

  el.actions.append(prev, next);

}

function submitExam(isAuto = false) {
  state.submitted = true;
  stopTimer();
  let correct = 0;
  const wrongIds = [];
  state.questions.forEach(q => {
    if (state.answers[q.id] === q.correctAnswer) correct += 1;
    else wrongIds.push(q.id);
  });

  const merged = getWrongIds();
  wrongIds.forEach(id => merged.add(id));
  saveWrongIds(merged);
  updateReviewWrongButtonState();

  const total = state.questions.length;
  const unanswered = total - Object.keys(state.answers).length;

  el.resultBox.classList.remove('hidden');
  el.resultBox.innerHTML = `
    <h3>Kết quả</h3>
    <p>${isAuto ? 'Hết giờ, hệ thống tự nộp bài.' : 'Đã nộp bài.'}</p>
    <p>Đúng: ${correct}/${total}</p>
    <p>Chưa trả lời: ${unanswered}</p>
    <p>Sai (kể cả bỏ trống): ${wrongIds.length}</p>
  `;
  updateExamInfo();
  renderQuestion();
}

function startExam() {
  startExamTimer();
  el.examStartOverlay.classList.add('hidden');
  el.questionCard.classList.remove('blurred');
  el.navPanel.classList.remove('blurred');
  renderQuestion();
}

el.learnModeBtn.onclick = () => setMode('learn');
el.reviewWrongModeBtn.onclick = () => setMode('reviewWrong');
el.examModeBtn.onclick = () => setMode('exam');
el.resetBtn.onclick = resetCurrentSession;
el.examStartBtn.onclick = startExam;
el.chapterSelect.onchange = (e) => {
  const category = e.target.value;
  state.learnChapterFilter = category;
  if (category === '__ALL__') {
    renderNav();
    return;
  }
  const idx = state.questions.findIndex(q => (q.category || 'Không rõ nhóm') === category);
  if (idx >= 0) {
    state.index = idx;
    renderQuestion();
    return;
  }
  renderNav();
};

async function loadData() {
  const paths = ['data/600-cau-thi-GPLX.json', '600-cau-thi-GPLX.json', 'data/cau-hoi-lai-xe.json', 'data/questions.json'];
  for (const path of paths) {
    try {
      const res = await fetch(path);
      if (!res.ok) continue;
      const raw = await res.json();
      const data = normalizeData(raw);
      if (data.length) return { path, data };
    } catch (_) {}
  }
  return { path: null, data: [] };
}

(async function init() {
  const loaded = await loadData();
  if (!loaded.data.length) {
    el.status.textContent = 'Lỗi tải dữ liệu JSON.';
    return;
  }
  state.all = loaded.data;
  el.status.textContent = '';
  updateReviewWrongButtonState();
  setMode('learn');
})();