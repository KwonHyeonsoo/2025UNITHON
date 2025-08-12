// 전역 변수 선언
let map;
let markers = [];
let polyline = null;
let kakaoApiKey = process.env.NEXT_PUBLIC_KAKAO_API_KEY
// OpenAI 키는 프론트엔드에서 보관/전송하지 않습니다. 서버의 환경변수를 사용합니다.
// OpenAI 키는 프론트엔드에서 사용하지 않으므로 별도 저장/전송 로직이 없습니다.

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', function() {
    initEventListeners();
    updateDistanceValue();
    updateDistanceValueInline(); // 인라인 거리 슬라이더 초기화 추가
    updateEmotionValue(); // 감정 슬라이더 초기화 추가
    setupSheets();
    if (kakaoApiKey) {
        loadKakaoMapAPI(kakaoApiKey);
    }
    // 날씨 정보 초기화
    initWeather();
    // 최근 코스 즉시 렌더 (인라인)
    refreshInlineHistory();
});

// 과거의 API 키 입력 모달/저장 로직은 제거되었습니다.

// 카카오맵 API 동적 로드 함수
function loadKakaoMapAPI(apiKey) {
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&libraries=services,clusterer,drawing&autoload=false`;
    script.onload = function() {
        // API 로드 완료 후 초기화
        kakao.maps.load(function() {
            initMap();
        });
    };
    script.onerror = function() {
        alert('카카오맵 API 로드에 실패했습니다. API 키를 확인해주세요.');
        localStorage.removeItem('kakaoApiKey');
        // 모달은 제거되었으므로 호출하지 않습니다.
        // 존재하지 않는 모달을 열려고 하면 bootstrap modal.js에서 backdrop 관련 오류가 발생합니다.
    };
    document.head.appendChild(script);
}

// 카카오맵 초기화 함수
function initMap() {
    try {
        // 기본 중심 좌표 (서울시청)
        const defaultPosition = new kakao.maps.LatLng(37.566826, 126.9786567);
        
        // 지도 생성
        const mapContainer = document.getElementById('map');
        const mapOption = {
            center: defaultPosition,
            level: 5 // 확대 레벨
        };
        
        map = new kakao.maps.Map(mapContainer, mapOption);
        
        // 지도 컨트롤 추가
        addMapControls();
    } catch (error) {
        console.error('카카오맵 초기화 중 오류 발생:', error);
    }
}

// 지도 컨트롤 추가 함수
function addMapControls() {
    // 줌 컨트롤 추가
    const zoomControl = new kakao.maps.ZoomControl();
    map.addControl(zoomControl, kakao.maps.ControlPosition.RIGHT);
    
    // 타입 컨트롤 추가
    const mapTypeControl = new kakao.maps.MapTypeControl();
    map.addControl(mapTypeControl, kakao.maps.ControlPosition.TOPRIGHT);
}

// 이벤트 리스너 초기화 함수
function initEventListeners() {
    // 설정 시트 내 폼 제출
    document.getElementById('running-form').addEventListener('submit', function(e) {
        e.preventDefault();
        closeSettings();
        generateRunningCourse();
    });
    
    // 인라인 설정 폼 제출 (RoutePanel 버튼 로딩 상태 적용)
    document.getElementById('running-form-inline').addEventListener('submit', function(e) {
        e.preventDefault();
        const submitBtn = e.target.querySelector('.route-panel-submit-btn');
        if (submitBtn) {
            submitBtn.disabled = true;
            const prevHtml = submitBtn.innerHTML;
            submitBtn.dataset.prevHtml = prevHtml;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> 코스 생성 중...';
        }
        Promise.resolve()
          .then(()=> generateRunningCourse())
          .catch(()=>{})
          .finally(()=>{
            setTimeout(()=>{
              if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = submitBtn.dataset.prevHtml || '<i class="fa-solid fa-location-arrow me-1"></i> 러닝 코스 찾기';
              }
            }, 500);
          });
    });
    
    // 현재 위치 버튼 클릭 이벤트
    document.getElementById('current-location').addEventListener('click', getCurrentLocation);
    document.getElementById('current-location-inline').addEventListener('click', getCurrentLocation);
    
    // 날씨 버튼 클릭 이벤트 (버튼 삭제 대응)
    const weatherBtn = document.getElementById('weather-btn');
    if (weatherBtn) weatherBtn.addEventListener('click', function() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function(position) {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                getWeatherData(lat, lon);
            }, function(error) {
                console.error('위치 정보를 가져올 수 없습니다:', error);
            });
        }
    });

    // 날씨 카드 자체 클릭 시 갱신 (버튼 삭제 대체 UX)
    const weatherView = document.getElementById('weather-view');
    if (weatherView) weatherView.addEventListener('click', function(){
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function(position) {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                getWeatherData(lat, lon);
            }, function(error) {
                console.error('위치 정보를 가져올 수 없습니다:', error);
            });
        }
    });
    
    // 기온 버튼 클릭 이벤트 (버튼 삭제 대응)
    const temperatureBtn = document.getElementById('temperature-btn');
    if (temperatureBtn) temperatureBtn.addEventListener('click', function() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function(position) {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                getWeatherData(lat, lon);
            }, function(error) {
                console.error('위치 정보를 가져올 수 없습니다:', error);
            });
        }
    });
    
    // 거리 슬라이더 변경 이벤트
    document.getElementById('distance').addEventListener('input', updateDistanceValue);
    document.getElementById('distance-inline').addEventListener('input', updateDistanceValueInline);
    
    // 감정 슬라이더 변경 이벤트 (RoutePanel 내 form-range 대응)
    const emo = document.getElementById('emotion-slider');
    if (emo) emo.addEventListener('input', updateEmotionValue);
    
    // 기록 버튼 클릭 이벤트 (버튼 삭제 대응)
    const historyInlineBtn = document.getElementById('history-inline-btn');
    if (historyInlineBtn) historyInlineBtn.addEventListener('click', function() {
        openHistorySheet();
    });
    
    // 새 코스/저장/공유 버튼은 코스 시트가 열릴 때만 존재. 위임 핸들러 사용
    document.body.addEventListener('click', function(e){
        if (e.target.closest('#new-course')) resetForm();
        if (e.target.closest('#save-course')) saveCourse();
        if (e.target.closest('#share-course')) shareCourse();
    });

    // 상단/패널 트리거 (버튼 삭제 대응)
    const openSettingsBtn = document.getElementById('open-settings');
    if (openSettingsBtn) openSettingsBtn.addEventListener('click', openSettings);
    document.getElementById('close-settings').addEventListener('click', closeSettings);
    // 플로팅 버튼들
    const fabActivity = document.getElementById('fab-activity');
    const fabWorkout = document.getElementById('fab-workout');
    if (fabActivity) fabActivity.addEventListener('click', openSettings);
    if (fabWorkout) fabWorkout.addEventListener('click', openSettings);
    // 기록 버튼/시트
    const historyBtn = document.getElementById('history-button');
    if (historyBtn) historyBtn.addEventListener('click', openHistorySheet);
    const openHistorySheetBtn = document.getElementById('open-history-sheet');
    if (openHistorySheetBtn) openHistorySheetBtn.addEventListener('click', openHistorySheet);
    const closeCourseBtn = document.getElementById('close-course');
    if (closeCourseBtn) closeCourseBtn.addEventListener('click', closeCourseSheet);
    const closeHistory = document.getElementById('close-history');
    if (closeHistory) closeHistory.addEventListener('click', closeHistorySheet);
    // 내 위치 찾기
    const locate = document.getElementById('locate-me');
    if (locate) locate.addEventListener('click', getCurrentLocation);

    // 기록 리스트 액션 위임
    const historyList = document.getElementById('history-list');
    if (historyList) {
        historyList.addEventListener('click', function(e){
            const btn = e.target.closest('button[data-action]');
            if (!btn) return;
            const action = btn.getAttribute('data-action');
            const index = parseInt(btn.getAttribute('data-index'), 10);
            if (Number.isNaN(index)) return;
            if (action === 'load') {
                loadCourseFromHistory(index);
            } else if (action === 'delete') {
                deleteCourseFromHistory(index);
            }
        });
    }

    // 최근 러닝 코스 패널(인라인) 리스트 액션 위임
    const inlineHistoryListEl = document.getElementById('history-inline-list');
    if (inlineHistoryListEl) {
        inlineHistoryListEl.addEventListener('click', function(e){
            const btn = e.target.closest('button[data-action]');
            if (!btn) return;
            const action = btn.getAttribute('data-action');
            const index = parseInt(btn.getAttribute('data-index'), 10);
            if (Number.isNaN(index)) return;
            if (action === 'load') {
                loadCourseFromHistory(index);
            } else if (action === 'delete') {
                deleteCourseFromHistory(index);
            }
        });
    }
}

// 거리 슬라이더 값 업데이트 함수
function updateDistanceValue() {
    const distanceSlider = document.getElementById('distance');
    const distanceValue = document.getElementById('distance-value');
    distanceValue.textContent = `${distanceSlider.value}km`;
}

// 감정 슬라이더 값 업데이트 함수
function updateEmotionValue() {
    const emotionSlider = document.getElementById('emotion-slider');
    const emotionText = document.getElementById('emotion-text');
    
    const value = parseInt(emotionSlider.value);
    const percentage = value;
    // 감정 텍스트와 클래스 업데이트
    let emotionLabel = '';
    let emotionClass = '';
    
    if (value < 33) {
        emotionLabel = '슬픔';
        emotionClass = 'sad';
    } else if (value < 66) {
        emotionLabel = '보통';
        emotionClass = 'neutral';
    } else {
        emotionLabel = '기쁨';
        emotionClass = 'happy';
    }
    
    emotionText.textContent = emotionLabel;
    
    // 상단 컨테이너 클래스는 미사용 상태이므로 skip
}

// 현재 위치 가져오기 함수
function getCurrentLocation() {
    // GPS 버튼 클릭 시 기존 폴리라인 제거
    if (polyline) {
        try { polyline.setMap(null); } catch (_) {}
        polyline = null;
    }
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                
                // 좌표를 주소로 변환
                const geocoder = new kakao.maps.services.Geocoder();
                geocoder.coord2Address(lng, lat, function(result, status) {
                    if (status === kakao.maps.services.Status.OK) {
                        const address = result[0].address.address_name;
                        // 두개의 입력 필드에 모두 값을 설정
                        document.getElementById('location').value = address;
                        document.getElementById('location-inline').value = address;
                        
                        // 지도 중심 이동
                        const currentPosition = new kakao.maps.LatLng(lat, lng);
                        map.setCenter(currentPosition);
                        
                        // 현재 위치 마커 표시
                        addMarker(currentPosition, '현재 위치');
                    }
                });
            },
            function(error) {
                console.error('위치 정보를 가져오는데 실패했습니다:', error);
                alert('위치 정보를 가져오는데 실패했습니다. 위치 액세스 권한을 확인해주세요.');
            }
        );
    } else {
        alert('이 브라우저에서는 위치 정보를 지원하지 않습니다.');
    }
}

// 마커 추가 함수
function addMarker(position, title) {
    // 기존 마커 제거
    removeAllMarkers();
    
    // 새 마커 생성
    const marker = new kakao.maps.Marker({
        position: position,
        map: map,
        title: title
    });
    
    // 마커 배열에 추가
    markers.push(marker);
    
    // 인포윈도우 생성
    const infowindow = new kakao.maps.InfoWindow({
        content: `<div style="padding:5px;font-size:12px;">${title}</div>`
    });
    
    // 마커 클릭 시 인포윈도우 표시
    kakao.maps.event.addListener(marker, 'click', function() {
        infowindow.open(map, marker);
    });
    
    return marker;
}

// 모든 마커 제거 함수
function removeAllMarkers() {
    for (let i = 0; i < markers.length; i++) {
        markers[i].setMap(null);
    }
    markers = [];
}

// 폴리라인 그리기 함수
function drawPolyline(positions) {
    // 기존 폴리라인 제거
    if (polyline) {
        polyline.setMap(null);
    }
    
    // 새 폴리라인 생성
    polyline = new kakao.maps.Polyline({
        path: positions,
        strokeWeight: 5,
        strokeColor: '#3498db',
        strokeOpacity: 0.7,
        strokeStyle: 'solid'
    });
    
    polyline.setMap(map);
}

// 러닝 코스 생성 함수
async function generateRunningCourse() {
    // 코스 정보 시트를 먼저 열고 로딩 표시
    openCourseSheet();
    // 로딩 표시
    showLoading(true);
    updateLoadingProgress(5);
    
    try {
        // 폼 데이터 수집
        const formData = collectFormData();
        updateLoadingProgress(10);
        
        // 주소를 좌표로 변환
        updateLoadingProgress(15);
        const coordinates = await addressToCoordinates(formData.location);
        if (!coordinates) {
            throw new Error('주소를 좌표로 변환하는데 실패했습니다.');
        }
        updateLoadingProgress(25);
        
        // GPT API를 통해 러닝 코스 생성 요청
        updateLoadingProgress(35); // OpenAI 요청 시작
        const courseData = await requestRunningCourseFromGPT(formData, coordinates);
        updateLoadingProgress(60); // OpenAI 응답 수신
        
        console.log('GPT API를 통해 러닝 코스 생성 요청', courseData);
        // 지도에 코스 표시
        updateLoadingProgress(75); // 지도 반영 시작
        displayCourseOnMap(courseData);
                console.log('지도에 코스 표시', courseData);

        // 코스 정보 표시
        updateLoadingProgress(90);
        displayCourseInfo(courseData);
                console.log('코스 정보 표시');

    } catch (error) {
        console.error('러닝 코스 생성 중 오류 발생:', error);
        alert('러닝 코스를 생성하는데 실패했습니다. 다시 시도해주세요.');
    } finally {
        // 로딩 숨김
        updateLoadingProgress(100);
        setTimeout(()=> showLoading(false), 200);
    }
}

// 폼 데이터 수집 함수
function collectFormData() {
    // 인라인 폼이 있는지 확인하고 우선 사용
    const locationInput = document.getElementById('location-inline') || document.getElementById('location');
    const distanceInput = document.getElementById('distance-inline') || document.getElementById('distance');
    const difficultyInput = document.getElementById('difficulty-inline') || document.getElementById('difficulty');
    const timeInput = document.getElementById('time-inline') || document.getElementById('time');
    const additionalInfoInput = document.getElementById('additional-info');
    const emotionSlider = document.getElementById('emotion-slider');
    
    const location = locationInput.value;
    const distance = distanceInput.value;
    const difficulty = difficultyInput.value;
    const time = timeInput.value;
    const additionalInfo = additionalInfoInput ? additionalInfoInput.value : '';
    const emotion = emotionSlider.value;
    
    // 선호 환경 체크박스 수집 (인라인 폼 우선)
    const preferences = [];
    const parkPref = document.getElementById('park-preference-inline') || document.getElementById('park-preference');
    const riverPref = document.getElementById('river-preference-inline') || document.getElementById('river-preference');
    const trailPref = document.getElementById('trail-preference-inline') || document.getElementById('trail-preference');
    const urbanPref = document.getElementById('urban-preference-inline') || document.getElementById('urban-preference');
    
    if (parkPref && parkPref.checked) preferences.push('park');
    if (riverPref && riverPref.checked) preferences.push('river');
    if (trailPref && trailPref.checked) preferences.push('trail');
    if (urbanPref && urbanPref.checked) preferences.push('urban');
    
    return {
        location,
        distance,
        difficulty,
        time,
        preferences,
        additionalInfo,
        emotion
    };
}

// 주소를 좌표로 변환하는 함수
function addressToCoordinates(address) {
    return new Promise((resolve, reject) => {
        const geocoder = new kakao.maps.services.Geocoder();
        
        geocoder.addressSearch(address, function(result, status) {
            if (status === kakao.maps.services.Status.OK) {
                const coords = {
                    lat: result[0].y,
                    lng: result[0].x
                };
                resolve(coords);
            } else {
                reject(new Error('주소를 좌표로 변환하는데 실패했습니다.'));
            }
        });
    });
}

// GPT API를 통해 러닝 코스 생성 요청 함수
async function requestRunningCourseFromGPT(formData, coordinates) {
    try {
        // 서버 API 엔드포인트로 요청 보내기
        updateLoadingProgress(40); // OpenAI request
        const response = await fetch('/api/generate-course', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                formData,
                coordinates,
                // OpenAI 키는 서버(.env)에서 사용합니다.
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'API 요청 실패');
        }
        updateLoadingProgress(55); // OpenAI response
        return await response.json();
    } catch (error) {
        console.error('API 요청 중 오류 발생:', error);
        // 개발 중 더미 응답: 서버 스키마(`course`)에 맞춰 반환
        const distanceNum = parseFloat(formData.distance);
        const expectedMinutes = formData.difficulty === 'walking'
            ? Math.round(distanceNum * 15)
            : Math.round(distanceNum * 6);
        const path = generateDummyPath(coordinates, distanceNum);
        const start = path[0];
        const end = path[path.length - 1];

        const dummy = {
            course: {
                description: `이 코스는 ${formData.location} 주변의 ${distanceNum}km 코스로, ${difficultyToKorean(formData.difficulty)} 난이도의 지형을 포함하고 있습니다. ` +
                    `${formData.preferences.includes('park') ? '공원을 지나며 ' : ''}` +
                    `${formData.preferences.includes('river') ? '강변을 따라 ' : ''}` +
                    `${formData.preferences.includes('trail') ? '트레일을 포함하고 ' : ''}` +
                    `${formData.preferences.includes('urban') ? '도심 풍경을 감상할 수 있습니다.' : '자연 풍경을 감상할 수 있습니다.'}`,
                waypoints: [
                    { name: formData.location || '출발지', location: { latitude: start.getLat ? start.getLat() : start.lat, longitude: start.getLng ? start.getLng() : start.lng } },
                    { name: formData.location || '도착지', location: { latitude: end.getLat ? end.getLat() : end.lat, longitude: end.getLng ? end.getLng() : end.lng } }
                ],
                running_tips: [
                    timeBasedTip(formData.time),
                    `${distanceNum}km 거리이므로 약 ${Math.round(distanceNum * 0.1)}L의 물을 준비하세요.`,
                    difficultyBasedTip(formData.difficulty)
                ],
                total_distance_km: distanceNum,
                expected_duration_minutes: expectedMinutes,
                elevation_change_meters: Math.round(distanceNum * 8),
                emotional_recommendation: '',
                difficulty: difficultyToKorean(formData.difficulty),
                path: path.map(p => ({ lat: p.getLat ? p.getLat() : p.lat, lng: p.getLng ? p.getLng() : p.lng }))
            }
        };
        updateLoadingProgress(55); // simulate OpenAI response
        return dummy;
    }
}

// 난이도 영어 -> 한글 변환 함수
function difficultyToKorean(difficulty) {
    const map = {
        'walking': '산책',
        'easy': '쉬움',
        'medium': '보통',
        'hard': '어려움'
    };
    return map[difficulty] || '보통';
}

// 시간대별 팁 생성 함수
function timeBasedTip(time) {
    const tips = {
        'morning': '아침 러닝은 체온이 낮으므로 충분한 준비운동을 하세요.',
        'afternoon': '오후에는 자외선이 강하니 자외선 차단제와 모자를 준비하세요.',
        'evening': '저녁 시간에는 기온이 떨어지므로 얇은 겉옷을 준비하세요.',
        'night': '야간 러닝 시에는 반사 소재의 의류나 LED 라이트를 착용하세요.'
    };
    return tips[time] || tips['afternoon'];
}

// 난이도별 팁 생성 함수
function difficultyBasedTip(difficulty) {
    const tips = {
        'walking': '산책은 편안한 신발과 여유로운 마음으로 즐기세요. 천천히 걷면서 주변 경관을 감상하는 것이 좋습니다.',
        'easy': '쉬운 코스는 초보자에게 적합합니다. 충분한 수분 섭취를 잊지 마세요.',
        'medium': '보통 난이도는 체력에 맞게 페이스를 조절하세요.',
        'hard': '어려운 코스는 충분한 준비운동과 휴식이 필요합니다.'
    };
    return tips[difficulty] || '체력에 맞는 페이스로 러닝하세요.';
}

// 더미 경로 생성 함수 (테스트용)
function generateDummyPath(center, distance) {
    const path = [];
    const numPoints = Math.max(10, Math.round(distance * 2)); // 거리에 비례하여 포인트 수 결정
    const radius = distance * 100; // 거리에 비례한 반경 (미터 단위)
    
    // 시작점 (중심 좌표)
    const startPoint = new kakao.maps.LatLng(center.lat, center.lng);
    path.push(startPoint);
    
    // 원형 경로 생성
    for (let i = 1; i < numPoints; i++) {
        const angle = (i / numPoints) * 2 * Math.PI;
        const dx = radius * Math.cos(angle) / 10000; // 경도 변화량
        const dy = radius * Math.sin(angle) / 10000; // 위도 변화량
        
        // 약간의 랜덤성 추가
        const jitter = 0.0002 * (Math.random() - 0.5);
        
        const point = new kakao.maps.LatLng(
            parseFloat(center.lat) + dy + jitter,
            parseFloat(center.lng) + dx + jitter
        );
        
        path.push(point);
    }
    
    // 경로 닫기 (시작점으로 돌아오기)
    path.push(startPoint);
    
    return path;
}

// 지도에 코스 표시 함수
function displayCourseOnMap(courseData) {
    // 지도 초기화
    removeAllMarkers();
    if (polyline) polyline.setMap(null);
    console.log("displayCourseOnMap(courseData)", courseData.course.path);
    // 경로 그리기
    const normalizedPath = (courseData.course.path || []).map(p => {
        if (typeof kakao === 'undefined' || !kakao.maps) return p;
        return (p instanceof kakao.maps.LatLng) ? p : new kakao.maps.LatLng(p.lat, p.lng);
    });
    drawPolyline(normalizedPath);
    
    // 시작/종료 지점 마커 추가
    const startPoint = normalizedPath[0];
    addMarker(startPoint, '출발/도착');
    
    // 지도 범위 재설정
    const bounds = new kakao.maps.LatLngBounds();
    normalizedPath.forEach(point => bounds.extend(point));
    map.setBounds(bounds);
}

// 카카오맵 경로 URL 생성 함수
function makeKakaoMapWalkUrl(waypoints) {
    // waypoints: [ {name, lat, lng} ... ] 또는 문자열 배열
    if (!Array.isArray(waypoints) || waypoints.length < 2) return null;
    // 출발, 도착만 사용 (중간 경유지는 옵션)
    const parse = (wp) => {
        if (typeof wp === 'string') {
            // "출발점: 장소명" 또는 "장소명,위도,경도" 형태 지원
            const m = wp.match(/([\w가-힣\s]+)[,\s]*([0-9.]+)[,\s]*([0-9.]+)/);
            if (m) return { name: m[1], lat: m[2], lng: m[3] };
            // "출발점: 장소명" 형태
            const m2 = wp.match(/([\w가-힣\s]+)/);
            return { name: m2 ? m2[1] : wp, lat: '', lng: '' };
        }
        return wp;
    };
    const start = parse(waypoints[0]);
    const end = parse(waypoints[waypoints.length-1]);
    if (!start.lat || !start.lng || !end.lat || !end.lng) return null;
    // /link/by/walk/출발,위도,경도/도착,위도,경도
    return `https://map.kakao.com/link/by/walk/${encodeURIComponent(start.name)},${start.lat},${start.lng}/${encodeURIComponent(end.name)},${end.lat},${end.lng}`;
}

// 코스 정보 표시 함수 (서버의 course 스키마 반영)
function displayCourseInfo(courseData) {
    // 초기 메시지 숨기기 및 코스 정보 영역 표시
    document.getElementById('initial-message').classList.add('d-none');
    document.getElementById('course-info').classList.remove('d-none');

    const course = courseData && courseData.course ? courseData.course : {};

    // 숫자/문자 입력 모두 대응하여 포맷팅
    const dist = typeof course.total_distance_km === 'number' ? `${course.total_distance_km}km` : (course.total_distance_km || '');
    const minsVal = course.expected_duration_minutes;
    const mins = typeof minsVal === 'number' || /^\d+(?:\.\d+)?$/.test(String(minsVal || ''))
        ? `${parseFloat(minsVal)}분`
        : (minsVal || '');
    const elevVal = course.elevation_change_meters;
    const elev = typeof elevVal === 'number' || /^\d+(?:\.\d+)?$/.test(String(elevVal || ''))
        ? `${Number(elevVal) >= 0 ? '+' : ''}${parseFloat(elevVal)}m`
        : (elevVal || '');

    document.getElementById('total-distance').textContent = dist;
    document.getElementById('estimated-time').textContent = mins;
    document.getElementById('elevation').textContent = elev;
    document.getElementById('course-difficulty').textContent = course.difficulty || '';
    document.getElementById('course-description').textContent = course.description || '';

    // 경유지 목록 업데이트 (name 우선 표시)
    const waypointsElement = document.getElementById('waypoints');
    waypointsElement.innerHTML = '';
    (Array.isArray(course.waypoints) ? course.waypoints : []).forEach(wp => {
        const li = document.createElement('li');
        if (wp && typeof wp === 'object') {
            const name = wp.name || '';
            li.textContent = name || JSON.stringify(wp);
        } else {
            li.textContent = String(wp);
        }
        waypointsElement.appendChild(li);
    });

    // 팁 목록 업데이트 (running_tips 사용)
    const tipsElement = document.getElementById('tips');
    tipsElement.innerHTML = '';
    (Array.isArray(course.running_tips) ? course.running_tips : []).forEach(tip => {
        const li = document.createElement('li');
        li.textContent = String(tip);
        tipsElement.appendChild(li);
    });

    // 카카오맵 링크 (출발/도착만 활용)
    const kakaoMapBtn = document.getElementById('kakao-map-link');
    if (kakaoMapBtn && Array.isArray(course.waypoints) && course.waypoints.length > 1) {
        const start = course.waypoints[0] || {};
        const end = course.waypoints[course.waypoints.length - 1] || {};
        const startName = start.name || '출발지';
        const endName = end.name || '도착지';
        const sLng = start.location?.longitude;
        const sLat = start.location?.latitude;
        const eLng = end.location?.longitude;
        const eLat = end.location?.latitude;
        if ([sLng, sLat, eLng, eLat].every(v => typeof v === 'number' || /^-?\d+(?:\.\d+)?$/.test(String(v)))) {
            const url = `https://map.kakao.com/link/by/walk/${encodeURIComponent(startName)},${sLng},${sLat}/${encodeURIComponent(endName)},${eLng},${eLat}`;
            kakaoMapBtn.href = url;
            kakaoMapBtn.style.display = '';
        } else {
            kakaoMapBtn.href = '#';
            kakaoMapBtn.style.display = 'none';
        }
    } else if (kakaoMapBtn) {
        kakaoMapBtn.href = '#';
        kakaoMapBtn.style.display = 'none';
    }

    // 애니메이션 효과 및 저장 버튼 강조
    document.getElementById('course-info').classList.add('fade-in');
    const saveBtn = document.getElementById('save-course');
    if (saveBtn) {
        saveBtn.classList.add('pulse');
        setTimeout(() => saveBtn.classList.remove('pulse'), 1500);
    }
}

// 로딩 표시 함수
function showLoading(isLoading) {
    const loadingElement = document.getElementById('loading');
    const initialMessageElement = document.getElementById('initial-message');
    const courseInfoElement = document.getElementById('course-info');
    // 진행률 초기화
    if (isLoading) updateLoadingProgress(0);
    
    if (isLoading) {
        loadingElement.classList.remove('d-none');
        initialMessageElement.classList.add('d-none');
        courseInfoElement.classList.add('d-none');
    } else {
        loadingElement.classList.add('d-none');
    }
}

// 로딩 진행 바 업데이트
function updateLoadingProgress(percent){
    const fill = document.getElementById('loading-progress-fill');
    if (!fill) return;
    const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
    fill.style.width = clamped + '%';
}

// 폼 초기화 함수
function resetForm() {
    // 폼 필드 초기화
    document.getElementById('running-form').reset();
    updateDistanceValue();
    updateEmotionValue(); // 감정 슬라이더 초기화
    
    // 지도 초기화
    if (map) {
        removeAllMarkers();
        if (polyline) {
            polyline.setMap(null);
            polyline = null;
        }
    }
    
    // 코스 정보 숨김
    document.getElementById('course-info').classList.add('d-none');
    document.getElementById('initial-message').classList.remove('d-none');
}

// 코스 저장 함수 (로컬 스토리지 활용)
function saveCourse() {
    // 현재 코스 정보 수집
    const courseInfo = {
        totalDistance: document.getElementById('total-distance').textContent,
        estimatedTime: document.getElementById('estimated-time').textContent,
        elevation: document.getElementById('elevation').textContent,
        difficulty: document.getElementById('course-difficulty').textContent,
        description: document.getElementById('course-description').textContent,
        location: document.getElementById('location').value,
        // 주요 경유지/추천 팁 저장
        waypoints: (function(){
            const list = document.getElementById('waypoints');
            if (!list) return [];
            return Array.from(list.querySelectorAll('li')).map(li => li.textContent.trim()).filter(Boolean);
        })(),
        tips: (function(){
            const list = document.getElementById('tips');
            if (!list) return [];
            return Array.from(list.querySelectorAll('li')).map(li => li.textContent.trim()).filter(Boolean);
        })(),
        // 입력값 스냅샷
        form: collectFormData(),
        // 현재 지도 경로 저장
        path: (function(){
            try {
                if (!polyline) return [];
                const raw = typeof polyline.getPath === 'function' ? (polyline.getPath().getArray ? polyline.getPath().getArray() : polyline.getPath()) : [];
                return raw.map(p => ({
                    lat: typeof p.getLat === 'function' ? p.getLat() : (p.lat || p.Ma || p.y),
                    lng: typeof p.getLng === 'function' ? p.getLng() : (p.lng || p.La || p.x)
                })).filter(pt => typeof pt.lat === 'number' && typeof pt.lng === 'number');
            } catch(_e) { return []; }
        })(),
        savedAt: new Date().toISOString()
    };

    // 서버에도 저장 (실패해도 로컬엔 저장)
    fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(courseInfo)
    }).catch(()=>{});

    // 로컬 스토리지 백업 저장
    try {
        let savedCourses = JSON.parse(localStorage.getItem('savedRunningCourses') || '[]');
        savedCourses.push(courseInfo);
        localStorage.setItem('savedRunningCourses', JSON.stringify(savedCourses));
    } catch (_) {}

    alert('코스가 저장되었습니다!');
}

// 코스 공유 함수
function shareCourse() {
    // 현재 URL 가져오기
    const url = window.location.href;
    
    // 공유 텍스트 생성
    const shareText = `러닝 코스 생성기로 만든 ${document.getElementById('total-distance').textContent} 코스를 확인해보세요! ${url}`;
    
    // 클립보드에 복사
    if (navigator.clipboard) {
        navigator.clipboard.writeText(shareText)
            .then(() => {
                alert('공유 링크가 클립보드에 복사되었습니다!');
            })
            .catch(err => {
                console.error('클립보드 복사 실패:', err);
                alert('공유 링크 복사에 실패했습니다. 수동으로 복사해주세요:\n' + shareText);
            });
    } else {
        // 클립보드 API를 지원하지 않는 브라우저용 대체 방법
        const textArea = document.createElement('textarea');
        textArea.value = shareText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('공유 링크가 클립보드에 복사되었습니다!');
    }
}

// 바텀시트 열고 닫기
function setupSheets(){
    // 초기에는 설정 시트 열어두지 않음
}
function openSettings(){ document.getElementById('settings-sheet').classList.add('open'); }
function closeSettings(){ document.getElementById('settings-sheet').classList.remove('open'); }
function openCourseSheet(){ document.getElementById('course-sheet').classList.add('open'); }
function closeCourseSheet(){ document.getElementById('course-sheet').classList.remove('open'); }
function openHistorySheet(){
    refreshHistorySummary();
    renderHistoryList();
    document.getElementById('history-sheet').classList.add('open');
}
function closeHistorySheet(){ document.getElementById('history-sheet').classList.remove('open'); }

// 거리 칩 실시간 반영
const distanceSliderEl = () => document.getElementById('distance');
function updateDistanceValue() {
    const distanceSlider = distanceSliderEl();
    const distanceValue = document.getElementById('distance-value');
    const chip = document.getElementById('distance-chip');
    distanceValue.textContent = `${distanceSlider.value}km`;
    if (chip) chip.textContent = `${distanceSlider.value} km`;
}

// 인라인 거리 슬라이더 값 업데이트 함수
function updateDistanceValueInline() {
    const distanceSlider = document.getElementById('distance-inline');
    const distanceValue = document.getElementById('distance-value-inline');
    if (distanceSlider && distanceValue) {
        distanceValue.textContent = `${distanceSlider.value}km`;
    }
}

// 기록 요약/목록 렌더링
function getSavedCourses(){
    try { return JSON.parse(localStorage.getItem('savedRunningCourses')||'[]'); } catch(_) { return []; }
}
function refreshHistorySummary(){
    const courses = getSavedCourses();
    const totalCount = courses.length;
    const totalDistance = courses.reduce((sum,c)=>{
        const n = parseFloat(String(c.totalDistance).replace('km','').trim());
        return sum + (isNaN(n)?0:n);
    },0);
    const last = courses[courses.length-1];
    document.getElementById('history-total-count').textContent = String(totalCount);
    document.getElementById('history-total-distance').textContent = `${totalDistance.toFixed(1)} km`;
    document.getElementById('history-last-date').textContent = last ? new Date(last.savedAt).toLocaleString() : '-';
}
function renderHistoryList(){
    const listEl = document.getElementById('history-list');
    const emptyEl = document.getElementById('history-empty');
    listEl.innerHTML = '';
    const courses = getSavedCourses();
    if (!courses.length){ emptyEl.style.display='block'; return; }
    emptyEl.style.display='none';
    courses.slice().reverse().forEach((c,revIdx)=>{
        const actualIndex = courses.length - 1 - revIdx;
        const li = document.createElement('li');
        li.className = 'list-group-item';
        li.innerHTML = `<div class="d-flex justify-content-between align-items-center">
            <div>${c.location || '위치 미상'} · ${c.totalDistance} · ${c.estimatedTime}</div>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-primary" data-action="load" data-index="${actualIndex}">불러오기</button>
              <button class="btn btn-outline-danger" data-action="delete" data-index="${actualIndex}">삭제</button>
            </div>
        </div>`;
        listEl.appendChild(li);
    });
}

function loadCourseFromHistory(index){
    const courses = getSavedCourses();
    const item = courses[index];
    if (!item) return;
    // 지도 표시
    if (Array.isArray(item.path) && item.path.length > 1) {
        const latlngs = item.path.map(p => new kakao.maps.LatLng(p.lat, p.lng));
        drawPolyline(latlngs);
        const bounds = new kakao.maps.LatLngBounds();
        latlngs.forEach(pt => bounds.extend(pt));
        map.setBounds(bounds);
        addMarker(latlngs[0], '출발/도착');
    } else if (item.location) {
        // 경로가 없으면 위치만 지도에 표시
        addressToCoordinates(item.location).then(coords => {
            const pos = new kakao.maps.LatLng(coords.lat, coords.lng);
            map.setCenter(pos);
            addMarker(pos, '저장된 위치');
        }).catch(()=>{});
    }
    // 시트/정보 표시
    document.getElementById('total-distance').textContent = item.totalDistance;
    document.getElementById('estimated-time').textContent = item.estimatedTime;
    document.getElementById('elevation').textContent = item.elevation;
    document.getElementById('course-difficulty').textContent = item.difficulty;
    document.getElementById('course-description').textContent = item.description || '';
    // 주요 경유지 복원
    (function(){
        const waypointsElement = document.getElementById('waypoints');
        if (!waypointsElement) return;
        waypointsElement.innerHTML = '';
        (Array.isArray(item.waypoints) ? item.waypoints : []).forEach(text => {
            const li = document.createElement('li');
            li.textContent = String(text);
            waypointsElement.appendChild(li);
        });
    })();
    // 추천 팁 복원
    (function(){
        const tipsElement = document.getElementById('tips');
        if (!tipsElement) return;
        tipsElement.innerHTML = '';
        (Array.isArray(item.tips) ? item.tips : []).forEach(text => {
            const li = document.createElement('li');
            li.textContent = String(text);
            tipsElement.appendChild(li);
        });
    })();
    document.getElementById('course-info').classList.remove('d-none');
    document.getElementById('initial-message').classList.add('d-none');
    openCourseSheet();
}

function deleteCourseFromHistory(index){
    const courses = getSavedCourses();
    courses.splice(index,1);
    localStorage.setItem('savedRunningCourses', JSON.stringify(courses));
    refreshHistorySummary();
    renderHistoryList();
    refreshInlineHistory();
}

// 인라인 기록(컨트롤 영역) 렌더링
function refreshInlineHistory(){
    const listEl = document.getElementById('history-inline-list');
    const emptyEl = document.getElementById('history-inline-empty');
    if (!listEl || !emptyEl) return;
    listEl.innerHTML = '';
    const courses = getSavedCourses();
    if (!courses.length){ emptyEl.style.display='block'; return; }
    emptyEl.style.display='none';
    courses.slice(-5).reverse().forEach((c,idx)=>{
        const actualIndex = courses.length - 1 - idx;
        const li = document.createElement('li');
        const locationText = c.location || '위치 미상';
        const distanceText = c.totalDistance || '';
        const timeText = c.estimatedTime || '';
        li.innerHTML = `
          <div class=\"inline-history-left\">
            <div class=\"inline-history-title\">${locationText}</div>
            <div class=\"inline-history-sub\">${distanceText}${distanceText && timeText ? ', ' : ''}${timeText}</div>
          </div>
          <span class=\"inline-history-actions\">
            <button class=\"inline-history-btn view-btn\" data-action=\"load\" data-index=\"${actualIndex}\">보기</button>
            <button class=\"inline-history-btn delete-btn\" data-action=\"delete\" data-index=\"${actualIndex}\">삭제</button>
          </span>`;
        listEl.appendChild(li);
    });
}

// 날씨 정보 초기화 함수
function initWeather() {
    // 현재 위치 기반으로 날씨 정보 가져오기
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(position) {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            getWeatherData(lat, lon);
        }, function(error) {
            console.error('위치 정보를 가져올 수 없습니다:', error);
            // 기본 날씨 정보 표시
            updateWeatherDisplay('☀️', '-°C', '맑음');
        });
    } else {
        // 기본 날씨 정보 표시
        updateWeatherDisplay('☀️', '-°C', '맑음');
    }
}

// 날씨 데이터 가져오기 함수
async function getWeatherData(lat, lon) {
    try {
        // OpenWeatherMap API 사용 (무료)
        const apiKey = 'b63db65c6872a194fde17031c1617e89'; // 실제 사용시 API 키 필요
        const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=kr`);
        
        if (response.ok) {
            const data = await response.json();
            const temp = Math.round(data.main.temp);
            const weatherDesc = data.weather[0].description;
            const weatherIcon = getWeatherIcon(data.weather[0].id);
            
            updateWeatherDisplay(weatherIcon, `${temp}°C`, weatherDesc);
        } else {
            // API 호출 실패시 기본 정보 표시
            updateWeatherDisplay('☀️', '-°C', '맑음');
        }
    } catch (error) {
        console.error('날씨 정보를 가져오는데 실패했습니다:', error);
        // 에러시 기본 정보 표시
        updateWeatherDisplay('☀️', '-°C', '맑음');
    }
}

// 날씨 아이콘 매핑 함수
function getWeatherIcon(weatherId) {
    if (weatherId >= 200 && weatherId < 300) return '⛈️'; // 천둥번개
    if (weatherId >= 300 && weatherId < 400) return '🌧️'; // 가벼운 비
    if (weatherId >= 500 && weatherId < 600) return '🌧️'; // 비
    if (weatherId >= 600 && weatherId < 700) return '❄️'; // 눈
    if (weatherId >= 700 && weatherId < 800) return '🌫️'; // 안개
    if (weatherId === 800) return '☀️'; // 맑음
    if (weatherId >= 801 && weatherId < 900) return '☁️'; // 구름
    return '☀️'; // 기본값
}

// 날씨 표시 업데이트 함수
function updateWeatherDisplay(icon, temperature, description) {
    const weatherIconEls = document.querySelectorAll('.weather-icon');
    const weatherDescEls = document.querySelectorAll('.weather-desc');
    const tempElements = document.querySelectorAll('.temperature');
    const timeEl = document.getElementById('weather-time');

    weatherIconEls.forEach(el => { el.textContent = icon; });
    weatherDescEls.forEach(el => { el.textContent = description; });
    tempElements.forEach(el => { el.textContent = temperature; });
    if (timeEl) timeEl.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// 숭실대입구역~가마치통닭 데모 경로 표시 함수 (실제 도로 경로)
async function showDemoCourseIfMatch() {
    // 조건: 기분(슬라이더) 66 이상, 거리 3km 이하, 난이도 쉬움
    const emotionSlider = document.getElementById('emotion-slider');
    const distanceInput = document.getElementById('distance-inline') || document.getElementById('distance');
    const difficultyInput = document.getElementById('difficulty-inline') || document.getElementById('difficulty');
    if (!emotionSlider || !distanceInput || !difficultyInput) return;
    const emotion = parseInt(emotionSlider.value);
    const distance = parseFloat(distanceInput.value);
    const difficulty = difficultyInput.value;
    if (emotion >= 66 && distance <= 3 && difficulty === 'easy') {
        // 좌표: 숭실대입구역(37.495985, 126.954208), 가마치통닭(37.499365, 126.953504)
        const start = { name: '숭실대입구역', lat: 37.495985, lng: 126.954208 };
        const end = { name: '가마치통닭', lat: 37.499365, lng: 126.953504 };
        // 서버에 실제 도로 경로 요청
        try {
            const origin = `${start.lng},${start.lat}`;
            const destination = `${end.lng},${end.lat}`;
            updateLoadingProgress(65); // Kakao path request
            const res = await fetch(`/api/road-path?origin=${origin}&destination=${destination}`);
            const data = await res.json();
            updateLoadingProgress(75); // Kakao path response
            if (!data.routes || !data.routes[0] || !data.routes[0].sections) throw new Error('경로 없음');
            // vertexes 파싱
            const linePath = [];
            data.routes[0].sections[0].roads.forEach(road => {
                for (let i = 0; i < road.vertexes.length; i += 2) {
                    const lng = road.vertexes[i];
                    const lat = road.vertexes[i + 1];
                    if (lat !== undefined && lng !== undefined) {
                        linePath.push(new window.kakao.maps.LatLng(lat, lng));
                    }
                }
            });
            removeAllMarkers();
            if (polyline) polyline.setMap(null);
            updateLoadingProgress(82); // Build polyline
            const poly = new window.kakao.maps.Polyline({
                path: linePath,
                strokeWeight: 5,
                strokeColor: '#f57a00',
                strokeOpacity: 0.7,
                strokeStyle: 'solid',
            });
            poly.setMap(map);
            polyline = poly;
            updateLoadingProgress(88); // Polyline set
            addMarker(linePath[0], start.name);
            addMarker(linePath[linePath.length-1], end.name);
            // 지도 중심/범위
            const bounds = new kakao.maps.LatLngBounds();
            linePath.forEach(pt => bounds.extend(pt));
            map.setBounds(bounds);
            // 코스 정보 시트 자동 표시
            openCourseSheet();
            // 코스 정보 채우기
            document.getElementById('total-distance').textContent = '2.5km';
            document.getElementById('estimated-time').textContent = '15분';
            document.getElementById('elevation').textContent = '+10m';
            document.getElementById('course-difficulty').textContent = '쉬움';
            document.getElementById('course-description').textContent = '기분 좋은 날, 숭실대입구역에서 가마치통닭까지 가볍게 달려보세요! 평지 위주로 초보자도 부담 없이 즐길 수 있습니다.';
            // 경유지/팁
            const waypointsElement = document.getElementById('waypoints');
            waypointsElement.innerHTML = '';
            ['출발점: 숭실대입구역', '도착점: 가마치통닭'].forEach(wp => {
                const li = document.createElement('li');
                li.textContent = wp;
                waypointsElement.appendChild(li);
            });
            const tipsElement = document.getElementById('tips');
            tipsElement.innerHTML = '';
            ['맑은 날씨에 가볍게 달리기 좋은 코스입니다.', '충분한 수분 섭취를 잊지 마세요.'].forEach(tip => {
                const li = document.createElement('li');
                li.textContent = tip;
                tipsElement.appendChild(li);
            });
            // 카카오맵 링크
            const kakaoMapBtn = document.getElementById('kakao-map-link');
            if (kakaoMapBtn) {
                kakaoMapBtn.href = `https://map.kakao.com/link/by/walk/${encodeURIComponent(start.name)},${start.lat},${start.lng}/${encodeURIComponent(end.name)},${end.lat},${end.lng}`;
                kakaoMapBtn.style.display = '';
            }
            // 애니메이션 효과
            document.getElementById('course-info').classList.add('fade-in');
            // 저장 버튼 강조
            const saveBtn = document.getElementById('save-course');
            if (saveBtn) {
                saveBtn.classList.add('pulse');
                setTimeout(()=> saveBtn.classList.remove('pulse'), 1500);
            }
        } catch (e) {
            alert('실제 도로 경로를 불러오지 못했습니다.');
        }
    }
}
// 슬라이더/거리/난이도 변경 시 데모 코스 표시 시도
['emotion-slider','distance-inline','distance','difficulty-inline','difficulty'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', showDemoCourseIfMatch);
});