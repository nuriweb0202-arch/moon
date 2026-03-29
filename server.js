const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(cors());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

// 정적 파일 제공 (public 폴더 내의 index.html, css, js 등)
app.use(express.static(path.join(__dirname, 'public')));

// 네이버 API 설정 (작업 필요: 환경변수 또는 직접 입력)
const NAVER_CLIENT_ID = 'YOUR_NAVER_CLIENT_ID';
const NAVER_CLIENT_SECRET = 'YOUR_NAVER_CLIENT_SECRET';

/**
 * [Proxy API] 네이버 지역 검색
 * 프론트엔드에서 직접 호출 시 발생하는 CORS 문제를 해결하고 API Key 유출을 방지합니다.
 */
app.get('/api/naver-search', (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'Query is required' });

  const https = require('https');
  const options = {
    hostname: 'openapi.naver.com',
    path: `/v1/search/local.json?query=${encodeURIComponent(query)}&display=1`,
    headers: {
      'X-Naver-Client-Id': '9LG547ESL4qnI9JLVuzH',
      'X-Naver-Client-Secret': 'KIRR2LjX2V'
    }
  };

  https.get(options, (apiRes) => {
    let data = '';
    apiRes.on('data', (chunk) => data += chunk);
    apiRes.on('end', () => {
      try {
        const result = JSON.parse(data);
        res.json(result.items[0] || {});
      } catch (e) {
        res.status(500).json({ error: 'Search failed' });
      }
    });
  }).on('error', (err) => {
    res.status(500).json({ error: err.message });
  });
});

/**
 * [Proxy API] 네이버 지역 검색 - 자동완성 다중 결과 반환 (최대 5개)
 * 루트 기록 폼의 장소 검색 자동완성 기능에 사용됩니다.
 */
app.get('/api/naver-search-list', (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'Query is required' });

  const https = require('https');
  const options = {
    hostname: 'openapi.naver.com',
    path: `/v1/search/local.json?query=${encodeURIComponent(query + ' 대전')}&display=5`,
    headers: {
      'X-Naver-Client-Id': '9LG547ESL4qnI9JLVuzH',
      'X-Naver-Client-Secret': 'KIRR2LjX2V'
    }
  };

  https.get(options, (apiRes) => {
    let data = '';
    apiRes.on('data', (chunk) => data += chunk);
    apiRes.on('end', () => {
      try {
        const result = JSON.parse(data);
        const items = (result.items || []).map(item => ({
          title: item.title.replace(/<[^>]*>/g, ''),
          address: item.roadAddress || item.address || '',
          category: item.category || '',
          mapx: item.mapx,
          mapy: item.mapy
        }));
        res.json(items);
      } catch (e) {
        res.status(500).json({ error: 'Search failed' });
      }
    });
  }).on('error', (err) => {
    res.status(500).json({ error: err.message });
  });
});

/**
 * [Proxy API] 네이버 블로그 검색 (크롤링 파이프라인 용)
 * 최대 50개의 블로그 포스트를 불러와 빵긋루트 데이터 조립용으로 활용합니다.
 */
app.get('/api/naver-blog-search', (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'Query is required' });

  const display = req.query.display || 100;
  const https = require('https');
  const options = {
    hostname: 'openapi.naver.com',
    path: `/v1/search/blog.json?query=${encodeURIComponent(query)}&display=${display}&sort=sim`,
    headers: {
      'X-Naver-Client-Id': '9LG547ESL4qnI9JLVuzH',
      'X-Naver-Client-Secret': 'KIRR2LjX2V'
    }
  };

  https.get(options, (apiRes) => {
    let data = '';
    apiRes.on('data', (chunk) => data += chunk);
    apiRes.on('end', () => {
      console.log(`[Naver Blog Search] Status: ${apiRes.statusCode}`);
      if (apiRes.statusCode !== 200) {
        console.error(`[Naver Blog Search] Error Data: ${data}`);
        return res.status(apiRes.statusCode).json({ error: `Naver API Error: ${apiRes.statusCode}`, details: data });
      }
      try {
        const result = JSON.parse(data);
        res.json(result.items || []);
      } catch (e) {
        res.status(500).json({ error: 'Blog search extraction failed: ' + e.message });
      }
    });
  }).on('error', (err) => {
    console.error(`[Naver Blog Search] Request Error: ${err.message}`);
    res.status(500).json({ error: err.message });
  });
});

// 기존 인메모리 API는 Firestore로 대체될 것이므로 로그만 남깁니다.
app.get('/api/routes', (req, res) => {
  res.json([]); // 프론트엔드에서 Firestore로 직접 통신하도록 유도
});

app.post('/api/routes', (req, res) => {
  res.status(200).json({ message: 'Please use direct Firestore integration on client side.' });
});

// 모든 경로를 index.html로 리다이렉트 (SPA 지원 용도)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('==================================================');
  console.log('🚀 빵긋루트 프리미엄 백엔드 서버 가동!');
  console.log(`📡 서버 주소: http://localhost:${PORT}`);
  console.log('==================================================');
});
