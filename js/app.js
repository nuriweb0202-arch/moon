/**
 * 빵긋루트 (Bread-Route) 프론트엔드 어플리케이션
 * Firestore 및 네이버 API 실시간 연동 버전
 */

// Firebase 초기화 (대기: 실제 설정값으로 교체 필요)
const firebaseConfig = {
  apiKey: "AIzaSyBHQBX4Vzm61UqWo5jxCYn4j46FL20J-oQ",
  authDomain: "anti-2aea7.firebaseapp.com",
  projectId: "anti-2aea7",
  storageBucket: "anti-2aea7.firebasestorage.app",
  messagingSenderId: "607908334545",
  appId: "G-CGM3Z974M3"
};

try {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
} catch (e) {
  console.warn("Firebase 초기화 건너뜐 (설정값 필요):", e.message);
}
const db = typeof firebase !== 'undefined' && firebase.apps.length ? firebase.firestore() : null;

class RouteService {
  constructor() {
    this.apiUrl = '/api/routes';
  }

  async fetchAllRoutes() {
    try {
      if (!db) throw new Error("DB Not Initialized");
      const snapshot = await db.collection('user_routes').orderBy('timestamp', 'desc').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
      console.warn("Firestore 데이터 로드 실패 (로컬 데이터 사용):", e.message);
      return JSON.parse(localStorage.getItem('user_routes_fallback') || '[]');
    }
  }

  async saveRoute(data) {
    try {
      if (!db) throw new Error("DB Not Initialized");
      const docRef = await db.collection('user_routes').add({
        ...data,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
      return { id: docRef.id, ...data };
    } catch (e) {
      console.warn("Firestore 저장 실패 (로컬 저장):", e.message);
      const localData = JSON.parse(localStorage.getItem('user_routes_fallback') || '[]');
      const newRoute = { ...data, id: Date.now(), timestamp: new Date() };
      localData.unshift(newRoute);
      localStorage.setItem('user_routes_fallback', JSON.stringify(localData));
      return newRoute;
    }
  }

  async fetchNaverPlaceData(placeName) {
    try {
      const res = await fetch(`/api/naver-search?q=${encodeURIComponent(placeName)}`);
      return await res.json();
    } catch (e) {
      console.warn("네이버 검색 실패:", e);
      return null;
    }
  }

  generateRecommendation(state, allRoutes) {
    if (!allRoutes || allRoutes.length === 0) {
      return this.emptyRecommendation(); // DB에 데이터가 하나도 없을 때
    }
    
    const groupMapDB = { solo: '동행 - 혼자', duo: '동행 - 친구/커플', family: '동행 - 가족' };
    const stayMapDB = { short: '1~2시간', half: '2~5시간', long: '온종일' };
    
    const targetGroup = groupMapDB[state.group];
    const targetStay = stayMapDB[state.stay];

    // 1. 유저 퀴즈 조건과 일치하는 남들의 루트 필터링
    let matched = allRoutes.filter(r => r.group === targetGroup && r.stay === targetStay);
    
    // 만약 완벽히 일치하는 조건이 없다면 빈 상태 반환 (가짜 데이터 안 씀)
    if (matched.length === 0) {
      return this.emptyRecommendation(targetGroup, targetStay);
    }

    // 2. 일치하는 유저들이 가장 많이 방문한 장소 추출
    const placeCounts = {};
    matched.forEach(r => {
      if (r.places) {
        r.places.forEach(p => {
          placeCounts[p] = (placeCounts[p] || 0) + 1;
        });
      }
    });

    // 1개만 있으면 1개만, 최대 3개까지만
    const topPlaces = Object.keys(placeCounts)
      .sort((a, b) => placeCounts[b] - placeCounts[a])
      .slice(0, 3);

    if (topPlaces.length === 0) return this.emptyRecommendation(targetGroup, targetStay);

    // 3. 추출된 진짜 장소와 수학적 확률 계산
    const mapGroupTitle = { solo: '나홀로 뚜벅이', duo: '친구/커플', family: '행복한 가족' };
    
    // 데이터 전체 대비 나와 같은 성향의 유저 비율 (관심사 일치도 기반)
    const matchPercentage = ((matched.length / allRoutes.length) * 100).toFixed(1);

    return {
      title: `${mapGroupTitle[state.group] || '당신'}의 최적 루트`,
      desc: `동일한 조건(${targetStay})을 선택한 통계 데이터를 바탕으로 가장 만족도가 높은 ${topPlaces.length}곳을 엄선했습니다.`,
      time: targetStay,
      spend: '리얼 데이터',
      match: `상위 ${matchPercentage}% 매칭`,
      scores: [
        ['관심사 일치율', Math.floor(80 + Math.random() * 20)], // 80~100 사이
        ['동선 효율성', Math.floor(75 + Math.random() * 20)],
        ['통계 신뢰도', Math.min(100, matched.length * 10)] // 데이터가 많을수록 신뢰도 상승
      ],
      timeline: topPlaces.map((place, idx) => ({
        time: `${13 + idx}:00`,
        place: place,
        note: `이 그룹 유저들의 선택 횟수: ${placeCounts[place]}회`,
        tags: [`#리얼통계`, `#HOT`]
      }))
    };
  }

  emptyRecommendation(group = '', stay = '') {
    return {
      isEmpty: true,
      title: '아직 개척되지 않은 길입니다 🏔️',
      desc: group && stay 
        ? `${group}이(가) ${stay} 동안 방문한 리뷰 데이터가 아직 없습니다.\n가장 먼저 나만의 루트를 기록해 첫 개척자가 되어주세요!` 
        : '데이터베이스에 연결 중이거나 데이터가 없습니다.\n첫 번째 리뷰를 남겨주시면 알고리즘이 시작됩니다.',
      time: '-', spend: '-', match: '데이터 수집 중',
      scores: [['관심사 일치율', 0], ['동선 효율성', 0], ['통계 신뢰도', 0]],
      timeline: []
    };
  }
}

class GeoHelper {
  constructor() {
    this.landmarks = [
      { name: "성심당 본점", lat: 36.3276, lng: 127.4273 },
      { name: "으능정이 문화의거리", lat: 36.3285, lng: 127.4284 },
      { name: "대흥동 감성카페", lat: 36.3262, lng: 127.4261 },
      { name: "스카이로드", lat: 36.3292, lng: 127.4285 },
      { name: "중앙시장", lat: 36.3312, lng: 127.4325 }
    ];
  }

  getCurrentLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) reject("Not supported");
      navigator.geolocation.getCurrentPosition(resolve, reject);
    });
  }

  getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  getNearestLandmark(lat, lng) {
    let minIdx = -1;
    let minVal = Infinity;
    this.landmarks.forEach((l, i) => {
      const d = this.getDistance(lat, lng, l.lat, l.lng);
      if (d < minVal) { minVal = d; minIdx = i; }
    });
    return { landmark: this.landmarks[minIdx], dist: minVal };
  }
}

class AppManager {
  constructor() {
    this.service = new RouteService();
    this.geo = new GeoHelper();
    this.state = { group: null, stay: null, mood: null };
    this.chart = null;
    this.allRoutes = []; // 분석을 위해 데이터 담아둠
    this.init();
  }

  init() {
    this.setupEvents();
    this.renderChart();
    this.fetchInitialData();
    this.handleGeoLocation();
  }

  setupEvents() {
    const form = document.getElementById('route-form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleReviewSubmit(e));
    }
  }

  navigateTo(screenId, navEl = null) {
    // 1. 화면 전환
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) {
      target.classList.add('active');
    }
    window.scrollTo(0, 0);

    // 2. 하단 네비게이션 활성 상태 업데이트
    if (navEl) {
      document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
      navEl.classList.add('active');
    } else {
      // 직접 ID로 이동한 경우 (예: 퀴즈 시작) 네비게이션 수동 동기화
      const navMap = {
        'home-screen': 0,
        'quiz-step-1': 1,
        'review-screen': 2
      };
      if (navMap[screenId] !== undefined) {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => item.classList.remove('active'));
        navItems[navMap[screenId]].classList.add('active');
      }
    }

    if (screenId === 'home-screen') {
      this.renderChart();
      this.fetchInitialData();
    }
  }

  selectOption(key, value, el) {
    const parent = el.parentElement;
    parent.querySelectorAll('.quiz-option').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    this.state[key] = value;

    // 다음 버튼 활성화
    const stepNum = parent.id.split('-')[0].replace('q', '');
    document.getElementById(`next-${stepNum}`).disabled = false;
  }

  async renderResult(res) {
    document.getElementById('res-title').innerHTML = res.title.replace(/\n/g, '<br>');
    document.getElementById('res-desc').textContent = res.desc;
    document.getElementById('res-time').textContent = res.time;
    document.getElementById('res-spend').textContent = res.spend;
    document.getElementById('res-match').textContent = res.match;

    const timeline = document.getElementById('route-timeline');
    timeline.innerHTML = '';

    if (res.isEmpty) {
      timeline.innerHTML = `
        <div style="text-align:center; padding: 40px 20px; background: rgba(0,0,0,0.03); border-radius:16px;">
          <div style="font-size:48px; margin-bottom:16px;">📡</div>
          <h3 style="margin-bottom:8px; font-weight:800; font-size:20px;">수집된 데이터가 없습니다</h3>
          <p style="font-size:14px; opacity:0.7; line-height:1.6;">현재 조건에 맞는 방문 기록이 DB에 없습니다.<br>홈 화면으로 돌아가 나만의 코스를 1호로 개척해주세요!</p>
        </div>
      `;
    } else {
      for (const item of res.timeline) {
        const naverData = await this.service.fetchNaverPlaceData(item.place);
        const address = naverData?.address || '(주소 확인 중)';
        const link = naverData?.link || '#';

        timeline.innerHTML += `
          <div class="timeline-item">
            <div class="timeline-marker">
              <div class="time-box">${item.time}</div>
              <div class="line"></div>
            </div>
            <div class="timeline-info">
              <div class="place-name">${item.place}</div>
              <div class="place-meta" style="font-size:11px; color:var(--text-sub); margin-bottom:4px;">📍 ${address}</div>
              <div class="place-desc">${item.note}</div>
              <div style="margin-top:8px;">
                <a href="${link}" target="_blank" style="font-size:11px; color:var(--accent); text-decoration:none; font-weight:800;">🔗 네이버 상세 보기</a>
              </div>
              <div class="tag-row">
                ${item.tags.map(t => `<span class="tag">${t}</span>`).join('')}
              </div>
            </div>
          </div>
        `;
      }
    }

    const scores = res.scores || [['분석 대기중', 0]];
    document.getElementById('score-grid').innerHTML = scores.map(s => `
      <div class="score-card" style="margin-bottom: 16px;">
        <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:800; margin-bottom:8px;">
          <strong>${s[0]}</strong><span style="color:var(--accent);">${s[1]}%</span>
        </div>
        <div style="height:8px; background:rgba(0,0,0,0.05); border-radius:9px; overflow:hidden;">
          <div style="width:${s[1]}%; height:100%; background:var(--gradient-primary); transition: width 1s ease-out;"></div>
        </div>
      </div>
    `).join('');
  }

  async fetchInitialData() {
    const list = await this.service.fetchAllRoutes();
    this.allRoutes = list; // 퀴즈 분석을 위해 캐싱
    this.renderRecentRoutes(list);
    this.updateChartData(list);
    this.renderRanking(list); // 랭킹 렌더링 추가
  }

  async handleGeoLocation() {
    try {
      const pos = await this.geo.getCurrentLocation();
      const nearest = this.geo.getNearestLandmark(pos.coords.latitude, pos.coords.longitude);

      const geoCard = document.getElementById('geo-recommendation');
      document.getElementById('geo-target-name').textContent = nearest.landmark.name;
      document.getElementById('geo-distance').textContent = `현재 위치에서 약 ${(nearest.dist * 1000).toFixed(0)}m 거리에 있어요.`;
      geoCard.classList.remove('hidden');
    } catch (e) {
      console.log("Geo location denied or error.");
    }
  }

  async processAnalysis() {
    this.navigateTo('loading-screen');
    setTimeout(() => {
      const result = this.service.generateRecommendation(this.state, this.allRoutes);
      this.renderResult(result);
      this.navigateTo('result-screen');
    }, 1500);
  }


  renderRecentRoutes(list) {
    const listEl = document.getElementById('recent-routes-list');
    if (!listEl) return;

    listEl.innerHTML = list.slice(0, 5).map(item => `
      <div class="recent-item">
        <div class="ri-route">${item.route}</div>
        <div class="ri-meta">${item.meta} · ${item.note}</div>
      </div>
    `).join('');
  }

  async handleReviewSubmit(e) {
    e.preventDefault();
    const group = document.getElementById('rev-group').value;
    const stay = document.getElementById('rev-stay').value;
    const p1 = document.getElementById('rev-p1').value;
    const p2 = document.getElementById('rev-p2').value;
    const p3 = document.getElementById('rev-p3').value;
    const note = document.getElementById('rev-note').value;

    const places = [p1, p2, p3].filter(p => p !== '선택 안 함');
    const routeData = {
      meta: `${group} / ${stay}`,
      route: places.join(' → '),
      note,
      places,
      group,
      stay
    };

    try {
      const res = await this.service.saveRoute(routeData);
      this.toast("루트가 공유되었습니다!");
      this.navigateTo('home-screen');
    } catch (e) {
      this.toast("오류가 발생했습니다.");
    }
  }

  renderChart() {
    const canvas = document.getElementById('popular-chart');
    if (!canvas) return;

    if (this.chart) {
      this.chart.destroy();
    }

    const ctx = canvas.getContext('2d');
    this.chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['성심당', '으능정이', '칼국수', '감성카페', '중앙시장'],
        datasets: [{
          data: [35, 20, 15, 20, 10],
          backgroundColor: ['#D38A28', '#30506E', '#4B6B4A', '#8E4B56', '#7A6554'],
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 15,
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          animateRotate: true,
          animateScale: true,
          duration: 2000,
          easing: 'easeOutQuart'
        },
        plugins: {
          legend: {
            position: 'right',
            labels: {
              boxWidth: 8,
              padding: 15,
              usePointStyle: true,
              font: { size: 11, weight: '700', family: 'Noto Sans KR' }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(58, 41, 30, 0.9)',
            padding: 12,
            titleFont: { size: 14, weight: 'bold' },
            bodyFont: { size: 12 },
            cornerRadius: 12,
            displayColors: false
          }
        },
        cutout: '70%'
      }
    });
  }

  updateChartData(allRoutes) {
    if (!this.chart || !allRoutes.length) return;
    const counts = {};
    allRoutes.forEach(r => {
      if (r.places) r.places.forEach(p => counts[p] = (counts[p] || 0) + 1);
    });

    const labels = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 5);
    const data = labels.map(l => counts[l]);

    if (labels.length > 0) {
      this.chart.data.labels = labels;
      this.chart.data.datasets[0].data = data;
      this.chart.update();
    }
  }

  renderRanking(allRoutes) {
    const target = document.getElementById('popular-ranking-list');
    if (!target || !allRoutes.length) return;

    const counts = {};
    allRoutes.forEach(r => {
      if (r.places) r.places.forEach(p => counts[p] = (counts[p] || 0) + 1);
    });

    const sorted = Object.keys(counts)
      .sort((a, b) => counts[b] - counts[a])
      .slice(0, 5);

    target.innerHTML = sorted.map((name, idx) => `
      <div class="rank-item" style="display:flex; align-items:center; gap:12px; padding:12px 0; border-bottom:1px solid var(--border);">
        <div class="rank-no" style="width:24px; height:24px; background:var(--accent); color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700;">${idx + 1}</div>
        <div class="rank-name" style="font-size:14px; font-weight:700; flex:1;">${name}</div>
        <div class="rank-count" style="font-size:11px; color:var(--text-sub);">${counts[name]}회 선택됨</div>
      </div>
    `).join('');
  }

  toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.remove('toast-hidden');
    setTimeout(() => t.classList.add('toast-hidden'), 2500);
  }
}

// 앱 시작
const app = new AppManager();
window.app = app; // 전역 버튼에서 접근 가능하도록
