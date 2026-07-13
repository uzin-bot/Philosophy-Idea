# Avomatic
사진 한 장으로 아보카도 숙성도를 판별하고, 보관법에 맞춰 먹기 좋은 시점을 알려주는 서비스.

## 구조
```
index.html        # 업로드 / 보관법 선택 / 결과 카드 화면
css/style.css      # 스타일
js/app.js          # 화면 전환 + 목업 판별·잔여일 계산 로직
```

## 실행
```
python3 -m http.server 8000
```
→ 브라우저에서 http://localhost:8000 접속
