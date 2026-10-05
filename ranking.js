/**
 * 순천선혜학교 독도교육주간 - 과정별 명예의 전당 (Firebase Firestore 실시간 연동)
 * 
 * [주요 특징]
 * 1. 구글 Firebase Firestore 실시간(Realtime) 동기화
 *    - onSnapshot() 리스너를 통해 다른 학생이 기록을 등록하는 즉시 모든 접속자의 순위표가 자동 갱신됨
 * 2. 각 학년/반별 "최고의 기록"만 1개씩 유지 (반별 중복 등록 방지)
 *    - 같은 반이 여러 번 도전 시 기존 최고 기록과 비교하여 더 우수한 기록일 때만 갱신
 * 3. 오프라인 & 로컬스토리지 백업 지원
 *    - 네트워크 지연 시에도 로컬 캐시를 통해 화면이 멈춤 없이 즉각 반응
 * 4. 타자 대회 순위 기준:
 *    - 1순위: 정확도 높은 순 -> 2순위: 소요 시간 빠른 순 -> 3순위: 평균 타수 높은 순
 * 5. 퍼즐 맞추기 대회 순위 기준:
 *    - 1순위: 소요 시간 빠른 순 -> 2순위: 이동 횟수 적은 순
 */

// ==========================================
// 1. Firebase 설정 및 초기화
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyDgXY9RrhuzwcksDYeXWiXtkmHHZot29uo",
  authDomain: "ranking-1f9bb.firebaseapp.com",
  projectId: "ranking-1f9bb",
  storageBucket: "ranking-1f9bb.firebasestorage.app",
  messagingSenderId: "1027424430901",
  appId: "1:1027424430901:web:3c35c3f5cdc7a6f69cfa7c"
};

let db = null;
try {
  if (typeof firebase !== 'undefined') {
    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    db = firebase.firestore();
  }
} catch (e) {
  console.warn('Firebase 초기화 경고:', e);
}

const RankingManager = (function() {
  const STORAGE_KEY_TYPING = 'dokdo_typing_records_real_v1';
  const STORAGE_KEY_PUZZLE = 'dokdo_puzzle_records_real_v1';

  // 초기 빈 데이터 구조
  function getEmptyData() {
    return {
      '초등학교': [],
      '중학교': [],
      '고등학교': []
    };
  }

  // 초기 로컬스토리지 데이터 로드
  function loadLocalData(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : getEmptyData();
    } catch (e) {
      return getEmptyData();
    }
  }

  let memoryTyping = loadLocalData(STORAGE_KEY_TYPING);
  let memoryPuzzle = loadLocalData(STORAGE_KEY_PUZZLE);

  // 타자 기록 우수 여부 비교 (A가 B보다 더 좋은 기록인가?)
  function isTypingBetter(a, b) {
    if (a.accuracy !== b.accuracy) {
      return a.accuracy > b.accuracy;
    }
    if (a.totalSeconds !== b.totalSeconds) {
      return a.totalSeconds < b.totalSeconds;
    }
    return a.avgCpm > b.avgCpm;
  }

  // 퍼즐 기록 우수 여부 비교 (A가 B보다 더 좋은 기록인가?)
  function isPuzzleBetter(a, b) {
    if (a.totalSeconds !== b.totalSeconds) {
      return a.totalSeconds < b.totalSeconds;
    }
    return a.moveCount < b.moveCount;
  }

  // 타자 순위 정렬 기준: 1. 정확도 높은 순 -> 2. 시간 빠른 순 -> 3. 타수 높은 순
  function sortTypingRecords(list) {
    list.sort((a, b) => {
      if (b.accuracy !== a.accuracy) {
        return b.accuracy - a.accuracy;
      }
      if (a.totalSeconds !== b.totalSeconds) {
        return a.totalSeconds - b.totalSeconds;
      }
      return b.avgCpm - a.avgCpm;
    });
  }

  // 퍼즐 순위 정렬 기준: 1. 시간 빠른 순 -> 2. 이동 횟수 적은 순
  function sortPuzzleRecords(list) {
    list.sort((a, b) => {
      if (a.totalSeconds !== b.totalSeconds) {
        return a.totalSeconds - b.totalSeconds;
      }
      return a.moveCount - b.moveCount;
    });
  }

  // 시간 포맷 (초 -> "1분 25초" 또는 "45초")
  function formatSeconds(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m === 0) return `${s}초`;
    return `${m}분 ${String(s).padStart(2, '0')}초`;
  }

  // ==========================================
  // 2. Firebase Firestore 실시간 리스너 설정
  // ==========================================
  if (db) {
    // 2-1. 타자 대회 실시간 순위 구독
    try {
      db.collection('dokdo_typing_records').onSnapshot((snapshot) => {
        const grouped = getEmptyData();
        snapshot.forEach((doc) => {
          const d = doc.data();
          const course = d.course || '초등학교';
          if (grouped[course]) {
            grouped[course].push({
              id: doc.id,
              course: course,
              grade: d.grade,
              classNum: d.classNum,
              accuracy: Number(d.accuracy) || 0,
              totalSeconds: Number(d.totalSeconds) || 0,
              avgCpm: Number(d.avgCpm) || 0,
              date: d.date || ''
            });
          }
        });

        for (const c of Object.keys(grouped)) {
          sortTypingRecords(grouped[c]);
        }
        memoryTyping = grouped;
        try {
          localStorage.setItem(STORAGE_KEY_TYPING, JSON.stringify(grouped));
        } catch (e) {}

        // 현재 화면에 타자 순위표가 표시 중이면 자동 갱신
        RankingManager.renderAllTypingLeaderboards();
      }, (err) => {
        console.warn('Firestore 타자 랭킹 실시간 수신 경고:', err);
      });
    } catch (e) {
      console.warn('Firestore 타자 리스너 등록 실패:', e);
    }

    // 2-2. 퍼즐 대회 실시간 순위 구독
    try {
      db.collection('dokdo_puzzle_records').onSnapshot((snapshot) => {
        const grouped = getEmptyData();
        snapshot.forEach((doc) => {
          const d = doc.data();
          const course = d.course || '초등학교';
          if (grouped[course]) {
            grouped[course].push({
              id: doc.id,
              course: course,
              grade: d.grade,
              classNum: d.classNum,
              totalSeconds: Number(d.totalSeconds) || 0,
              moveCount: Number(d.moveCount) || 0,
              date: d.date || ''
            });
          }
        });

        for (const c of Object.keys(grouped)) {
          sortPuzzleRecords(grouped[c]);
        }
        memoryPuzzle = grouped;
        try {
          localStorage.setItem(STORAGE_KEY_PUZZLE, JSON.stringify(grouped));
        } catch (e) {}

        // 현재 화면에 퍼즐 순위표가 표시 중이면 자동 갱신
        RankingManager.renderAllPuzzleLeaderboards();
      }, (err) => {
        console.warn('Firestore 퍼즐 랭킹 실시간 수신 경고:', err);
      });
    } catch (e) {
      console.warn('Firestore 퍼즐 리스너 등록 실패:', e);
    }
  }

  // ==========================================
  // 3. 외부 노출 API 객체
  // ==========================================
  const manager = {
    // ------------------------------------
    // 타자 대회 순위 API
    // ------------------------------------
    getTypingRecords(course) {
      return (memoryTyping && memoryTyping[course]) ? memoryTyping[course] : [];
    },

    /**
     * 타자 기록 등록: 각 학년/반별 "최고의 기록" 1개만 유지
     */
    addTypingRecord(record) {
      const course = record.course || '초등학교';
      if (!memoryTyping[course]) memoryTyping[course] = [];

      // 기존 모든 기록의 isCurrentUser 플래그 초기화
      memoryTyping[course].forEach(r => { r.isCurrentUser = false; });

      const grade = record.grade || '1학년';
      const classNum = record.classNum || '1반';
      const newScore = {
        accuracy: Number(record.accuracy) || 100,
        totalSeconds: Number(record.totalSeconds) || 60,
        avgCpm: Number(record.avgCpm) || 200
      };

      const docId = `${course}_${grade}_${classNum}`.replace(/\s+/g, '_');
      const existingIdx = memoryTyping[course].findIndex(r => r.grade === grade && r.classNum === classNum);
      let targetRecordId = docId;
      let isNewBest = false;

      if (existingIdx !== -1) {
        const existingRec = memoryTyping[course][existingIdx];
        if (isTypingBetter(newScore, existingRec)) {
          existingRec.accuracy = newScore.accuracy;
          existingRec.totalSeconds = newScore.totalSeconds;
          existingRec.avgCpm = newScore.avgCpm;
          existingRec.date = new Date().toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
          existingRec.isCurrentUser = true;
          isNewBest = true;
        } else {
          existingRec.isCurrentUser = true;
          isNewBest = false;
        }
        targetRecordId = existingRec.id || docId;
      } else {
        const newRecord = {
          id: docId,
          course: course,
          grade: grade,
          classNum: classNum,
          accuracy: newScore.accuracy,
          totalSeconds: newScore.totalSeconds,
          avgCpm: newScore.avgCpm,
          date: new Date().toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }),
          isCurrentUser: true
        };
        memoryTyping[course].push(newRecord);
        isNewBest = true;
      }

      sortTypingRecords(memoryTyping[course]);

      try {
        localStorage.setItem(STORAGE_KEY_TYPING, JSON.stringify(memoryTyping));
      } catch (e) {}

      // Firestore에 비동기 실시간 업로드 (더 좋은 기록일 때만 갱신)
      if (db) {
        const docRef = db.collection('dokdo_typing_records').doc(docId);
        docRef.get().then((docSnap) => {
          if (!docSnap.exists) {
            docRef.set({
              course,
              grade,
              classNum,
              accuracy: newScore.accuracy,
              totalSeconds: newScore.totalSeconds,
              avgCpm: newScore.avgCpm,
              date: new Date().toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }),
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          } else {
            const currentData = docSnap.data();
            if (isTypingBetter(newScore, currentData)) {
              docRef.set({
                course,
                grade,
                classNum,
                accuracy: newScore.accuracy,
                totalSeconds: newScore.totalSeconds,
                avgCpm: newScore.avgCpm,
                date: new Date().toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
              });
            }
          }
        }).catch((err) => {
          console.warn('Firestore 타자 기록 등록 경고:', err);
        });
      }

      const rankIndex = memoryTyping[course].findIndex(r => r.id === targetRecordId || (r.grade === grade && r.classNum === classNum));
      return {
        rank: rankIndex !== -1 ? rankIndex + 1 : null,
        recordId: targetRecordId,
        isNewBest: isNewBest
      };
    },

    // ------------------------------------
    // 퍼즐 대회 순위 API
    // ------------------------------------
    getPuzzleRecords(course) {
      return (memoryPuzzle && memoryPuzzle[course]) ? memoryPuzzle[course] : [];
    },

    /**
     * 퍼즐 기록 등록: 각 학년/반별 "최고의 기록" 1개만 유지
     */
    addPuzzleRecord(record) {
      const course = record.course || '초등학교';
      if (!memoryPuzzle[course]) memoryPuzzle[course] = [];

      memoryPuzzle[course].forEach(r => { r.isCurrentUser = false; });

      const grade = record.grade || '1학년';
      const classNum = record.classNum || '1반';
      const newScore = {
        totalSeconds: Number(record.totalSeconds) || 60,
        moveCount: Number(record.moveCount) || 30
      };

      const docId = `${course}_${grade}_${classNum}`.replace(/\s+/g, '_');
      const existingIdx = memoryPuzzle[course].findIndex(r => r.grade === grade && r.classNum === classNum);
      let targetRecordId = docId;
      let isNewBest = false;

      if (existingIdx !== -1) {
        const existingRec = memoryPuzzle[course][existingIdx];
        if (isPuzzleBetter(newScore, existingRec)) {
          existingRec.totalSeconds = newScore.totalSeconds;
          existingRec.moveCount = newScore.moveCount;
          existingRec.date = new Date().toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
          existingRec.isCurrentUser = true;
          isNewBest = true;
        } else {
          existingRec.isCurrentUser = true;
          isNewBest = false;
        }
        targetRecordId = existingRec.id || docId;
      } else {
        const newRecord = {
          id: docId,
          course: course,
          grade: grade,
          classNum: classNum,
          totalSeconds: newScore.totalSeconds,
          moveCount: newScore.moveCount,
          date: new Date().toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }),
          isCurrentUser: true
        };
        memoryPuzzle[course].push(newRecord);
        isNewBest = true;
      }

      sortPuzzleRecords(memoryPuzzle[course]);

      try {
        localStorage.setItem(STORAGE_KEY_PUZZLE, JSON.stringify(memoryPuzzle));
      } catch (e) {}

      // Firestore에 비동기 실시간 업로드 (더 좋은 기록일 때만 갱신)
      if (db) {
        const docRef = db.collection('dokdo_puzzle_records').doc(docId);
        docRef.get().then((docSnap) => {
          if (!docSnap.exists) {
            docRef.set({
              course,
              grade,
              classNum,
              totalSeconds: newScore.totalSeconds,
              moveCount: newScore.moveCount,
              date: new Date().toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }),
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          } else {
            const currentData = docSnap.data();
            if (isPuzzleBetter(newScore, currentData)) {
              docRef.set({
                course,
                grade,
                classNum,
                totalSeconds: newScore.totalSeconds,
                moveCount: newScore.moveCount,
                date: new Date().toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
              });
            }
          }
        }).catch((err) => {
          console.warn('Firestore 퍼즐 기록 등록 경고:', err);
        });
      }

      const rankIndex = memoryPuzzle[course].findIndex(r => r.id === targetRecordId || (r.grade === grade && r.classNum === classNum));
      return {
        rank: rankIndex !== -1 ? rankIndex + 1 : null,
        recordId: targetRecordId,
        isNewBest: isNewBest
      };
    },

    // ------------------------------------
    // 초등 | 중학 | 고등 3분할 순위표 일괄 렌더링
    // ------------------------------------
    renderAllTypingLeaderboards(highlightRecordId) {
      const map = {
        '초등학교': document.getElementById('typingTbody_elem'),
        '중학교': document.getElementById('typingTbody_mid'),
        '고등학교': document.getElementById('typingTbody_high')
      };
      for (const [course, tbody] of Object.entries(map)) {
        if (tbody) {
          this.renderTypingTable(tbody, course, highlightRecordId);
        }
      }
    },

    renderAllPuzzleLeaderboards(highlightRecordId) {
      const map = {
        '초등학교': document.getElementById('puzzleTbody_elem'),
        '중학교': document.getElementById('puzzleTbody_mid'),
        '고등학교': document.getElementById('puzzleTbody_high')
      };
      for (const [course, tbody] of Object.entries(map)) {
        if (tbody) {
          this.renderPuzzleTable(tbody, course, highlightRecordId);
        }
      }
    },

    // ------------------------------------
    // HTML 렌더러 (타자 순위표 - 반별 최고 기록만 표시)
    // ------------------------------------
    renderTypingTable(tbodyEl, course, highlightRecordId) {
      if (!tbodyEl) return;
      const records = this.getTypingRecords(course);
      tbodyEl.innerHTML = '';

      if (records.length === 0) {
        tbodyEl.innerHTML = `
          <tr>
            <td colspan="5" class="lb-empty-msg" style="padding: 34px 10px; text-align: center;">
              <div style="font-size: 1.5rem; margin-bottom: 4px;">🌊</div>
              <div style="font-weight: 700; color: #cbd5e1; font-size: 0.85rem;">기록 없음</div>
              <div style="font-size: 0.74rem; color: #38bdf8; margin-top: 2px;">첫 기록에 도전하세요! ✨</div>
            </td>
          </tr>
        `;
        return;
      }

      records.forEach((rec, idx) => {
        const rank = idx + 1;
        const tr = document.createElement('tr');
        const isHighlight = rec.id === highlightRecordId || rec.isCurrentUser;
        if (isHighlight) tr.classList.add('current-user-row');

        // 순위 뱃지 (1~3위 메달)
        let rankBadge = `<span class="rank-badge rank-normal">${rank}</span>`;
        if (rank === 1) rankBadge = `<span class="rank-badge rank-1">🥇 1</span>`;
        else if (rank === 2) rankBadge = `<span class="rank-badge rank-2">🥈 2</span>`;
        else if (rank === 3) rankBadge = `<span class="rank-badge rank-3">🥉 3</span>`;

        tr.innerHTML = `
          <td>${rankBadge}</td>
          <td style="font-weight: 700; text-align: left; padding-left: 8px;">${rec.grade} ${rec.classNum}${isHighlight ? ' ✨' : ''}</td>
          <td><strong style="color: #38bdf8;">${rec.accuracy}%</strong></td>
          <td>${formatSeconds(rec.totalSeconds)}</td>
          <td>${rec.avgCpm}</td>
        `;

        tbodyEl.appendChild(tr);
      });
    },

    // ------------------------------------
    // HTML 렌더러 (퍼즐 순위표 - 반별 최고 기록만 표시)
    // ------------------------------------
    renderPuzzleTable(tbodyEl, course, highlightRecordId) {
      if (!tbodyEl) return;
      const records = this.getPuzzleRecords(course);
      tbodyEl.innerHTML = '';

      if (records.length === 0) {
        tbodyEl.innerHTML = `
          <tr>
            <td colspan="4" class="lb-empty-msg" style="padding: 34px 10px; text-align: center;">
              <div style="font-size: 1.5rem; margin-bottom: 4px;">🧩</div>
              <div style="font-weight: 700; color: #cbd5e1; font-size: 0.85rem;">기록 없음</div>
              <div style="font-size: 0.74rem; color: #38bdf8; margin-top: 2px;">첫 기록에 도전하세요! ✨</div>
            </td>
          </tr>
        `;
        return;
      }

      records.forEach((rec, idx) => {
        const rank = idx + 1;
        const tr = document.createElement('tr');
        const isHighlight = rec.id === highlightRecordId || rec.isCurrentUser;
        if (isHighlight) tr.classList.add('current-user-row');

        let rankBadge = `<span class="rank-badge rank-normal">${rank}</span>`;
        if (rank === 1) rankBadge = `<span class="rank-badge rank-1">🥇 1</span>`;
        else if (rank === 2) rankBadge = `<span class="rank-badge rank-2">🥈 2</span>`;
        else if (rank === 3) rankBadge = `<span class="rank-badge rank-3">🥉 3</span>`;

        tr.innerHTML = `
          <td>${rankBadge}</td>
          <td style="font-weight: 700; text-align: left; padding-left: 8px;">${rec.grade} ${rec.classNum}${isHighlight ? ' ✨' : ''}</td>
          <td><strong style="color: #38bdf8;">${formatSeconds(rec.totalSeconds)}</strong></td>
          <td>${rec.moveCount}회</td>
        `;

        tbodyEl.appendChild(tr);
      });
    }
  };

  return manager;
})();
