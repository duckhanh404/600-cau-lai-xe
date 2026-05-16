const state = {
  all: [],
  mode: 'learn',
  questions: [],
  index: 0,
  answers: {},
  submitted: false,
};

const el = {
  status: document.getElementById('status'),
  learnModeBtn: document.getElementById('learnModeBtn'),
  examModeBtn: document.getElementById('examModeBtn'),
  resetBtn: document.getElementById('resetBtn'),
  examInfo: document.getElementById('examInfo'),
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
  state.mode = mode;
  state.index = 0;
  state.answers = {};
  state.submitted = false;
  el.resultBox.classList.add('hidden');
  el.resultBox.innerHTML = '';

  if (mode === 'learn') {
    state.questions = [...state.all];
    el.examInfo.classList.add('hidden');
  } else {
    state.questions = makeExam30();
    el.examInfo.classList.remove('hidden');
    el.examInfo.textContent = 'Đề 30 câu: 8-10 khái niệm/quy tắc, 1 nghiệp vụ/đạo đức, 1 kỹ thuật/cấu tạo, 9-11 biển báo, 8-9 sa hình/tình huống.';
  }
  renderNav();
  renderQuestion();
}

function renderNav() {
  if (!state.questions.length) {
    el.navPanel.classList.add('hidden');
    return;
  }
  el.navPanel.classList.remove('hidden');
  el.questionNav.innerHTML = '';

  let lastCategory = '';
  state.questions.forEach((q, i) => {
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
    if (i === state.index) btn.classList.add('active');
    if (chosen) btn.classList.add('answered');
    if (isWrongInLearn) btn.classList.add('wrong');
    btn.textContent = String(i + 1);
    btn.onclick = () => {
      state.index = i;
      renderQuestion();
    };
    el.questionNav.appendChild(btn);
  });
}

function renderQuestion() {
  const q = state.questions[state.index];
  if (!q) return;

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

    const showResult = (state.mode === 'learn' && state.answers[q.id]) || (state.mode === 'exam' && state.submitted);
    if (showResult) {
      if (key === q.correctAnswer) btn.classList.add('correct');
      if (state.answers[q.id] === key && key !== q.correctAnswer) btn.classList.add('wrong');
    }

    el.options.appendChild(btn);
  });

  const showExplain = (state.mode === 'learn' && state.answers[q.id]) || (state.mode === 'exam' && state.submitted);
  if (showExplain) {
    el.explain.classList.remove('hidden');
    el.explain.textContent = `Đáp án đúng: ${String(q.correctAnswer || '').toUpperCase()}. ${q.explanation || ''}`;
  } else {
    el.explain.classList.add('hidden');
    el.explain.textContent = '';
  }

  renderActions();
  renderNav();
}

function chooseAnswer(answer) {
  const q = state.questions[state.index];
  state.answers[q.id] = answer;
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

  if (state.mode === 'exam' && !state.submitted) {
    const submit = document.createElement('button');
    submit.textContent = 'Nộp bài';
    submit.onclick = submitExam;
    el.actions.appendChild(submit);
  }
}

function submitExam() {
  state.submitted = true;
  let correct = 0;
  state.questions.forEach(q => {
    if (state.answers[q.id] === q.correctAnswer) correct += 1;
  });
  const total = state.questions.length;
  const unanswered = total - Object.keys(state.answers).length;

  el.resultBox.classList.remove('hidden');
  el.resultBox.innerHTML = `
    <h3>Kết quả</h3>
    <p>Đúng: ${correct}/${total}</p>
    <p>Chưa trả lời: ${unanswered}</p>
  `;
  renderQuestion();
}

el.learnModeBtn.onclick = () => setMode('learn');
el.examModeBtn.onclick = () => setMode('exam');
el.resetBtn.onclick = () => setMode(state.mode);

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
  el.status.textContent = `Đã tải ${state.all.length} câu từ ${loaded.path}.`;
  setMode('learn');
})();