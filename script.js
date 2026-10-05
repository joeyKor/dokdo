/**
 * 독도는 우리땅 - 긴글 타자연습 스크립트
 * 주요 기능:
 * 1. 독도는 우리땅 1~5절 긴글 타자연습 (한컴타자 스타일 라인별 진행 + 실시간 피드백)
 * 2. 한글 음소 분해(초성, 중성, 종성) 기반 정확한 타수(CPM) 및 정확도 실시간 계산
 * 3. Web Audio API를 활용한 기계식 키보드 효과음 및 사운드 효과
 * 4. 2벌식 가상 키보드 가이드 및 반응형 인터랙션
 * 5. 결과 리포트 및 독도 지킴이 칭호 부여
 */

// ==========================================
// 1. "독도는 우리땅" 가사 데이터
// ==========================================
const DOKDO_VERSES = {
  1: {
    title: '제 1절',
    lines: [
      '울릉도 동남쪽 뱃길따라 87K',
      '외로운 섬 하나 새들의 고향',
      '그 누가 아무리 자기네 땅이라고 우겨도',
      '독도는 우리땅'
    ]
  },
  2: {
    title: '제 2절',
    lines: [
      '경상북도 울릉군 울릉읍 독도리',
      '동경 백삼십이 북위 삼십칠',
      '평균기온 십삼도 강수량은 천팔백',
      '독도는 우리땅'
    ]
  },
  3: {
    title: '제 3절',
    lines: [
      '오징어 꼴뚜기 대구 홍합 따개비',
      '주민등록 최종덕 이장 김성도',
      '십구만 평방미터 799에 805',
      '독도는 우리땅'
    ]
  },
  4: {
    title: '제 4절',
    lines: [
      '지증왕 십삼년 섬나라 우산국',
      '세종실록지리지 강원도 울진현',
      '하와이는 미국땅 대마도는 조선땅',
      '독도는 우리땅'
    ]
  },
  5: {
    title: '제 5절',
    lines: [
      '러일전쟁 직후에 임자없는 섬이라고',
      '억지로 우기면 정말 곤란해',
      '신라장군 이사부 지하에서 웃는다',
      '독도는 우리땅'
    ]
  }
};

// ==========================================
// 2. 한글 타수(자모 분해) 계산기
// ==========================================
// 초성: 19자
const CHOSUNG = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
// 중성 타건 수 (복합모음은 2타건: ㅒ, ㅖ, ㅘ, ㅙ, ㅚ, ㅝ, ㅞ, ㅟ, ㅢ)
const JUNGSUNG_STROKES = [
  1, 1, 1, 2, 1, 1, 1, 2, 1, 2, 2, 2, 1, 1, 2, 2, 2, 1, 1, 2, 1
];
// 종성 타건 수 (0: 없음, 복자음은 2타건: ㄲ, ㄳ, ㄵ, ㄶ, ㄺ, ㄻ, ㄼ, ㄽ, ㄾ, ㄿ, ㅀ, ㅄ, ㅆ)
const JONGSUNG_STROKES = [
  0, 1, 2, 2, 1, 2, 2, 1, 1, 2, 2, 2, 2, 2, 2, 2, 1, 1, 2, 1, 2, 1, 1, 1, 1, 1, 1, 1
];

/**
 * 한 글자(또는 문자열)의 타건 수(스트로크 수)를 정확히 계산합니다.
 */
function countKeystrokes(str) {
  let count = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    // 완성형 한글 범위: AC00(가) ~ D7A3(힣)
    if (code >= 0xac00 && code <= 0xd7a3) {
      const syllableIndex = code - 0xac00;
      const jong = syllableIndex % 28;
      const jung = Math.floor((syllableIndex - jong) / 28) % 21;
      const cho = Math.floor((syllableIndex - jong) / 28 / 21);

      // 초성: 1타
      count += 1;
      // 중성: 단모음 1타, 복모음 2타
      count += JUNGSUNG_STROKES[jung] || 1;
      // 종성: 단자음 1타, 겹받침 2타
      count += JONGSUNG_STROKES[jong] || 0;
    } 
    // 낱자 자음/모음 범위
    else if (code >= 0x3131 && code <= 0x318e) {
      count += 1;
    } 
    // 공백, 영문, 특수문자, 숫자
    else {
      count += 1;
    }
  }
  return count;
}

// ==========================================
// 3. Web Audio API 사운드 시스템
// ==========================================
class SoundFX {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // 기계식 키보드 클릭음
  playKeyClick() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const freq = 600 + Math.random() * 200;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.04);
    } catch (e) {
      // Audio autoplay policy
    }
  }

  // 오타 경고음
  playError() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
    } catch (e) {}
  }

  // 문장 완료 딩동음
  playLineComplete() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.08); // E5

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch (e) {}
  }

  // 전체 완료 팡파레
  playVictory() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C - E - G - High C
      const now = this.ctx.currentTime;

      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);

        gain.gain.setValueAtTime(0.18, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.4);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.4);
      });
    } catch (e) {}
  }
}



// ==========================================
// 5. 핵심 타자연습 상태 관리
// ==========================================
class DokdoTypingApp {
  constructor() {
    this.sound = new SoundFX();

    // 연습 상태
    this.activeMode = 'all'; // 'all', '1', '2', '3', '4', '5'
    this.linesList = [];
    this.currentLineIdx = 0;
    
    // 타이머 및 타수 측정
    this.startTime = null;
    this.timerInterval = null;
    this.isStarted = false;

    // 누적 통계
    this.totalStrokesTyped = 0;
    this.totalErrorsCount = 0;
    this.maxCpm = 0;
    this.lineSpeeds = []; // 각 줄별 타수 기록
    this.isTransitioning = false; // 한글 IME 잔여 글자 누출 방지 플래그

    // 현재 줄 상태
    this.currentLineStartTime = null;
    this.currentLineKeystrokes = 0;

    // 순위 및 명예의 전당 상태
    this.currentLeaderboardCourse = '초등학교';
    this.lastFinishedRecordId = null;
    this.lastRank = null;

    // 참가자 정보 (과정, 학년, 반 - 처음에는 미선택 상태)
    this.participant = {
      course: '',
      grade: '',
      classNum: ''
    };

    // DOM 참조
    this.dom = {
      targetDisplay: document.getElementById('targetTextDisplay'),
      typingInput: document.getElementById('typingInput'),
      prevLineBox: document.getElementById('prevLineBox'),
      prevLineText: document.getElementById('prevLineText'),
      prevLineCpm: document.getElementById('prevLineCpm'),
      upcomingLinesBox: document.getElementById('upcomingLinesBox'),
      currentVerseBadge: document.getElementById('currentVerseBadge'),
      currentCpm: document.getElementById('currentCpm'),
      cpmBar: document.getElementById('cpmBar'),
      avgCpm: document.getElementById('avgCpm'),
      maxCpm: document.getElementById('maxCpm'),
      accuracyVal: document.getElementById('accuracyVal'),
      progressPercent: document.getElementById('progressPercent'),
      progressLineCount: document.getElementById('progressLineCount'),
      overallProgressBarFill: document.getElementById('overallProgressBarFill'),
      timerVal: document.getElementById('timerVal'),
      soundToggleBtn: document.getElementById('soundToggleBtn'),
      openLeaderboardBtn: document.getElementById('openLeaderboardBtn'),
      resetPracticeBtn: document.getElementById('resetPracticeBtn'),
      skipLineBtn: document.getElementById('skipLineBtn'),
      // Participant UI
      participantDisplay: document.getElementById('participantDisplay'),
      changeParticipantBtn: document.getElementById('changeParticipantBtn'),
      participantModal: document.getElementById('participantModal'),
      participantForm: document.getElementById('participantForm'),
      courseRadios: document.querySelectorAll('input[name="schoolCourse"]'),
      studentGrade: document.getElementById('studentGrade'),
      studentClass: document.getElementById('studentClass'),
      // 3-Column Leaderboards (초등 | 중학 | 고등 한눈에 보기)
      typingTbody_elem: document.getElementById('typingTbody_elem'),
      typingTbody_mid: document.getElementById('typingTbody_mid'),
      typingTbody_high: document.getElementById('typingTbody_high'),
      // Modal
      resultModal: document.getElementById('resultModal'),
      resultGradeIcon: document.getElementById('resultGradeIcon'),
      resultGradeTitle: document.getElementById('resultGradeTitle'),
      resultVerseSummary: document.getElementById('resultVerseSummary'),
      winStudentBadge: document.getElementById('winStudentBadge'),
      modalAvgCpm: document.getElementById('modalAvgCpm'),
      modalMaxCpm: document.getElementById('modalMaxCpm'),
      modalAccuracy: document.getElementById('modalAccuracy'),
      modalTotalTime: document.getElementById('modalTotalTime'),
      modalRestartBtn: document.getElementById('modalRestartBtn')
    };

    this.init();
  }

  init() {
    this.loadParticipant();
    this.bindEvents();
    this.setupPracticeMode();
    this.checkInitialParticipantRegistration();
  }

  // 참가자 정보 불러오기 및 저장
  loadParticipant() {
    try {
      const saved = localStorage.getItem('dokdo_typing_participant') || localStorage.getItem('dokdo_puzzle_participant');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.course && parsed.grade && parsed.classNum) {
          this.participant = parsed;
          this.updateParticipantUI();
          return;
        }
      }
    } catch (e) {}
    this.updateParticipantUI();
  }

  saveParticipant(data) {
    this.participant = { ...this.participant, ...data };
    try {
      const serialized = JSON.stringify(this.participant);
      localStorage.setItem('dokdo_typing_participant', serialized);
      localStorage.setItem('dokdo_puzzle_participant', serialized);
    } catch (e) {}
    this.updateParticipantUI();
  }

  getParticipantString() {
    const { course, grade, classNum } = this.participant || {};
    if (course && grade && classNum) {
      return `${course} ${grade} ${classNum}`;
    }
    return '참가 정보를 선택해 주세요';
  }

  updateParticipantUI() {
    const str = this.getParticipantString();
    if (this.dom.participantDisplay) {
      this.dom.participantDisplay.textContent = str;
    }
    if (this.dom.winStudentBadge) {
      this.dom.winStudentBadge.textContent = str;
    }
  }

  checkInitialParticipantRegistration() {
    if (!this.participant || !this.participant.course || !this.participant.grade || !this.participant.classNum) {
      this.openParticipantModal();
    } else {
      if (this.dom.typingInput && !this.dom.typingInput.disabled) {
        this.dom.typingInput.focus();
      }
    }
  }

  openParticipantModal() {
    const course = this.participant?.course;
    if (course) {
      const radio = document.querySelector(`input[name="schoolCourse"][value="${course}"]`);
      if (radio) radio.checked = true;
      this.updateGradeOptions(course, this.participant.grade);
    } else {
      // 아무것도 선택되지 않은 초기 미선택 상태
      if (this.dom.courseRadios) {
        this.dom.courseRadios.forEach(r => r.checked = false);
      }
      this.resetGradeOptions();
    }

    if (this.dom.studentClass) {
      this.dom.studentClass.value = this.participant?.classNum || '';
    }

    if (this.dom.participantModal) {
      this.dom.participantModal.classList.remove('hidden');
    }
  }

  closeParticipantModal() {
    if (this.dom.participantModal) {
      this.dom.participantModal.classList.add('hidden');
    }
    if (this.dom.typingInput && !this.dom.typingInput.disabled) {
      this.dom.typingInput.focus();
    }
  }

  resetGradeOptions() {
    const select = this.dom.studentGrade;
    if (!select) return;
    select.innerHTML = '<option value="" disabled selected>과정을 먼저 선택하세요</option>';
  }

  updateGradeOptions(course, targetGrade = '') {
    const select = this.dom.studentGrade;
    if (!select) return;
    select.innerHTML = '<option value="" disabled selected>학년 선택</option>';

    // 초등학교: 1~6학년, 중학교/고등학교: 1~3학년
    const maxGrade = (course === '초등학교') ? 6 : 3;
    for (let g = 1; g <= maxGrade; g++) {
      const opt = document.createElement('option');
      opt.value = `${g}학년`;
      opt.textContent = `${g}학년`;
      select.appendChild(opt);
    }

    if (targetGrade && parseInt(targetGrade, 10) <= maxGrade) {
      select.value = targetGrade;
    }
  }

  setupPracticeMode() {
    this.linesList = [];

    // 1절부터 5절까지 전체 20문장 구성
    for (let v = 1; v <= 5; v++) {
      DOKDO_VERSES[v].lines.forEach((line, idx) => {
        this.linesList.push({
          verseNum: v,
          lineInVerse: idx + 1,
          text: line
        });
      });
    }

    this.resetStats();
    this.renderCurrentLine();
  }

  resetStats() {
    clearInterval(this.timerInterval);
    this.isStarted = false;
    this.startTime = null;
    this.currentLineStartTime = null;
    this.currentLineIdx = 0;
    this.totalStrokesTyped = 0;
    this.totalErrorsCount = 0;
    this.maxCpm = 0;
    this.lineSpeeds = [];

    // UI 초기화
    this.dom.currentCpm.textContent = '0';
    this.dom.cpmBar.style.width = '0%';
    this.dom.avgCpm.textContent = '0';
    this.dom.maxCpm.textContent = '0';
    this.dom.accuracyVal.textContent = '100';
    this.dom.progressPercent.textContent = '0';
    this.dom.overallProgressBarFill.style.width = '0%';
    this.dom.timerVal.textContent = '00:00';
    this.dom.prevLineBox.classList.add('hidden');
    this.dom.resultModal.classList.add('hidden');

    this.dom.typingInput.value = '';
    this.dom.typingInput.disabled = false;
    this.dom.typingInput.focus();
  }

  startTimerIfNeeded() {
    if (!this.isStarted) {
      this.isStarted = true;
      this.startTime = Date.now();
      this.currentLineStartTime = Date.now();

      this.timerInterval = setInterval(() => {
        this.updateTimer();
        this.updateRealtimeCPM();
      }, 100);
    }
  }

  updateTimer() {
    if (!this.startTime) return;
    const elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    const mins = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
    const secs = String(elapsedSeconds % 60).padStart(2, '0');
    this.dom.timerVal.textContent = `${mins}:${secs}`;
  }

  getCurrentTargetLine() {
    return this.linesList[this.currentLineIdx] ? this.linesList[this.currentLineIdx].text : '';
  }

  renderCurrentLine() {
    const currentData = this.linesList[this.currentLineIdx];
    if (!currentData) {
      this.finishPractice();
      return;
    }

    // Verse Badge Update
    this.dom.currentVerseBadge.textContent = `제 ${currentData.verseNum}절 (${currentData.lineInVerse}/4행)`;

    // Target Text spans
    const target = currentData.text;
    this.dom.targetDisplay.innerHTML = '';
    for (let i = 0; i < target.length; i++) {
      const char = target[i];
      const span = document.createElement('span');
      span.className = 'char-span untyped';
      span.textContent = char;
      if (char === ' ') {
        span.classList.add('space');
      }
      this.dom.targetDisplay.appendChild(span);
    }

    // Upcoming lines
    this.renderUpcomingLines();

    // Progress
    const totalLines = this.linesList.length;
    this.dom.progressLineCount.textContent = `${this.currentLineIdx + 1} / ${totalLines} 행`;
    const percent = Math.round((this.currentLineIdx / totalLines) * 100);
    this.dom.progressPercent.textContent = percent;
    this.dom.overallProgressBarFill.style.width = `${percent}%`;

    // Clear and focus input
    this.dom.typingInput.value = '';
    this.dom.typingInput.focus();
    this.currentLineStartTime = Date.now();
    this.updateTargetDisplayHighlight('');
  }

  renderUpcomingLines() {
    this.dom.upcomingLinesBox.innerHTML = '';
    const nextLines = this.linesList.slice(this.currentLineIdx + 1, this.currentLineIdx + 3);
    if (nextLines.length === 0) {
      const finishNotice = document.createElement('div');
      finishNotice.className = 'upcoming-line-item';
      finishNotice.textContent = '🚩 마지막 문장입니다! 힘차게 마무리하세요.';
      this.dom.upcomingLinesBox.appendChild(finishNotice);
    } else {
      nextLines.forEach(item => {
        const lineDiv = document.createElement('div');
        lineDiv.className = 'upcoming-line-item';
        lineDiv.textContent = `[${item.verseNum}절] ${item.text}`;
        this.dom.upcomingLinesBox.appendChild(lineDiv);
      });
    }
  }

  updateTargetDisplayHighlight(inputValue) {
    const target = this.getCurrentTargetLine();
    const spans = this.dom.targetDisplay.querySelectorAll('.char-span');

    let correctCharsInLine = 0;

    spans.forEach((span, idx) => {
      span.className = 'char-span';
      if (target[idx] === ' ') span.classList.add('space');

      if (idx < inputValue.length) {
        if (inputValue[idx] === target[idx]) {
          span.classList.add('correct');
          correctCharsInLine++;
        } else {
          span.classList.add('error');
        }
      } else if (idx === inputValue.length) {
        span.classList.add('current-char');
      } else {
        span.classList.add('untyped');
      }
    });

    // Accuracy
    const totalAttemptedChars = this.totalStrokesTyped + countKeystrokes(inputValue);
    const currentLineMistakes = Math.max(0, inputValue.length - correctCharsInLine);
    const totalMistakes = this.totalErrorsCount + currentLineMistakes;

    let accuracy = 100;
    if (totalAttemptedChars > 0) {
      accuracy = Math.max(0, Math.min(100, Math.round(((totalAttemptedChars - totalMistakes * 2) / totalAttemptedChars) * 100)));
    }
    this.dom.accuracyVal.textContent = accuracy;
  }

  handleTypingInput(e) {
    if (this.isTransitioning) {
      this.dom.typingInput.value = '';
      return;
    }

    this.startTimerIfNeeded();
    this.sound.playKeyClick();

    const inputValue = this.dom.typingInput.value;
    const target = this.getCurrentTargetLine();

    // 끝까지 다 친 상태에서 스페이스바를 입력했을 때 다음 문장으로 자동 넘김
    if (inputValue.length > target.length && inputValue.endsWith(' ')) {
      this.completeCurrentLine();
      return;
    }

    // Check if backspace or addition
    this.updateTargetDisplayHighlight(inputValue);
    this.updateRealtimeCPM();
  }

  updateRealtimeCPM() {
    if (!this.isStarted || !this.currentLineStartTime) return;

    const inputVal = this.dom.typingInput.value;
    const lineStrokes = countKeystrokes(inputVal);
    const lineElapsed = Math.max(0.2, (Date.now() - this.currentLineStartTime) / 1000);

    // Current line CPM
    let liveCpm = Math.round((lineStrokes / lineElapsed) * 60);
    if (isNaN(liveCpm) || liveCpm < 0) liveCpm = 0;
    if (liveCpm > 1200) liveCpm = 1200; // Cap abnormal instant spikes

    this.dom.currentCpm.textContent = liveCpm;
    const meterPercent = Math.min(100, (liveCpm / 700) * 100);
    this.dom.cpmBar.style.width = `${meterPercent}%`;

    // Peak CPM update
    if (liveCpm > this.maxCpm && inputVal.length > 2) {
      this.maxCpm = liveCpm;
      this.dom.maxCpm.textContent = this.maxCpm;
    }

    // Cumulative Average CPM
    const totalElapsed = (Date.now() - this.startTime) / 1000;
    if (totalElapsed > 1) {
      const overallStrokes = this.totalStrokesTyped + lineStrokes;
      const overallAvg = Math.round((overallStrokes / totalElapsed) * 60);
      this.dom.avgCpm.textContent = isNaN(overallAvg) ? '0' : overallAvg;
    }
  }

  completeCurrentLine() {
    if (this.isTransitioning) return;

    const target = this.getCurrentTargetLine();
    let inputValue = this.dom.typingInput.value;

    if (inputValue.trim().length === 0) {
      return; // Do not skip empty input on accidental Enter/Space
    }

    // 끝에서 스페이스바로 넘어왔을 경우 마지막 스페이스가 오타로 처리되지 않도록 제거
    if (inputValue.length > target.length && inputValue.endsWith(' ')) {
      inputValue = inputValue.slice(0, target.length);
    }

    const lineStrokes = countKeystrokes(inputValue);
    const lineElapsed = Math.max(0.5, (Date.now() - this.currentLineStartTime) / 1000);
    const lineCpm = Math.round((lineStrokes / lineElapsed) * 60);

    // Record mistakes
    let mistakes = 0;
    for (let i = 0; i < inputValue.length; i++) {
      if (inputValue[i] !== target[i]) mistakes++;
    }
    if (inputValue.length < target.length) {
      mistakes += (target.length - inputValue.length);
    }

    this.totalStrokesTyped += lineStrokes;
    this.totalErrorsCount += mistakes;
    this.lineSpeeds.push(lineCpm);

    this.sound.playLineComplete();

    // Show Previous Line Box
    this.dom.prevLineBox.classList.remove('hidden');
    this.dom.prevLineText.textContent = target;
    this.dom.prevLineCpm.textContent = `타수: ${lineCpm} CPM`;

    // 한글 IME 조합 중 잔여 글자(예: '땅')가 다음 줄로 새어 나가지 않도록 완벽 차단
    this.isTransitioning = true;
    this.dom.typingInput.blur(); // IME 조합 강제 종료 및 확정
    this.dom.typingInput.value = '';

    setTimeout(() => {
      this.currentLineIdx++;
      if (this.currentLineIdx >= this.linesList.length) {
        this.finishPractice();
      } else {
        this.renderCurrentLine();
        this.dom.typingInput.value = '';
        this.dom.typingInput.focus();
      }
      this.isTransitioning = false;
    }, 40);
  }

  skipCurrentLine() {
    if (this.isTransitioning) return;

    const target = this.getCurrentTargetLine();
    this.dom.prevLineBox.classList.remove('hidden');
    this.dom.prevLineText.textContent = target;
    this.dom.prevLineCpm.textContent = '건너뜀';

    this.isTransitioning = true;
    this.dom.typingInput.blur();
    this.dom.typingInput.value = '';

    setTimeout(() => {
      this.currentLineIdx++;
      if (this.currentLineIdx >= this.linesList.length) {
        this.finishPractice();
      } else {
        this.renderCurrentLine();
        this.dom.typingInput.value = '';
        this.dom.typingInput.focus();
      }
      this.isTransitioning = false;
    }, 40);
  }

  finishPractice() {
    clearInterval(this.timerInterval);
    this.sound.playVictory();

    this.dom.typingInput.disabled = true;

    // Total Calculation
    const totalElapsed = Math.max(1, (Date.now() - this.startTime) / 1000);
    const finalAvgCpm = Math.round((this.totalStrokesTyped / totalElapsed) * 60);
    const finalAccuracy = this.dom.accuracyVal.textContent;

    const mins = String(Math.floor(totalElapsed / 60)).padStart(2, '0');
    const secs = String(Math.floor(totalElapsed % 60)).padStart(2, '0');
    const timeFormatted = `${mins}:${secs}`;

    // Rank & Badge assignment
    let badgeIcon = '🌱';
    let badgeTitle = '독도 새싹 지킴이';

    if (finalAvgCpm >= 550) {
      badgeIcon = '🏆';
      badgeTitle = '독도 수호 총사령관';
    } else if (finalAvgCpm >= 420) {
      badgeIcon = '🎖️';
      badgeTitle = '동해의 절대 수호자';
    } else if (finalAvgCpm >= 320) {
      badgeIcon = '⭐';
      badgeTitle = '명예 독도 지킴이';
    } else if (finalAvgCpm >= 220) {
      badgeIcon = '🌊';
      badgeTitle = '이사부 장군의 후예';
    } else if (finalAvgCpm >= 140) {
      badgeIcon = '🕊️';
      badgeTitle = '독도 괭이갈매기';
    }

    this.dom.resultGradeIcon.textContent = badgeIcon;
    this.dom.resultGradeTitle.textContent = badgeTitle;
    if (this.dom.winStudentBadge) {
      this.dom.winStudentBadge.textContent = this.getParticipantString();
    }

    this.dom.modalAvgCpm.textContent = isNaN(finalAvgCpm) ? '0' : finalAvgCpm;
    this.dom.modalMaxCpm.textContent = this.maxCpm;
    this.dom.modalAccuracy.textContent = finalAccuracy;
    this.dom.modalTotalTime.textContent = timeFormatted;

    // 과정별 순위 등록 (1순위: 정확도 높은 순 -> 2순위: 소요 시간 빠른 순 -> 3순위: 타수)
    const elapsedSec = Math.max(1, Math.round((Date.now() - this.startTime) / 1000));
    const safeAvgCpm = isNaN(finalAvgCpm) ? 0 : finalAvgCpm;

    if (typeof RankingManager !== 'undefined') {
      const currentCourse = this.participant.course || '초등학교';
      this.currentLeaderboardCourse = currentCourse;

      const rankInfo = RankingManager.addTypingRecord({
        course: currentCourse,
        grade: this.participant.grade,
        classNum: this.participant.classNum,
        accuracy: finalAccuracy,
        totalSeconds: elapsedSec,
        avgCpm: safeAvgCpm
      });

      this.lastFinishedRecordId = rankInfo.recordId;
      this.lastRank = rankInfo.rank;

      if (rankInfo.rank) {
        if (rankInfo.isNewBest) {
          this.dom.resultVerseSummary.textContent = `🎉 우리 반 최고 기록 경신! [${this.participant.grade} ${this.participant.classNum}]이(가) ${currentCourse} 부문 ${rankInfo.rank}위에 올랐습니다!`;
        } else {
          this.dom.resultVerseSummary.textContent = `우리 반 [${this.participant.grade} ${this.participant.classNum}]의 현재 최고 기록 순위는 ${currentCourse} 부문 ${rankInfo.rank}위입니다!`;
        }
      } else {
        this.dom.resultVerseSummary.textContent = '독도는 우리땅 1~5절 전체를 완벽하게 완주하셨습니다!';
      }

      // 초등 | 중학 | 고등 3분할 순위표 한눈에 동시 렌더링
      RankingManager.renderAllTypingLeaderboards(this.lastFinishedRecordId);
    } else {
      this.dom.resultVerseSummary.textContent = '독도는 우리땅 1~5절 전체를 완벽하게 완주하셨습니다!';
    }

    // Show modal
    this.dom.resultModal.classList.remove('hidden');
  }

  bindEvents() {
    // Participant Form & Course Radio Selection
    if (this.dom.courseRadios) {
      this.dom.courseRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
          this.updateGradeOptions(e.target.value);
        });
      });
    }

    if (this.dom.participantForm) {
      this.dom.participantForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const checkedRadio = document.querySelector('input[name="schoolCourse"]:checked');
        if (!checkedRadio) {
          alert('과정(초등학교, 중학교, 고등학교)을 선택해 주세요.');
          return;
        }

        const selectedGrade = this.dom.studentGrade.value;
        if (!selectedGrade) {
          alert('학년을 선택해 주세요.');
          this.dom.studentGrade.focus();
          return;
        }

        const selectedClass = this.dom.studentClass.value;
        if (!selectedClass) {
          alert('반을 선택해 주세요.');
          this.dom.studentClass.focus();
          return;
        }

        this.saveParticipant({
          course: checkedRadio.value,
          grade: selectedGrade,
          classNum: selectedClass
        });

        this.closeParticipantModal();
        this.setupPracticeMode();
      });
    }

    if (this.dom.changeParticipantBtn) {
      this.dom.changeParticipantBtn.addEventListener('click', () => {
        this.openParticipantModal();
      });
    }

    // Header Leaderboard Button (명예의 전당 보기)
    if (this.dom.openLeaderboardBtn) {
      this.dom.openLeaderboardBtn.addEventListener('click', () => {
        if (typeof RankingManager !== 'undefined') {
          RankingManager.renderAllTypingLeaderboards(this.lastFinishedRecordId);
        }
        this.dom.resultModal.classList.remove('hidden');
      });
    }

    // Typing input events
    this.dom.typingInput.addEventListener('input', (e) => this.handleTypingInput(e));

    // IME 조합 완료 시 전환 중이면 입력값 제거
    this.dom.typingInput.addEventListener('compositionend', () => {
      if (this.isTransitioning) {
        this.dom.typingInput.value = '';
      }
    });

    this.dom.typingInput.addEventListener('keydown', (e) => {
      if (this.isTransitioning) {
        e.preventDefault();
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        this.completeCurrentLine();
      } else if (e.code === 'Space' || e.key === ' ') {
        const target = this.getCurrentTargetLine();
        const currentVal = this.dom.typingInput.value;
        // 문장을 끝까지 다 입력한 상태에서 스페이스바를 누른 경우 즉시 다음으로 이동
        if (currentVal.length >= target.length) {
          e.preventDefault();
          this.completeCurrentLine();
        }
      }
    });

    // Keep focus on typing area when clicked anywhere on the stage
    document.querySelector('.typing-stage').addEventListener('click', () => {
      if (!this.dom.typingInput.disabled) {
        this.dom.typingInput.focus();
      }
    });

    // Skip Button
    this.dom.skipLineBtn.addEventListener('click', () => this.skipCurrentLine());

    // Restart Button
    this.dom.resetPracticeBtn.addEventListener('click', () => {
      this.setupPracticeMode();
    });

    // Sound toggle
    this.dom.soundToggleBtn.addEventListener('click', () => {
      this.sound.enabled = !this.sound.enabled;
      if (this.sound.enabled) {
        this.dom.soundToggleBtn.innerHTML = '<span class="btn-icon">🔊</span><span class="btn-label">효과음 ON</span>';
        this.sound.playKeyClick();
      } else {
        this.dom.soundToggleBtn.innerHTML = '<span class="btn-icon">🔇</span><span class="btn-label">효과음 OFF</span>';
      }
    });

    // Modal buttons
    this.dom.modalRestartBtn.addEventListener('click', () => {
      this.dom.resultModal.classList.add('hidden');
      this.setupPracticeMode();
    });
  }
}

// Start application when DOM loaded
document.addEventListener('DOMContentLoaded', () => {
  new DokdoTypingApp();
});
