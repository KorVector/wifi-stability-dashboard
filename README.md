# 기숙사 Wi-Fi 안정화 분석 웹

`index.html`을 브라우저에서 열거나 정적 서버로 실행하는 웹 앱입니다.

## 반영된 실제 데이터

- 원본 파일: `network_weather_analysis_ap_plan.xlsx`
- 전체 정제 요약 데이터: 110,464건
- 웹에 포함된 데이터 표본: 8,000건
- 공개 데이터 지역: 네덜란드, 독일
- 기숙사 직접 측정 데이터: 웹의 `지금 측정` 기능으로 별도 누적

현재 엑셀의 공개 데이터는 연암공대 기숙사에서 직접 측정한 값이 아니므로, 앱에서는 `공개 데이터로 확인한 원인`과 `기숙사에서 직접 측정한 값`을 분리합니다.

## 로컬 테스트

PowerShell에서 실행합니다.

```powershell
cd C:\Users\wjdgk\Documents\Codex\2026-06-14\1-sql-sql-2-3-4\outputs\wifi-stability-dashboard
python -m http.server 8000
```

브라우저에서 엽니다.

```text
http://localhost:8000
```

HTML 파일을 더블클릭해도 분석 화면은 보이지만, 트래픽 측정은 `fetch` 요청이 필요해서 로컬 서버나 배포 주소에서 실행하는 편이 안정적입니다.

## 웹 측정 기능

브라우저에서 직접 가능한 범위 안에서 측정합니다.

- `ping.txt`를 여러 번 요청해 HTTP 지연과 지터 계산
- 실패한 요청 비율로 HTTP 실패율 계산
- `speed-test-payload.txt` 다운로드 시간으로 다운로드 Mbps 추정
- 측정 결과는 기본적으로 브라우저 `localStorage`에 저장
- `측정 JSON 내보내기`로 결과 백업 가능

브라우저 보안상 내부 게이트웨이 ping, Wi-Fi RSSI, 실제 패킷 손실률은 웹만으로 직접 읽을 수 없습니다. 그런 값은 별도 측정 스크립트나 네트워크 장비 로그가 필요합니다.

## 원격 저장

여러 팀원이 같은 DB에 측정값을 모으려면 Supabase를 연결합니다.

1. Supabase 프로젝트 생성
2. SQL editor에서 `supabase-schema.sql` 실행
3. 웹 화면에 Supabase URL과 anon key 입력
4. `원격 저장 설정` 클릭
5. 이후 측정값은 로컬과 Supabase에 함께 저장

## 배포

이 폴더는 정적 웹이라 GitHub Pages, Netlify, Vercel에 그대로 배포할 수 있습니다.

- GitHub Pages: 이 폴더 내용을 저장소 루트 또는 `docs/`에 넣고 Pages 활성화
- Netlify: 이 폴더를 드래그 앤 드롭 또는 GitHub 연결
- Vercel: 정적 프로젝트로 import, output directory는 현재 폴더

## 분석 기준

표본 8,000행의 `불량 연결` 라벨을 기준으로 안정화 기준을 계산했습니다.

- 다운로드: 154.3Mbps 초과 목표
- RTT: 71.0ms 이하 목표
- 패킷 손실/HTTP 실패율: 0.8% 미만 목표

이 기준은 엑셀 데이터에서 계산한 기준이며, 기숙사 실측 데이터가 쌓이면 앱의 위험 위치 순위로 실제 AP 후보를 좁힐 수 있습니다.
