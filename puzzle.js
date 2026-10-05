/**
 * 순천선혜학교 독도교육주간 - 독도 사진 퍼즐 맞추기 대회
 * 
 * [과정별 맞춤형 퍼즐 시스템]
 * 1. 🎒 초등부 모드 ('drag'):
 *    - 1단계 (왼쪽): 흩어진 16개 퍼즐 조각 보관함 (깔아놓은 조각들)
 *    - 2단계 (오른쪽): 독도 사진 완성 판 (16칸 타겟 슬롯)
 *    - 왼쪽에서 오른쪽으로 드래그하거나, 클릭-클릭하여 쏙쏙 맞춰 완성!
 *    - "한국의 아름다운 섬, 독도" 신규 사진 적용
 *    - 번호 힌트, 밑그림 힌트, 제자리 맞춤 초록 체크 & 차임벨 피드백
 * 
 * 2. 🏫 중학교 / 고등학교 모드 ('slide'):
 *    - 기존의 16등분 슬라이딩 퍼즐 (15-Puzzle)
 *    - 16번째 빈칸으로 주변 조각을 밀어 넣는 방식
 *    - "독도와 괭이갈매기" 기존 대표 사진 적용
 *    - 100% 풀 수 있는 35회 검증 셔플 알고리즘
 * 
 * 3. 공통 편의 기능:
 *    - 과정(초등/중학/고등) 선택 시 자동 분기 + '방식 전환' 수동 토글 지원
 *    - Firebase Firestore 실시간 순위표 및 명예의 전당 연동
 *    - Web Audio 청각 효과음
 */

class DokdoPuzzleGame {
  constructor() {
    this.boardSize = 4; // 4x4 = 16
    this.totalTiles = 16;
    this.emptyTileId = 15; // 슬라이딩 모드용 16번째 빈칸

    // 'drag' (초등) or 'slide' (중·고등)
    this.mode = 'drag';

    // ------------------------------------------
    // 초등부 드래그 모드 상태
    // ------------------------------------------
    // elemTray[i]: 왼쪽 보관함 i번째 자리에 있는 조각 번호(0..15) 또는 null(오른쪽 판으로 이동됨)
    this.elemTray = [];
    // elemBoard[j]: 오른쪽 완성 판 j번째 칸에 놓인 조각 번호(0..15) 또는 null(비어있음)
    this.elemBoard = [];
    // 클릭-클릭 이동용 선택 상태 { area: 'tray' | 'board', index: number }
    this.selectedSource = null;
    // 드래그-드롭용 드래그 상태 { area: 'tray' | 'board', index: number }
    this.draggedSource = null;

    // ------------------------------------------
    // 중·고등부 슬라이딩 모드 상태
    // ------------------------------------------
    this.slideTiles = [];

    // ------------------------------------------
    // 공통 게임 상태
    // ------------------------------------------
    this.numberHintEnabled = true;
    this.ghostHintEnabled = false;

    this.moveCount = 0;
    this.startTime = null;
    this.timerInterval = null;
    this.isPlaying = false;
    this.isShuffling = false;
    this.soundEnabled = true;

    // 참가자 정보
    this.participant = {
      course: '',
      grade: '',
      classNum: ''
    };

    // Web Audio
    this.audioCtx = null;

    // 순위 정보
    this.currentLeaderboardCourse = '초등학교';
    this.lastFinishedRecordId = null;
    this.lastRank = null;

    // DOM Elements
    this.dom = {
      // Workspaces
      elementaryWorkspace: document.getElementById('elementaryWorkspace'),
      slideWorkspace: document.getElementById('slideWorkspace'),
      elementaryTray: document.getElementById('elementaryTray'),
      elementaryTargetBoard: document.getElementById('elementaryTargetBoard'),
      puzzleBoard: document.getElementById('puzzleBoard'),
      
      // Control Bar
      modeDisplayBadge: document.getElementById('modeDisplayBadge'),
      moveCountVal: document.getElementById('moveCountVal'),
      timerVal: document.getElementById('timerVal'),
      viewOriginalBtn: document.getElementById('viewOriginalBtn'),
      restartPuzzleBtn: document.getElementById('restartPuzzleBtn'),
      soundToggleBtn: document.getElementById('soundToggleBtn'),
      openLeaderboardBtn: document.getElementById('openLeaderboardBtn'),

      // Answer Photo Modal
      answerPhotoModal: document.getElementById('answerPhotoModal'),
      answerModalTitle: document.getElementById('answerModalTitle'),
      answerModalImg: document.getElementById('answerModalImg'),
      closeAnswerModalBtn: document.getElementById('closeAnswerModalBtn'),
      confirmCloseAnswerBtn: document.getElementById('confirmCloseAnswerBtn'),

      // Banners
      elementaryShuffleBanner: document.getElementById('elementaryShuffleBanner'),
      elementaryShuffleBannerText: document.getElementById('elementaryShuffleBannerText'),
      slideShuffleBanner: document.getElementById('slideShuffleBanner'),
      slideShuffleBannerText: document.getElementById('slideShuffleBannerText'),

      // Slide Preview Card
      previewTitle: document.getElementById('previewTitle'),
      previewSub: document.getElementById('previewSub'),
      previewImg: document.getElementById('previewImg'),
      previewFooterDesc: document.getElementById('previewFooterDesc'),

      // Participant UI
      participantDisplay: document.getElementById('participantDisplay'),
      changeParticipantBtn: document.getElementById('changeParticipantBtn'),
      participantModal: document.getElementById('participantModal'),
      participantForm: document.getElementById('participantForm'),
      courseRadios: document.querySelectorAll('input[name="schoolCourse"]'),
      studentGrade: document.getElementById('studentGrade'),
      studentClass: document.getElementById('studentClass'),

      // Leaderboard
      puzzleTbody_elem: document.getElementById('puzzleTbody_elem'),
      puzzleTbody_mid: document.getElementById('puzzleTbody_mid'),
      puzzleTbody_high: document.getElementById('puzzleTbody_high'),

      // Win Modal
      winModal: document.getElementById('winModal'),
      winRankBadge: document.getElementById('winRankBadge'),
      winStudentBadge: document.getElementById('winStudentBadge'),
      winModalSubheading: document.getElementById('winModalSubheading'),
      winCompletedImg: document.getElementById('winCompletedImg'),
      modalMoves: document.getElementById('modalMoves'),
      modalTime: document.getElementById('modalTime'),
      modalRestartBtn: document.getElementById('modalRestartBtn')
    };

    this.init();
  }

  init() {
    this.initAudio();
    this.loadParticipant();

    // 참가자 과정에 맞춰 모드 초기화 (중·고등: 슬라이딩, 초등: 드래그)
    if (this.participant && (this.participant.course === '중학교' || this.participant.course === '고등학교')) {
      this.mode = 'slide';
    } else {
      this.mode = 'drag';
    }

    this.applyModeUI();
    this.setupSolvedState();
    this.renderCurrentMode();
    this.bindEvents();
    this.checkInitialParticipantRegistration();
  }

  initAudio() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      this.audioCtx = new AudioCtx();
    }
  }

  // 모드 전환
  setMode(newMode, reshuffle = true) {
    this.mode = (newMode === 'slide') ? 'slide' : 'drag';
    this.applyModeUI();
    this.setupSolvedState();
    if (reshuffle) {
      this.startShuffleSequence(false);
    } else {
      this.renderCurrentMode();
    }
  }

  applyModeUI() {
    if (this.mode === 'drag') {
      // 초등부 워크스페이스 노출, 중·고등부 숨김
      if (this.dom.elementaryWorkspace) {
        this.dom.elementaryWorkspace.classList.remove('hidden');
        this.dom.elementaryWorkspace.style.display = 'grid';
      }
      if (this.dom.slideWorkspace) {
        this.dom.slideWorkspace.classList.add('hidden');
        this.dom.slideWorkspace.style.display = 'none';
      }
      if (this.dom.modeDisplayBadge) this.dom.modeDisplayBadge.textContent = '🎒 초등: 16조각 드래그 맞추기';
      if (this.dom.winCompletedImg) this.dom.winCompletedImg.src = 'dokdo_puzzle.png';
    } else {
      // 중·고등부 워크스페이스 노출, 초등부 숨김
      if (this.dom.elementaryWorkspace) {
        this.dom.elementaryWorkspace.classList.add('hidden');
        this.dom.elementaryWorkspace.style.display = 'none';
      }
      if (this.dom.slideWorkspace) {
        this.dom.slideWorkspace.classList.remove('hidden');
        this.dom.slideWorkspace.style.display = 'grid';
      }
      if (this.dom.modeDisplayBadge) this.dom.modeDisplayBadge.textContent = '🏫 중·고등: 16등분 슬라이딩 퍼즐';
      if (this.dom.winCompletedImg) this.dom.winCompletedImg.src = 'dokdo_puzzle.jpg';
    }
  }

  // 참가자 정보 불러오기 및 저장
  loadParticipant() {
    try {
      const saved = localStorage.getItem('dokdo_puzzle_participant') || localStorage.getItem('dokdo_typing_participant');
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
      localStorage.setItem('dokdo_puzzle_participant', serialized);
      localStorage.setItem('dokdo_typing_participant', serialized);
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
    }
  }

  openParticipantModal() {
    const course = this.participant?.course;
    if (course) {
      const radio = document.querySelector(`input[name="schoolCourse"][value="${course}"]`);
      if (radio) radio.checked = true;
      this.updateGradeOptions(course, this.participant.grade);
    } else {
      this.dom.courseRadios.forEach(r => r.checked = false);
      this.resetGradeOptions();
    }

    if (this.participant?.classNum) {
      this.dom.studentClass.value = this.participant.classNum;
    } else {
      this.dom.studentClass.value = '';
    }

    this.dom.participantModal.classList.remove('hidden');
  }

  closeParticipantModal() {
    this.dom.participantModal.classList.add('hidden');
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

  // ------------------------------------------
  // Audio Feedback
  // ------------------------------------------
  playSlideSound() {
    if (!this.soundEnabled || !this.audioCtx) return;
    try {
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(140, this.audioCtx.currentTime + 0.06);

      gain.gain.setValueAtTime(0.12, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.06);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.06);
    } catch (e) {}
  }

  playPickSound() {
    if (!this.soundEnabled || !this.audioCtx) return;
    try {
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(480, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(620, this.audioCtx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.05);
    } catch (e) {}
  }

  playDropSound() {
    if (!this.soundEnabled || !this.audioCtx) return;
    try {
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, this.audioCtx.currentTime + 0.07);

      gain.gain.setValueAtTime(0.12, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.07);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.07);
    } catch (e) {}
  }

  // 개별 조각 정답 힌트 소리 비활성화 (대회 공정성 및 힌트 제거)
  playCorrectSound() {
    return;
  }

  playVictorySound() {
    if (!this.soundEnabled || !this.audioCtx) return;
    try {
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
      const notes = [523.25, 659.25, 783.99, 1046.50];
      const now = this.audioCtx.currentTime;

      notes.forEach((freq, idx) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.13);

        gain.gain.setValueAtTime(0.16, now + idx * 0.13);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.13 + 0.38);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now + idx * 0.13);
        osc.stop(now + idx * 0.13 + 0.38);
      });
    } catch (e) {}
  }

  // ------------------------------------------
  // 공통 게임 상태 및 타이머
  // ------------------------------------------
  setupSolvedState() {
    if (this.mode === 'drag') {
      this.elemTray = Array(16).fill(null);
      this.elemBoard = [...Array(16).keys()]; // 완성본 보여주기 상태
      this.selectedSource = null;
      this.draggedSource = null;
    } else {
      this.slideTiles = [...Array(16).keys()];
    }

    this.moveCount = 0;
    this.isPlaying = false;
    clearInterval(this.timerInterval);
    this.startTime = null;
    this.updateStatsUI();
  }

  startTimer() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.startTime = Date.now();
    this.timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const s = String(elapsed % 60).padStart(2, '0');
      this.dom.timerVal.textContent = `${m}:${s}`;
    }, 500);
  }

  countCorrectPieces() {
    if (this.mode === 'drag') {
      return this.elemBoard.reduce((acc, pieceId, slotIdx) => (pieceId === slotIdx ? acc + 1 : acc), 0);
    } else {
      return this.slideTiles.reduce((acc, tileId, pos) => (tileId === pos ? acc + 1 : acc), 0);
    }
  }

  updateStatsUI() {
    this.dom.moveCountVal.textContent = this.moveCount;
    if (!this.isPlaying) {
      this.dom.timerVal.textContent = '00:00';
    }
  }

  // ------------------------------------------
  // 정답 사진 보기 모달 제어
  // ------------------------------------------
  openAnswerModal() {
    if (this.dom.answerModalImg) {
      this.dom.answerModalImg.src = (this.mode === 'drag' ? 'dokdo_puzzle.png' : 'dokdo_puzzle.jpg');
    }
    if (this.dom.answerModalTitle) {
      this.dom.answerModalTitle.textContent = (this.mode === 'drag' 
        ? '정답 독도 사진 (한국의 아름다운 섬, 독도)' 
        : '정답 독도 사진 (독도와 괭이갈매기)');
    }
    if (this.dom.answerPhotoModal) {
      this.dom.answerPhotoModal.classList.remove('hidden');
    }
    this.playPickSound();
  }

  closeAnswerModal() {
    if (this.dom.answerPhotoModal) {
      this.dom.answerPhotoModal.classList.add('hidden');
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  showShuffleBanner(text) {
    const banner = (this.mode === 'drag') ? this.dom.elementaryShuffleBanner : this.dom.slideShuffleBanner;
    const textEl = (this.mode === 'drag') ? this.dom.elementaryShuffleBannerText : this.dom.slideShuffleBannerText;
    if (banner && textEl) {
      textEl.textContent = text;
      banner.classList.remove('hidden');
    }
  }

  hideShuffleBanner() {
    if (this.dom.elementaryShuffleBanner) this.dom.elementaryShuffleBanner.classList.add('hidden');
    if (this.dom.slideShuffleBanner) this.dom.slideShuffleBanner.classList.add('hidden');
  }

  // ------------------------------------------
  // 셔플 시퀀스 (모드별 분기)
  // ------------------------------------------
  async startShuffleSequence(isInitial = false) {
    if (this.isShuffling) return;
    this.isShuffling = true;

    if (this.mode === 'drag') {
      // [초등부 셔플]
      // 1. 오른쪽 판에 온전한 완성 사진 보여주기
      this.elemTray = Array(16).fill(null);
      this.elemBoard = [...Array(16).keys()];
      this.renderElementaryBoards();

      this.showShuffleBanner('🖼️ 완성된 독도 사진을 잘 기억해 보세요!');
      await this.sleep(1200);

      this.showShuffleBanner('🔀 16개 조각을 왼쪽 보관함으로 흩어놓습니다!');
      this.playPickSound();
      await this.sleep(400);

      // 2. 오른쪽 판 비우고, 왼쪽 보관함에 16개 조각을 무작위로 배치
      let shuffled = [...Array(16).keys()];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      this.elemBoard = Array(16).fill(null);
      this.elemTray = Array(16).fill(null);
      this.renderElementaryBoards();

      // 경쾌하게 하나씩 왼쪽 트레이에 나타나는 연출
      for (let s = 0; s < 16; s++) {
        this.elemTray[s] = shuffled[s];
        if (s % 3 === 0) {
          this.playDropSound();
          this.renderElementaryBoards();
          await this.sleep(30);
        }
      }
      this.renderElementaryBoards();

      this.showShuffleBanner('🎯 출발! 왼쪽 조각을 오른쪽 판으로 옮겨 맞춰보세요!');
    } else {
      // [중·고등부 셔플]
      this.slideTiles = [...Array(16).keys()];
      this.renderSlideBoard(true);

      this.showShuffleBanner('🖼️ 완성된 독도 사진을 잘 기억해 보세요!');
      await this.sleep(1200);

      this.showShuffleBanner('🔀 16번째 조각이 열리며 퍼즐을 섞습니다!');
      this.playSlideSound();
      await this.sleep(400);

      this.renderSlideBoard(false);
      await this.sleep(100);

      const stepCount = 35;
      let lastMovedPos = -1;
      for (let i = 0; i < stepCount; i++) {
        const movable = this.getSlideMovablePositions();
        const candidates = movable.filter(pos => pos !== lastMovedPos);
        const chosen = candidates.length > 0
          ? candidates[Math.floor(Math.random() * candidates.length)]
          : movable[Math.floor(Math.random() * movable.length)];

        const emptyPos = this.getSlideEmptyPos();
        this.slideMoveTile(chosen, false);
        lastMovedPos = emptyPos;

        if (i % 3 === 0) this.playSlideSound();
        this.renderSlideBoard(false);
        await this.sleep(38);
      }

      this.showShuffleBanner('🎯 출발! 빈칸 옆 조각을 클릭하여 퍼즐을 맞춰보세요!');
    }

    // 통계 초기화
    this.moveCount = 0;
    this.isPlaying = false;
    this.selectedSource = null;
    clearInterval(this.timerInterval);
    this.startTime = null;
    this.updateStatsUI();

    setTimeout(() => {
      this.hideShuffleBanner();
    }, 2000);

    this.isShuffling = false;
    this.renderCurrentMode();
  }

  renderCurrentMode() {
    if (this.mode === 'drag') {
      this.renderElementaryBoards();
    } else {
      this.renderSlideBoard(false);
    }
  }

  // =========================================================================
  // 🎒 초등부 모드: 왼쪽 트레이(16조각) ➔ 오른쪽 완성 판(16칸) 렌더링 및 인터랙션
  // =========================================================================
  renderElementaryBoards() {
    this.renderElementaryTray();
    this.renderElementaryTargetBoard();
  }

  // 1. 왼쪽 트레이 렌더링
  renderElementaryTray() {
    const trayEl = this.dom.elementaryTray;
    if (!trayEl) return;
    trayEl.innerHTML = '';

    this.elemTray.forEach((pieceId, trayIdx) => {
      if (pieceId !== null) {
        // 조각 렌더링
        const tileEl = this.createPieceTileElement(pieceId, 'tray', trayIdx);
        trayEl.appendChild(tileEl);
      } else {
        // 비어있는 트레이 자리 (플레이스홀더)
        const emptyEl = document.createElement('div');
        emptyEl.className = 'tray-slot-placeholder';
        emptyEl.textContent = `빈자리`;
        
        // 비어있는 트레이 자리로 드롭/클릭하여 다시 가져오기 지원
        emptyEl.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        });
        emptyEl.addEventListener('drop', (e) => {
          e.preventDefault();
          if (this.draggedSource && this.draggedSource.area === 'board') {
            this.executeElementaryMove(this.draggedSource, { area: 'tray', index: trayIdx });
          }
          this.draggedSource = null;
        });
        emptyEl.addEventListener('click', () => {
          if (this.selectedSource && this.selectedSource.area === 'board') {
            this.executeElementaryMove(this.selectedSource, { area: 'tray', index: trayIdx });
          }
        });

        trayEl.appendChild(emptyEl);
      }
    });
  }

  // 2. 오른쪽 완성 판 렌더링
  renderElementaryTargetBoard() {
    const targetBoardEl = this.dom.elementaryTargetBoard;
    if (!targetBoardEl) return;
    targetBoardEl.innerHTML = '';

    this.elemBoard.forEach((pieceId, slotIdx) => {
      if (pieceId !== null) {
        // 조각이 놓여있는 슬롯
        const tileEl = this.createPieceTileElement(pieceId, 'board', slotIdx);
        targetBoardEl.appendChild(tileEl);
      } else {
        // 비어있는 목표 슬롯
        const emptySlotEl = document.createElement('div');
        emptySlotEl.className = 'target-slot-empty';
        emptySlotEl.dataset.slotIdx = slotIdx;

        // 드래그 오버 & 드롭
        emptySlotEl.addEventListener('dragenter', (e) => {
          e.preventDefault();
          emptySlotEl.classList.add('drag-over');
        });
        emptySlotEl.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        });
        emptySlotEl.addEventListener('dragleave', () => {
          emptySlotEl.classList.remove('drag-over');
        });
        emptySlotEl.addEventListener('drop', (e) => {
          e.preventDefault();
          emptySlotEl.classList.remove('drag-over');
          if (this.draggedSource) {
            this.executeElementaryMove(this.draggedSource, { area: 'board', index: slotIdx });
          }
          this.draggedSource = null;
        });

        // 클릭으로 넣기
        emptySlotEl.addEventListener('click', () => {
          if (this.selectedSource) {
            this.executeElementaryMove(this.selectedSource, { area: 'board', index: slotIdx });
          }
        });

        targetBoardEl.appendChild(emptySlotEl);
      }
    });
  }

  // 조각 엘리먼트 생성 공통 함수
  createPieceTileElement(pieceId, area, index) {
    const tileEl = document.createElement('div');
    tileEl.className = 'puzzle-tile';
    tileEl.dataset.area = area;
    tileEl.dataset.index = index;
    tileEl.dataset.pieceId = pieceId;
    tileEl.draggable = true;

    // 배경 위치 계산
    const originalRow = Math.floor(pieceId / 4);
    const originalCol = pieceId % 4;
    const posX = (originalCol * 33.333333).toFixed(4);
    const posY = (originalRow * 33.333333).toFixed(4);
    tileEl.style.backgroundPosition = `${posX}% ${posY}%`;
    tileEl.style.backgroundImage = "url('dokdo_puzzle.png')";

    // 선택 상태 표시
    if (this.selectedSource && this.selectedSource.area === area && this.selectedSource.index === index) {
      tileEl.classList.add('selected-for-placement');
    }

    tileEl.title = `독도 퍼즐 조각 (클릭하거나 드래그하여 이동)`;

    // 드래그 이벤트
    tileEl.addEventListener('dragstart', (e) => {
      if (this.isShuffling) {
        e.preventDefault();
        return;
      }
      this.draggedSource = { area, index };
      tileEl.classList.add('is-dragging');
      e.dataTransfer.setData('text/plain', JSON.stringify({ area, index }));
      e.dataTransfer.effectAllowed = 'move';
      this.playPickSound();
    });

    tileEl.addEventListener('dragenter', (e) => {
      e.preventDefault();
      if (this.draggedSource && !(this.draggedSource.area === area && this.draggedSource.index === index)) {
        tileEl.classList.add('drag-over');
      }
    });

    tileEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    tileEl.addEventListener('dragleave', () => {
      tileEl.classList.remove('drag-over');
    });

    tileEl.addEventListener('drop', (e) => {
      e.preventDefault();
      tileEl.classList.remove('drag-over');
      if (this.draggedSource) {
        this.executeElementaryMove(this.draggedSource, { area, index });
      }
      this.draggedSource = null;
    });

    tileEl.addEventListener('dragend', () => {
      document.querySelectorAll('.puzzle-tile, .target-slot-empty').forEach(el => {
        el.classList.remove('is-dragging', 'drag-over');
      });
      this.draggedSource = null;
    });

    // 클릭 이벤트
    tileEl.addEventListener('click', (e) => {
      if (tileEl.classList.contains('is-dragging')) return;
      this.handleElementaryPieceClick(area, index);
    });

    return tileEl;
  }

  // 초등부 조각 클릭 핸들러 (원클릭 선택 ➔ 대상 클릭으로 이동)
  handleElementaryPieceClick(area, index) {
    if (this.isShuffling) return;

    if (!this.selectedSource) {
      // 1. 첫 번째 조각 선택
      this.selectedSource = { area, index };
      this.playPickSound();
      this.renderElementaryBoards();
    } else if (this.selectedSource.area === area && this.selectedSource.index === index) {
      // 같은 조각 다시 클릭 시 선택 취소
      this.selectedSource = null;
      this.renderElementaryBoards();
    } else {
      // 2. 다른 조각과 스왑 또는 이동
      const from = this.selectedSource;
      this.selectedSource = null;
      this.executeElementaryMove(from, { area, index });
    }
  }

  // 초등부 이동 실행 (보관함 ↔ 완성판, 슬롯 간 이동 및 교환)
  executeElementaryMove(from, to) {
    if (from.area === to.area && from.index === to.index) return;

    // 이동시킬 조각 번호 추출
    const sourcePieceId = (from.area === 'tray') ? this.elemTray[from.index] : this.elemBoard[from.index];
    if (sourcePieceId === null) return;

    const targetPieceId = (to.area === 'tray') ? this.elemTray[to.index] : this.elemBoard[to.index];

    // 스왑 또는 단순 이동
    if (to.area === 'board') {
      this.elemBoard[to.index] = sourcePieceId;
      if (from.area === 'tray') {
        this.elemTray[from.index] = targetPieceId; // targetPieceId가 null이면 null이 됨
      } else {
        this.elemBoard[from.index] = targetPieceId;
      }
    } else {
      // to.area === 'tray'
      this.elemTray[to.index] = sourcePieceId;
      if (from.area === 'board') {
        this.elemBoard[from.index] = targetPieceId;
      } else {
        this.elemTray[from.index] = targetPieceId;
      }
    }

    this.moveCount++;
    this.startTimer();
    this.playDropSound();

    this.selectedSource = null;
    this.updateStatsUI();
    this.renderElementaryBoards();
    this.checkElementaryWin();
  }

  checkElementaryWin() {
    if (this.moveCount === 0) return;

    // 16개 슬롯 모두 빈자리 없이 제자리(idx === pieceId)인지 검사
    const isSolved = this.elemBoard.every((pieceId, idx) => pieceId === idx);
    if (isSolved) {
      this.triggerWinModal();
    }
  }

  // =========================================================================
  // 🏫 중·고등부 모드: 정통 16등분 슬라이딩 퍼즐 렌더링 및 인터랙션
  // =========================================================================
  getSlideEmptyPos() {
    return this.slideTiles.indexOf(this.emptyTileId);
  }

  getSlideMovablePositions() {
    const emptyPos = this.getSlideEmptyPos();
    const emptyRow = Math.floor(emptyPos / 4);
    const emptyCol = emptyPos % 4;
    const movable = [];

    const deltas = [
      { r: -1, c: 0 },
      { r: 1, c: 0 },
      { r: 0, c: -1 },
      { r: 0, c: 1 }
    ];

    deltas.forEach(d => {
      const nr = emptyRow + d.r;
      const nc = emptyCol + d.c;
      if (nr >= 0 && nr < 4 && nc >= 0 && nc < 4) {
        movable.push(nr * 4 + nc);
      }
    });

    return movable;
  }

  slideMoveTile(pos, isUserAction = true) {
    if (!this.getSlideMovablePositions().includes(pos)) return false;

    const emptyPos = this.getSlideEmptyPos();
    const temp = this.slideTiles[pos];
    this.slideTiles[pos] = this.slideTiles[emptyPos];
    this.slideTiles[emptyPos] = temp;

    if (isUserAction) {
      this.moveCount++;
      this.startTimer();
      this.playSlideSound();
      this.updateStatsUI();
      this.renderSlideBoard(false);
      this.checkSlideWin();
    }
    return true;
  }

  renderSlideBoard(showFullCompleted = false) {
    const boardEl = this.dom.puzzleBoard;
    if (!boardEl) return;
    boardEl.innerHTML = '';

    const movablePositions = (!showFullCompleted) ? this.getSlideMovablePositions() : [];

    this.slideTiles.forEach((tileId, pos) => {
      const tileEl = document.createElement('div');
      tileEl.className = 'puzzle-tile';
      tileEl.dataset.pos = pos;
      tileEl.dataset.tileId = tileId;

      if (!showFullCompleted && tileId === this.emptyTileId) {
        tileEl.classList.add('empty-tile');
      } else {
        const originalRow = Math.floor(tileId / 4);
        const originalCol = tileId % 4;
        const posX = (originalCol * 33.333333).toFixed(4);
        const posY = (originalRow * 33.333333).toFixed(4);
        tileEl.style.backgroundPosition = `${posX}% ${posY}%`;
        tileEl.style.backgroundImage = "url('dokdo_puzzle.jpg')";

        if (!showFullCompleted && movablePositions.includes(pos)) {
          tileEl.classList.add('movable');
          tileEl.title = '클릭하면 빈자리로 이동합니다';
        }
      }

      tileEl.addEventListener('click', () => {
        if (this.isShuffling) return;
        this.slideMoveTile(pos, true);
      });

      boardEl.appendChild(tileEl);
    });
  }

  checkSlideWin() {
    if (this.moveCount === 0) return;
    const isSolved = this.slideTiles.every((tileId, idx) => tileId === idx);
    if (isSolved) {
      this.triggerWinModal();
    }
  }

  // =========================================================================
  // 완성 축하 모달 및 순위표 등록 공통 로직
  // =========================================================================
  triggerWinModal() {
    clearInterval(this.timerInterval);
    this.isPlaying = false;
    this.playVictorySound();

    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    const timeFormatted = `${m}:${s}`;

    let rank = '🌱 독도 퍼즐 지킴이';
    if (this.mode === 'slide') {
      if (this.moveCount <= 45) rank = '🏆 독도 퍼즐 마스터 (특급)';
      else if (this.moveCount <= 80) rank = '🎖️ 동해의 명탐정 (우수)';
      else if (this.moveCount <= 140) rank = '⭐ 괭이갈매기 수호대 (준수)';
    } else {
      if (this.moveCount <= 16) rank = '🏆 독도 퍼즐 마스터 (특급)';
      else if (this.moveCount <= 28) rank = '🎖️ 동해의 명탐정 (우수)';
      else if (this.moveCount <= 45) rank = '⭐ 괭이갈매기 수호대 (준수)';
    }

    this.dom.winRankBadge.textContent = rank;
    this.dom.winStudentBadge.textContent = this.getParticipantString();
    this.dom.modalMoves.textContent = this.moveCount;
    this.dom.modalTime.textContent = timeFormatted;

    // 순위 등록
    if (typeof RankingManager !== 'undefined') {
      const currentCourse = this.participant.course || (this.mode === 'slide' ? '중학교' : '초등학교');
      this.currentLeaderboardCourse = currentCourse;

      const rankInfo = RankingManager.addPuzzleRecord({
        course: currentCourse,
        grade: this.participant.grade,
        classNum: this.participant.classNum,
        totalSeconds: elapsed,
        moveCount: this.moveCount
      });

      this.lastFinishedRecordId = rankInfo.recordId;
      this.lastRank = rankInfo.rank;

      if (rankInfo.rank && this.dom.winModalSubheading) {
        if (rankInfo.isNewBest) {
          this.dom.winModalSubheading.textContent = `🎉 우리 반 최고 기록 경신! [${this.participant.grade} ${this.participant.classNum}]이(가) ${currentCourse} 부문 ${rankInfo.rank}위에 올랐습니다!`;
        } else {
          this.dom.winModalSubheading.textContent = `우리 반 [${this.participant.grade} ${this.participant.classNum}]의 현재 최고 기록 순위는 ${currentCourse} 부문 ${rankInfo.rank}위입니다!`;
        }
      }

      RankingManager.renderAllPuzzleLeaderboards(this.lastFinishedRecordId);
    }

    this.dom.winModal.classList.remove('hidden');
  }

  // =========================================================================
  // 이벤트 바인딩
  // =========================================================================
  bindEvents() {
    this.dom.courseRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.updateGradeOptions(e.target.value);
      });
    });

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

      const courseVal = checkedRadio.value;
      this.saveParticipant({
        course: courseVal,
        grade: selectedGrade,
        classNum: selectedClass
      });

      this.closeParticipantModal();

      // 과정에 따라 모드 자동 분기: 중·고등은 슬라이딩, 초등은 드래그 맞추기
      const targetMode = (courseVal === '중학교' || courseVal === '고등학교') ? 'slide' : 'drag';
      this.setMode(targetMode, true);
    });

    this.dom.changeParticipantBtn.addEventListener('click', () => {
      this.openParticipantModal();
    });

    // 정답 사진 보기 모달
    if (this.dom.viewOriginalBtn) {
      this.dom.viewOriginalBtn.addEventListener('click', () => {
        this.openAnswerModal();
      });
    }

    if (this.dom.closeAnswerModalBtn) {
      this.dom.closeAnswerModalBtn.addEventListener('click', () => {
        this.closeAnswerModal();
      });
    }

    if (this.dom.confirmCloseAnswerBtn) {
      this.dom.confirmCloseAnswerBtn.addEventListener('click', () => {
        this.closeAnswerModal();
      });
    }

    if (this.dom.answerPhotoModal) {
      this.dom.answerPhotoModal.addEventListener('click', (e) => {
        if (e.target === this.dom.answerPhotoModal) {
          this.closeAnswerModal();
        }
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.dom.answerPhotoModal && !this.dom.answerPhotoModal.classList.contains('hidden')) {
        this.closeAnswerModal();
      }
    });

    // 퍼즐 새로 섞기
    if (this.dom.restartPuzzleBtn) {
      this.dom.restartPuzzleBtn.addEventListener('click', () => {
        this.startShuffleSequence(false);
      });
    }

    // Header Leaderboard Button
    if (this.dom.openLeaderboardBtn) {
      this.dom.openLeaderboardBtn.addEventListener('click', () => {
        if (typeof RankingManager !== 'undefined') {
          RankingManager.renderAllPuzzleLeaderboards(this.lastFinishedRecordId);
        }
        this.dom.winModal.classList.remove('hidden');
      });
    }

    // Sound toggle
    this.dom.soundToggleBtn.addEventListener('click', () => {
      this.soundEnabled = !this.soundEnabled;
      if (this.soundEnabled) {
        this.dom.soundToggleBtn.innerHTML = '<span class="btn-icon">🔊</span><span class="btn-label">효과음 ON</span>';
        this.playPickSound();
      } else {
        this.dom.soundToggleBtn.innerHTML = '<span class="btn-icon">🔇</span><span class="btn-label">효과음 OFF</span>';
      }
    });

    // Modal buttons
    this.dom.modalRestartBtn.addEventListener('click', () => {
      this.dom.winModal.classList.add('hidden');
      this.startShuffleSequence(false);
    });
  }
}

// Start game on load
document.addEventListener('DOMContentLoaded', () => {
  new DokdoPuzzleGame();
});
