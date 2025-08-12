const axios = require('axios');

const OPENAI_MODEL = 'gpt-4o-search-preview';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { formData, coordinates } = req.body || {};
    if (!formData || !coordinates) {
      return res.status(400).json({ error: 'formData와 coordinates가 필요합니다.' });
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return res.status(500).json({ error: 'OpenAI API 키가 설정되지 않았습니다.' });
    }

    // 1) OpenAI 요청
    const prompt = generatePrompt(formData, coordinates);
    let courseData;
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: OPENAI_MODEL,
          web_search_options: {},
          messages: [
            { role: 'system', content: '당신은 러닝 코스 생성 전문가입니다. 사용자의 요청에 따라 검색하여 올바른 근거를 바탕으로 답변해야 합니다.' },
            { role: 'user', content: prompt }
          ],
          response_format: { type: 'text' },
          max_tokens: 1500,
        },
        { headers: { Authorization: `Bearer ${openaiApiKey}` } }
      );
      const gptResponse = response.data?.choices?.[0]?.message?.content || '';
      courseData = parseGptResponse(gptResponse, formData, coordinates);
    } catch (e) {
      // OpenAI 실패 시 더미 생성
      courseData = makeFallbackCourse(formData, coordinates);
    }

    // 2) 카카오 경로 찾기 (가능할 때만)
    const kakaoApiKey = process.env.KAKAO_REST_API_KEY;
    try {
      if (kakaoApiKey && courseData?.course?.waypoints?.length >= 2) {
        const origin = `${courseData.course.waypoints[0].location.longitude},${courseData.course.waypoints[0].location.latitude}`;
        const last = courseData.course.waypoints[courseData.course.waypoints.length - 1];
        const destination = `${last.location.longitude},${last.location.latitude}`;

        const params = { origin, destination, priority: 'RECOMMEND' };
        const kakaoResponse = await axios.get('https://apis-navi.kakaomobility.com/v1/directions', {
         params,
                headers: { 
                Authorization: `KakaoAK ${kakaoApiKey}`,
                os: 'web',
                origin: 'https://course-onspectrum.vercel.app/'
                }
        });
        const route = kakaoResponse.data?.routes?.[0];
        if (route && route.sections) {
          const linePath = [];
          route.sections.forEach(section => {
            section.roads.forEach(road => {
              for (let i = 0; i < road.vertexes.length; i += 2) {
                linePath.push({ lat: road.vertexes[i + 1], lng: road.vertexes[i] });
              }
            });
          });
          courseData.course.path = linePath;
        }
      }
    } catch (_) {
      // 경로 조회 실패 시 기존 path 유지
    }

    // 필드 정규화 및 보정
    const src = courseData.course || {};
    const toNumber = (v, fallback = 0) => {
      const n = typeof v === 'number' ? v : parseFloat(String(v || '').replace(/[^0-9.+-]/g, ''));
      return isNaN(n) ? fallback : n;
    };

    const total_distance_km = src.total_distance_km !== undefined
      ? toNumber(src.total_distance_km, toNumber(formData.distance, 0))
      : toNumber(formData.distance, 0);

    const expected_duration_minutes = src.expected_duration_minutes !== undefined
      ? toNumber(src.expected_duration_minutes, src.estimated_time_minutes !== undefined ? toNumber(src.estimated_time_minutes, 0) : 0)
      : (src.estimated_time_minutes !== undefined ? toNumber(src.estimated_time_minutes, 0)
         : (formData.difficulty === 'walking' ? Math.round(toNumber(formData.distance, 0) * 15)
            : Math.round(toNumber(formData.distance, 0) * 6)));

    const elevation_change_meters = src.elevation_change_meters !== undefined
      ? toNumber(src.elevation_change_meters, src.elevation_change_m !== undefined ? toNumber(src.elevation_change_m, 0) : 0)
      : (src.elevation_change_m !== undefined ? toNumber(src.elevation_change_m, 0) : Math.round(toNumber(formData.distance, 0) * 8));

    const difficultyKorean = src.difficulty || difficultyToKorean(formData.difficulty);
    const emotional_recommendation = src.emotional_recommendation || src.emotion || '';

    // waypoints 정규화
    const normalizedWaypoints = (Array.isArray(src.waypoints) ? src.waypoints : []).map(wp => ({
      name: wp?.name || '',
      location: {
        latitude: toNumber(wp?.location?.latitude, 0),
        longitude: toNumber(wp?.location?.longitude, 0),
      },
    }));

    const formatted = {
      course: {
        description: src.description || '',
        waypoints: normalizedWaypoints,
        running_tips: Array.isArray(src.running_tips) ? src.running_tips : [],
        total_distance_km,
        expected_duration_minutes,
        elevation_change_meters,
        emotional_recommendation,
        difficulty: difficultyKorean,
        path: Array.isArray(src.path) ? src.path : [],
      },
    };

    return res.json(formatted);
  } catch (error) {
    const status = error?.response?.status;
    const message = error?.response?.data?.error?.message || error?.message;
    return res.status(500).json({ error: '코스 생성 중 오류가 발생했습니다.', detail: message, status });
  }
};

function generatePrompt(formData, coordinates) {
  const { location, distance, difficulty, time, additionalInfo, emotion } = formData;
  const preferences = Array.isArray(formData.preferences) ? formData.preferences : [];

  let emotionText = '';
  let emotionAdvice = '';
  const emotionValue = parseInt(emotion || 50, 10);
  if (emotionValue < 33) { emotionText = '슬픔/우울'; emotionAdvice = '조용하고 평화로운 코스를 추천해주세요.'; }
  else if (emotionValue < 66) { emotionText = '보통/평온'; emotionAdvice = '균형잡힌 코스를 추천해주세요.'; }
  else { emotionText = '기쁨/행복'; emotionAdvice = '도전적이고 다양한 경관의 코스를 추천해주세요.'; }

  const preferencesText = preferences.map(pref => ({ park: '공원', river: '강/하천', trail: '트레일', urban: '도심' }[pref] || pref)).join(', ');
  const difficultyText = { walking: '산책', easy: '쉬움 (평지 위주)', medium: '보통', hard: '어려움 (언덕 포함)' }[difficulty] || '보통';
  const timeText = { morning: '아침', afternoon: '오후', evening: '저녁', night: '밤' }[time] || '오후';

  return `다음 조건에 맞는 러닝 코스를 생성해주세요:

위치: ${location} (좌표: 위도 ${coordinates.lat}, 경도 ${coordinates.lng})
거리: ${distance}km
난이도: ${difficultyText}
선호 환경: ${preferencesText || '없음'}
러닝 시간대: ${timeText}
현재 감정 상태: ${emotionText} (${emotionValue}/100)
추가 요청사항: ${additionalInfo || '없음'}

JSON 형식으로만 응답하세요. 스키마:
{"course": {"description":"","waypoints":[{"name":"","location":{"latitude":0,"longitude":0}}],"running_tips":[],"total_distance_km":0,"expected_duration_minutes":0,"elevation_change_meters":0,"emotional_recommendation":"","difficulty":""}}
`; }

function parseGptResponse(text, formData, coordinates) {
  try {
    const jsonMatch = text && text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (_) {}
  return makeFallbackCourse(formData, coordinates);
}

function makeFallbackCourse(formData, coordinates) {
  const distanceNum = parseFloat(formData.distance);
  const expectedMinutes = formData.difficulty === 'walking' ? Math.round(distanceNum * 15) : Math.round(distanceNum * 6);
  const path = generateDummyPath(coordinates, distanceNum);
  const start = path[0];
  const end = path[path.length - 1];
  return {
    course: {
      description: `이 코스는 ${formData.location} 주변의 ${distanceNum}km 코스로, ${difficultyToKorean(formData.difficulty)} 난이도의 지형을 포함하고 있습니다.`,
      waypoints: [
        { name: formData.location || '출발지', location: { latitude: start.lat || start.getLat?.(), longitude: start.lng || start.getLng?.() } },
        { name: formData.location || '도착지', location: { latitude: end.lat || end.getLat?.(), longitude: end.lng || end.getLng?.() } },
      ],
      running_tips: [ timeBasedTip(formData.time), `${distanceNum}km 거리이므로 약 ${Math.round(distanceNum * 0.1)}L의 물을 준비하세요.`, difficultyBasedTip(formData.difficulty) ],
      total_distance_km: distanceNum,
      expected_duration_minutes: expectedMinutes,
      elevation_change_meters: Math.round(distanceNum * 8),
      emotional_recommendation: '',
      difficulty: difficultyToKorean(formData.difficulty),
      path: path.map(p => ({ lat: p.lat || p.getLat?.(), lng: p.lng || p.getLng?.() })),
    },
  };
}

function difficultyToKorean(difficulty) {
  return ({ walking: '산책', easy: '쉬움', medium: '보통', hard: '어려움' }[difficulty]) || '보통';
}
function timeBasedTip(time) {
  const tips = { morning: '아침 러닝은 체온이 낮으므로 충분한 준비운동을 하세요.', afternoon: '오후에는 자외선이 강하니 자외선 차단제와 모자를 준비하세요.', evening: '저녁 시간에는 기온이 떨어지므로 얇은 겉옷을 준비하세요.', night: '야간 러닝 시에는 반사 소재의 의류나 LED 라이트를 착용하세요.' };
  return tips[time] || tips['afternoon'];
}
function difficultyBasedTip(difficulty) {
  const tips = { walking: '산책은 편안한 신발과 여유로운 마음으로 즐기세요.', easy: '쉬운 코스는 초보자에게 적합합니다. 충분한 수분 섭취를 잊지 마세요.', medium: '보통 난이도는 체력에 맞게 페이스를 조절하세요.', hard: '어려운 코스는 충분한 준비운동과 휴식이 필요합니다.' };
  return tips[difficulty] || '체력에 맞는 페이스로 러닝하세요.';
}
function generateDummyPath(center, distance) {
  const path = [];
  const numPoints = Math.max(10, Math.round(distance * 2));
  const radius = distance * 100;
  const startPoint = { lat: parseFloat(center.lat), lng: parseFloat(center.lng) };
  path.push(startPoint);
  for (let i = 1; i < numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI;
    const dx = radius * Math.cos(angle) / 10000;
    const dy = radius * Math.sin(angle) / 10000;
    const jitter = 0.0002 * (Math.random() - 0.5);
    path.push({ lat: parseFloat(center.lat) + dy + jitter, lng: parseFloat(center.lng) + dx + jitter });
  }
  path.push(startPoint);
  return path;
}


