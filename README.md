# 감토정 — Vercel용 Next.js 프로젝트

기존 사이트와 분리한 별도 프로젝트입니다. 밝고 친근한 화면, 감토정 이야기, 상품 상세·장바구니·저장 주문서, 관리자 상품·카테고리·FAQ·문의 답변, 사진·별점 후기를 포함합니다. 기존 사이트와 도메인은 변경하지 않았습니다.

## 로컬 실행

Node.js 22 이상, pnpm 11.25.0을 준비하고 압축을 해제한 프로젝트 폴더에서 실행하세요.

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm db:migrate
pnpm dev
```

Windows PowerShell은 `Copy-Item .env.example .env.local`을 사용할 수 있습니다. http://localhost:3000 에서 확인합니다. 기본 로컬 DB는 `.data/gamtojung.db`이며 운영 DB로 사용하지 않습니다.
Google 로그인과 이미지 업로드는 해당 환경변수 연결 후 사용할 수 있습니다. 설정 전에도 상품 화면을 확인할 수 있습니다. 관리자 페이지는 `/admin`입니다.

## Vercel 배포

1. 이 프로젝트만 별도 Git 저장소에 올리고 Vercel에서 Import합니다. Framework는 **Next.js**, Node.js는 **22.x**로 설정합니다. 저장소 하위 폴더에 넣었다면 Root Directory를 지정합니다.
2. 원격 Turso/libSQL DB를 만들고 아래 환경변수를 Vercel에 등록합니다.
3. 로컬 `.env.local`에도 운영 DB URL·토큰을 설정하고 `pnpm db:migrate`로 원격 스키마를 준비합니다. 이미 데이터가 있는 DB는 먼저 백업하고 아래 이전 절차를 확인하세요.
4. Google OAuth 및 S3 호환 저장소를 연결한 뒤 배포합니다. 환경변수 변경 후에는 재배포합니다.
5. 영업 시작 전 실제 재고·상품정보고시·약관·배송정책·PG 결제 및 공식 도메인을 확정합니다.

`vercel.json`, `next.config.ts`, `pnpm-lock.yaml`을 포함했습니다. 빌드는 `pnpm build`, 실행은 `pnpm start`입니다. 마이그레이션은 빌드 중 자동 실행하지 않습니다. 배포 전 명시적으로 실행해야 합니다.

## 환경변수

| 이름 | 용도 |
|---|---|
| TURSO_DATABASE_URL | 로컬 `file:.data/gamtojung.db`, 운영 원격 `libsql://...` |
| TURSO_AUTH_TOKEN | 원격 DB 토큰 |
| AUTH_SECRET | 세션 서명용 무작위 비밀값 |
| AUTH_URL | 로컬 `http://localhost:3000`, 운영의 실제 HTTPS 도메인 |
| AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET | Google OAuth 웹 클라이언트 ID·비밀값 |
| ADMIN_EMAIL | 관리자 이메일. 기본 `gudwls1284@gmail.com` |
| S3_BUCKET | 비공개 이미지 버킷 이름 |
| S3_ENDPOINT | R2 등 S3 호환 엔드포인트. AWS S3이면 생략 가능 |
| S3_REGION | R2는 `auto`, AWS는 실제 리전 |
| S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY | 버킷 읽기·쓰기 키 |
| S3_FORCE_PATH_STYLE | MinIO 등 경로 방식이 필요한 경우 `true` |

비밀값은 `.env.local`과 Vercel 환경변수에만 저장하세요. `NEXT_PUBLIC_` 접두어를 붙이지 않습니다. AUTH_SECRET 생성:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## 로그인과 관리자

Google Cloud Console에서 웹용 OAuth 클라이언트를 생성하고 승인된 리디렉션 URI를 등록하세요.

- 로컬: `http://localhost:3000/api/auth/callback/google`
- 운영: `https://실제-운영-도메인/api/auth/callback/google`

`AUTH_URL`과 도메인을 일치시키세요. Google 앱이 테스트 상태이면 사용할 계정을 테스트 사용자로 등록해야 합니다. Google의 이메일 인증을 확인하고 인증된 이메일이 `ADMIN_EMAIL`과 일치할 때만 관리자 API를 허용합니다.
기존 Sites의 ChatGPT 로그인·인증 헤더는 사용하지 않습니다. 임의로 인증 헤더를 넣어도 관리자 권한을 얻을 수 없습니다. 로그인은 `/login`, 로그아웃은 `/logout`의 확인 후 POST 방식입니다.
Auth.js 공식 v5 문서에 따라 `next-auth@5.0.0-beta.31`을 사용하며 잠금 파일로 고정했습니다.

## 이미지 저장

기본 상품 사진은 `public/assets`에 포함했습니다. 새 사진은 비공개 S3 호환 저장소의 `products/` 경로에 저장하고 `/api/store/images/...`로 읽습니다. R2의 S3 API도 사용할 수 있습니다.
Vercel Function 크기 제한을 고려해 새 업로드는 **장당 4MB 이하**, JPG/PNG/WEBP로 조정했습니다. 상세 이미지 최대 12장, 후기 사진 최대 5장을 지원하며 각 파일을 개별 요청으로 업로드합니다. 파일 형식과 후기 사진 소유권을 서버에서 검사합니다. 기존 업로드 중 4MB를 넘는 이미지는 이전 시 압축하거나 직접 업로드·다운로드 방식을 추가해야 합니다.

## 기존 데이터 이전

이 ZIP에는 소스와 기본 이미지만 있습니다. **운영 DB·고객 문의·후기·업로드 사진·비밀값은 자동 이전하지 않았습니다.**

새 DB로 시작하면 `pnpm db:migrate` 후 첫 관리자 상품/FAQ 변경 시 기본 상품 3개와 FAQ를 저장합니다.
기존 데이터를 가져오려면:

1. 기존 D1의 SQL 내보내기와 R2 사진 백업을 준비합니다.
2. 테이블이 없는 빈 libSQL DB에 `pnpm db:import -- /경로/export.sql`을 실행합니다. 대상에 테이블이 있으면 중단합니다. 신뢰하는 백업 SQL만 사용하세요. 내보내기 형식에 따라 시스템 테이블·PRAGMA 정리가 필요할 수 있습니다.
3. `pnpm db:adopt`를 실행하면 가져온 스키마가 현재 마이그레이션 결과와 일치하는지 검사하고 기준 정보만 등록합니다. 일치하지 않으면 중단하므로 별도 스키마 조정이 필요합니다. 이미 테이블이 있는 DB에 일반 `db:migrate`를 바로 실행하지 마세요.
4. R2를 S3 API로 그대로 연결하거나 `products/` 객체 키를 유지해 사진을 복사합니다.
5. Sites 사용자 ID와 새 Google 사용자 ID는 다릅니다. 기존 문의·후기·주문서를 고객 본인에게 연결하려면 실제 계정 소유권을 확인한 매핑이 별도로 필요합니다. 이메일만으로 임의 연결하지 않습니다.
6. 이전 검증 후 도메인을 전환합니다. Sites의 비공개·접근 설정은 Vercel에 복사되지 않습니다. Vercel 프로젝트의 공개·보호 설정을 확인하세요.

## 결제 상태

PG 미계약 상태를 유지했습니다. **주문서 저장은 구매·결제·출고가 아닙니다.** 카드·간편결제는 미연결입니다. 실제 판매에는 PG 계약, 서버 승인·금액 검증·웹훅·취소·재고·배송 연동이 추가로 필요합니다.

## 검증

```sh
pnpm typecheck
pnpm test
pnpm build
```

타입 검사, 로컬 DB 검증, 실제 Next.js 프로덕션 빌드를 확인했습니다. Google OAuth, 원격 DB, 실제 S3, Vercel 배포는 사용자 자격증명 연결 후 확인해야 합니다. 서비스 계정 생성·결제 계약·Vercel 배포는 수행하지 않았습니다.

공식 참고 문서:

- [Next.js App Router](https://nextjs.org/docs/app)
- [Auth.js 설치](https://authjs.dev/getting-started/installation)
- [Google 공급자](https://authjs.dev/getting-started/providers/google)
- [libSQL SDK](https://docs.turso.tech/sdk/ts/reference)
- [S3 JavaScript SDK](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_s3_code_examples.html)
- [Vercel Function 제한](https://vercel.com/docs/functions/limitations)
