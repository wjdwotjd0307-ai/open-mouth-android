# OPEN MOUTH 휴대폰 설치판

이 버전은 Android Chrome에서 홈 화면에 설치하는 PWA 배포판입니다.

## 구조
- 앱 서버 / 무료 HTTPS 주소: Render
- 학습기록: Turso Cloud
- AI 음성: OpenAI API
- 설치: Android Chrome → 앱 설치

## 왜 DB를 Turso로 바꿨나요?
Render 무료 Web Service의 로컬 파일은 재시작/재배포/유휴 절전 시 보존되지 않습니다.
따라서 휴대폰에서 오래 사용하려면 SQLite 파일을 서버 내부에 두면 안 됩니다.
Turso Cloud는 SQLite 호환 클라우드 DB라 기존 OPEN MOUTH 구조와 잘 맞습니다.

## 1. Turso 무료 DB 만들기
Turso 계정을 만들고 새 DB를 하나 생성합니다.

필요한 값:
- TURSO_DATABASE_URL
- TURSO_AUTH_TOKEN

앱이 최초 실행될 때 필요한 테이블은 자동 생성됩니다.

## 2. GitHub
이 폴더 전체를 새 GitHub 저장소에 올립니다.
`.env`와 API 키는 GitHub에 올리지 마세요.

## 3. Render
Render → New → Web Service → GitHub 저장소 연결

설정:
- Runtime: Node
- Build command: npm install
- Start command: npm start
- Health check: /health
- Free plan 선택

Environment Variables:
- OPENAI_API_KEY
- TURSO_DATABASE_URL
- TURSO_AUTH_TOKEN

배포가 끝나면:
`https://open-mouth-xxxx.onrender.com`
형태의 HTTPS 주소가 생깁니다.

## 4. Android에 설치
1. 안드로이드 휴대폰에서 Chrome 실행
2. 위 HTTPS 주소 접속
3. OPEN MOUTH 화면의 `📲 OPEN MOUTH 설치` 버튼을 누르거나
4. Chrome ⋮ 메뉴 → `앱 설치` / `홈 화면에 추가`
5. 설치 완료

설치하면 홈 화면에 OPEN MOUTH 아이콘이 생기고 standalone 모드로 실행됩니다.

## 참고
무료 Render 서버는 15분 동안 요청이 없으면 절전될 수 있어서 첫 실행 때 잠시 로딩될 수 있습니다.
학습기록은 Turso에 있으므로 서버가 다시 켜져도 유지됩니다.

OPENAI API 사용료는 별도이며 완전 무료가 아닙니다.
