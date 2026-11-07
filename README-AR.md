# Fortnite Wishlist
تطبيق PWA عربي/إنجليزي لمتابعة عناصر Fortnite وحفظ المفضلة.

## التشغيل
1. ثبّت Node.js 18 أو أحدث.
2. نفّذ npm install ثم npm start.
3. افتح http://localhost:3000.

## الإشعارات
تتطلب HTTPS ومفاتيح VAPID. أنشئها باستخدام npx web-push generate-vapid-keys ثم أضف VAPID_PUBLIC_KEY وVAPID_PRIVATE_KEY وVAPID_SUBJECT إلى متغيرات البيئة في الاستضافة. لا تشارك المفتاح الخاص.

## النشر
يحتاج استضافة Node.js دائمة وتخزيناً دائماً لمجلد data. المتجر يعتمد على itemshop.gg والكتالوج على fortnite-api.com، وهما مصدران غير رسميين وقد تتغير واجهاتهما. المشروع غير تابع لـ Epic Games.