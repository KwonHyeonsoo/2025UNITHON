# 러닝 코스 생성기

GPT API와 카카오맵 API를 활용한 맞춤형 러닝 코스 생성기입니다.

## 🚀 배포된 사이트

**Vercel 배포**: [러닝 코스 생성기](https://running-course-generator.vercel.app)

## 📋 기능

- 현재 위치 기반 러닝 코스 생성
- 거리, 난이도, 선호 환경 설정
- GPT API를 활용한 맞춤형 코스 추천
- 카카오맵 API를 통한 경로 시각화
- 시간대별 러닝 팁 제공

## 🛠️ 기술 스택

- **Frontend**: HTML, CSS, JavaScript, Bootstrap
- **Backend**: Node.js, Express.js
- **API**: OpenAI GPT API, 카카오맵 API
- **배포**: Vercel

## 🔧 설치 및 실행

### 로컬 개발

1. 저장소 클론
```bash
git clone <repository-url>
cd running-course-generator
```

2. 의존성 설치
```bash
npm install
```

3. 환경 변수 설정
```bash
cp env.example .env
# .env 파일에 API 키 입력
```

4. 개발 서버 실행
```bash
npm run dev
```

### 배포

이 프로젝트는 Vercel을 통해 자동 배포됩니다.

## 🔑 API 키 설정

### OpenAI API 키
1. [OpenAI](https://platform.openai.com/)에서 API 키 발급
2. Vercel 대시보드에서 환경 변수 설정:
   - `OPENAI_API_KEY`: 발급받은 API 키

### 카카오맵 API 키 (선택사항)
1. [카카오 개발자](https://developers.kakao.com/)에서 API 키 발급
2. Vercel 대시보드에서 환경 변수 설정:
   - `KAKAO_API_KEY`: 발급받은 API 키

## 📱 사용법

1. 현재 위치 입력 또는 GPS 위치 사용
2. 러닝 거리, 난이도, 선호 환경 설정
3. 러닝 시간대 선택
4. 추가 요청사항 입력 (선택사항)
5. "코스 생성하기" 버튼 클릭
6. 생성된 코스 확인 및 지도에서 경로 확인

## 🌟 주요 특징

- **맞춤형 추천**: 사용자 설정에 따른 개인화된 코스 생성
- **실시간 지도**: 카카오맵을 통한 직관적인 경로 시각화
- **AI 기반**: GPT API를 활용한 지능형 코스 추천
- **반응형 디자인**: 모바일과 데스크톱에서 최적화된 사용자 경험

## �� 라이선스

MIT License