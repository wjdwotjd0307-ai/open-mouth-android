# OPEN MOUTH Android APK 패키징 버전

이 프로젝트는 OPEN MOUTH 웹 서비스를 Android APK로 감싸는 전용 Android 앱입니다.

## 앱 동작 방식

1. APK 설치
2. 첫 실행
3. OPEN MOUTH 무료 HTTPS 서버 주소 입력
   예: `https://open-mouth-xxxx.onrender.com`
4. 주소 저장
5. 다음 실행부터 바로 OPEN MOUTH 앱 실행
6. 마이크 권한 허용
7. AI 영어회화 사용

서버 주소가 바뀌어도 APK를 다시 만들 필요가 없습니다.
휴대폰 뒤로가기 버튼을 앱 첫 화면에서 누르면 `서버 주소 변경` 메뉴가 나옵니다.

## 보안

- OpenAI API 키는 APK에 들어가지 않습니다.
- APK는 HTTPS 서버만 허용합니다.
- HTTP 평문 통신은 차단했습니다.
- 마이크는 Android 권한을 받은 경우에만 WebView에 전달합니다.

## APK 만들기 방법 A — GitHub Actions

이 폴더를 GitHub 저장소에 업로드하면 `.github/workflows/build-apk.yml`이 APK를 자동 빌드합니다.

GitHub:
1. 새 저장소 생성
2. 이 폴더 전체 업로드
3. Actions → `Build OPEN MOUTH APK`
4. Run workflow
5. 완료 후 Artifacts → `OPEN-MOUTH-debug-apk`
6. 압축을 내려받으면 `app-debug.apk`가 있습니다.

갤럭시로 APK를 옮긴 후 실행하면 설치할 수 있습니다.
Android가 "알 수 없는 앱 설치" 권한을 물으면 해당 브라우저/파일 앱에 한 번 허용하면 됩니다.

## APK 만들기 방법 B — Android Studio

1. Android Studio 설치
2. `Open` → 이 프로젝트 폴더
3. Gradle Sync
4. Build → Build APK(s)
5. 생성 위치:
   `app/build/outputs/apk/debug/app-debug.apk`

## 서버가 먼저 필요한 이유

APK는 사용자 화면과 휴대폰 권한을 담당합니다.
AI 기능과 DB는 HTTPS 서버가 담당합니다.

APK → HTTPS OPEN MOUTH 서버 → OpenAI / Turso DB

OpenAI API 키를 APK 안에 넣으면 추출될 수 있으므로 서버 방식이 안전합니다.

## 현재 패키지 정보

- 앱 이름: OPEN MOUTH
- Android package: `kr.openmouth.app`
- minSdk: 26
- targetSdk: 35
- 세로 화면 고정
- 마이크 지원
- HTTPS only
- WebView 기반
