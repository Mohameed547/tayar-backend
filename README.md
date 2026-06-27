# DeliverHub Backend (JavaScript)

نسخة JavaScript عادية (بدون TypeScript) من باكند DeliverHub.

## الحالة الحالية

كل ملف فيه `// TODO` بس، يعني التقسيمة جاهزة ومحتاجة نملاها مع بعض ملف بملف.

## ملاحظات على التحويل من TypeScript

- شيلنا كل ملفات `*.types.ts` لأن الـ interfaces مش موجودة في JS.
- شيلنا `tsconfig.json` بالكامل.
- ضفنا `src/shared/constants/` كبديل لمحتوى الـ enums اللي كانت في ملفات الـ types (زي حالات الشحنة، الأدوار، حالات العرض).
- كل المنطق (logic) هيفضل زي ما هو، بس من غير type annotations.

## ترتيب الشغل المقترح (عشان مانتوهش)

1. `src/shared/constants/` — القيم الثابتة (roles, شحنة status, عرض status)
2. `src/shared/utils/` — الأدوات المساعدة (ApiError, ApiResponse, jwt, otp...)
3. `src/config/` — إعدادات الاتصال (database, redis, env...)
4. `src/database/models/` — الموديلز
5. `src/shared/middleware/` — الميدلوير
6. `src/modules/auth/` — أول موديول كامل (controller + service + routes + validation)
7. باقي الـ modules بالترتيب: users → drivers → offices → shipments → offers → tracking → escrow → wallet → disputes → support → reviews → notifications → admin
8. `src/jobs/`
9. `src/routes/index.js` — تجميع كل الراوتس
10. `src/app.js` و `src/server.js` — نقطة التشغيل

## تشغيل المشروع (لاحقًا بعد التعبئة)

```bash
npm install
npm run dev
```

## Office Module (إدارة الكباتن من المكتب)

### شرح نظام الأدوار (Roles)

في النظام 4 أدوار أساسية (`src/shared/constants/roles.js`):

- `customer` — العميل اللي بيطلب شحنة.
- `driver` (= `CAPTAIN` في الكود) — الكابتن اللي بيوصّل الشحنة. ممكن يكون:
  - **Independent Captain**: سجل نفسه بنفسه عن طريق `POST /auth/register` بـ `role: "driver"`. الـ `Driver.officeId` بتاعه بيفضل `null`.
  - **Office Captain**: تم إنشاؤه من خلال مكتب شحن عن طريق `POST /office/captains` فقط، ومش بيقدر يسجل نفسه من الفرونت. الـ `Driver.officeId` بتاعه بيشاور على المكتب اللي عمله.
- `office` — مكتب الشحن (Admin/Management level). بيسجل نفسه عن طريق `POST /auth/register` بـ `role: "office"`، وبيدير الكباتن التابعين له فقط.
- `admin` — أدمن المنصة.

الفرق بين الكباتن بيتحدد من خلال حقل واحد فقط: `Driver.officeId`. لو `null` يبقى كابتن مستقل، لو فيه قيمة يبقى تابع لمكتب.

### صلاحيات المكتب (Office Permissions)

كل الـ routes تحت `/office/*` محمية بـ:

```js
router.use(authenticate, authorize(ROLES.OFFICE));
```

يعني لازم يكون المستخدم عامل login وبدوره `office`. أي كابتن (`driver`) أو عميل (`customer`) هياخد `403 Forbidden` لو حاول يدخل على أي endpoint من دول.

كل query على الكباتن بتتفلتر تلقائيًا بـ `officeId` بتاع المكتب الحالي (`Office.findOne({ user: req.user._id })`)، يعني مكتب A مش هيقدر يشوف أو يعدّل كباتن مكتب B خالص.

### Endpoints المتاحة

| Method | Endpoint | الوظيفة |
|---|---|---|
| POST | `/api/office/captains` | إنشاء كابتن جديد تابع للمكتب |
| GET | `/api/office/captains` | عرض كل كباتن المكتب الحالي (مع فلترة بالـ status واختيارية pagination) + ملخص تحليلات (إجمالي الكباتن / الكباتن النشطين) |
| GET | `/api/office/captains/:id` | تفاصيل كابتن واحد (بالإضافة لعدد الأوردرات بتاعته) |
| PATCH | `/api/office/captains/:id` | تعديل بيانات كابتن (الاسم، الموبايل، نوع العربية، رقم اللوحة) |
| PATCH | `/api/office/captains/:id/status` | تحديث حالة الكابتن: `online` / `available` / `busy` / `offline` |
| DELETE | `/api/office/captains/:id` | تعطيل الكابتن (soft delete). ضيف `?hard=true` للحذف النهائي |
| GET | `/api/office/captains/:id/tracking` | آخر حالة/موقع معروف للكابتن + بيانات تتبع الشحنة النشطة (لو موجودة) |

### تشغيل الموديول

الموديول مش محتاج أي إعداد إضافي، شغّال جوه نفس السيرفر:

```bash
npm install
npm run dev
```

بعد كده:

1. سجّل مكتب: `POST /api/auth/register` بـ `role: "office"`.
2. اعمل login واخد الـ `accessToken`.
3. استخدم التوكن في الـ Postman collection (فولدر **Office**) لتجربة كل الـ endpoints.

### ملاحظات مهمة

- إنشاء كابتن من المكتب بيعمل `User` بحالة `active` و `isPhoneVerified: true` تلقائيًا (مفيش OTP لأن المكتب هو المسؤول عن التحقق).
- لو المكتب مبعتش `password` عند إنشاء الكابتن، السيستم بيولّد باسورد عشوائي ويرجعه في الـ response تحت `temporaryPassword` (لازم يتشارك مع الكابتن بطريقة آمنة).
- النظام الحالي للـ authentication (`/auth/login`, `/auth/register`, refresh tokens...) متعمل فيه تعديل صفر.

## Office Offer Distribution (Critical feature)

عشان كباتن أو مكاتب يقدروا يبعتوا عروض على شحنات العملاء، ويوزّع المكتب الشحنة على كباتنه:

1. **تصفح الشحنات المفتوحة** — `GET /shipments/available` (دور `driver` أو `office`). بيرجع كل الشحنات بحالة `pending_offers` اللي لسه معمول عليها عرض من نفس اليوزر.
2. **تقديم عرض** — `POST /offers/create` (موجود مسبقًا، متعمل فيه تعديل صفر).
3. **عروضي** — `GET /offers/mine` endpoint جديد، بيرجع كل العروض اللي قدمها اليوزر الحالي (كابتن مستقل أو مكتب).
4. **قبول العميل للعرض** — `PATCH /offers/:offerId/accept` (موجود). تم تصحيح المنطق هنا:
   - لو العرض كان من **مكتب**: الشحنة بترتبط بـ `assignedOffice` (مش `captain`)، وتفضل في انتظار تعيين كابتن.
   - لو العرض كان من **كابتن مستقل**: الشحنة بترتبط بـ `captain` (User id بتاع الكابتن) مباشرة، ويتم تفعيل tracking تلقائيًا.
5. **توزيع المكتب للشحنة على كباتنه**:
   - `GET /office/offers` — الشحنات اللي المكتب كسبها بس لسه مش متعينلها كابتن.
   - `GET /office/offers/assigned` — الشحنات اللي اتعينلها كابتن فعلاً.
   - `PATCH /office/offers/:offerId/assign/:captainId` — تعيين كابتن (لازم يكون تابع لنفس المكتب ونشط).
   - `PATCH /office/offers/:offerId/reassign/:captainId` — تغيير الكابتن المعين.
   - `PATCH /office/offers/:offerId/reject` — رفض الشحنة، بترجع للسوق (`pending_offers`) تاني.
   - `GET /office/dashboard` — ملخص (عدد الكباتن، النشطين، المتصلين، الشحنات المعلقة والمعينة).
6. **شحناتي الحالية** — `GET /shipments/mine/assigned?status=...` (دور `driver` أو `office`) لعرض الأوردرات النشطة أو المسلّمة.

## باقي الـ Modules اللي تم استكمالها

- **Captain Performance** (`/office/captains/:id/performance`, `/ratings`, `/orders`, `/deliveries`) — إحصائيات حقيقية من `Shipment` و `Review` collections.
- **Wallet** — الموديول كان شغال بالفعل (`GET /wallet`, `POST /wallet/topup`, `POST /wallet/withdraw`, `GET /wallet/transactions`)، تمت إضافة aliases: `POST /wallet/deposit`, `GET /wallet/history`.
- **Earnings** — `GET /captain/earnings` و `GET /office/earnings` (يومي/أسبوعي/شهري/إجمالي، محسوبة من شحنات `delivered`).
- **Ratings** — `GET /captain/ratings`, `GET /office/ratings` (متوسط التقييم + قائمة المراجعات)، و `POST /ratings` كـ alias لـ `POST /reviews/addReview`.
- **Profile** — الموديول كان شغال (`/profile/getProfile`, `/profile/updateProfile`)، تمت إضافة REST aliases: `GET /profile`, `PATCH /profile`, وإضافة `PATCH /profile/password` و `PATCH /profile/avatar`.
- **Notifications** — كان مكتمل بالفعل (`GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`, `GET /notifications/unread-count`). مفيش تعديل.
- **Verification** — موديول جديد كامل: `POST /captain/verification/upload` (تسجيل رابط مستند بعد رفعه)، `GET /captain/verification/status`، و `PATCH /captain/verification/review` (للأدمن فقط).
- **Real-time Tracking (Socket.IO)** — `recordLocationPing` و `updateStatus` بقوا بيبثوا (`emit`) لغرفة `shipment:<id>` تلقائيًا (`locationUpdate`, `shipmentStatusUpdate`). الكباتن كمان يقدروا يبعتوا الموقع مباشرة عن طريق socket event `captain:updateLocation` بدل REST.

> **ملاحظة هندسية**: حقل `Shipment.captain` كان بيُستخدم بشكل خاطئ ليحمل `Driver._id` أو `Office._id` (مش `User._id` كما هو معرّف في الـ schema). تم تصحيح هذا في مسار قبول العرض (`acceptOffer`) فقط — أي مكان آخر لسه بيستخدم الـ pattern القديم محتاج مراجعة لو حصل توسع مستقبلي.
