# ألعاب أثَر

ألعاب ومسابقات ثقافية جماعية من لجنة أثَر، كل لعبة في مجلد خاص بها.

| اللعبة | المجلد | الوصف |
|---|---|---|
| ترابيع | `tarabee/` | جاوب صح واحتل المربعات، والأكثر يفوز |
| من سيربح التيلفون | `telephone/` | أسئلة شفهية بسُلّم نقاط تصاعدي وخزينة ووسائل مساعدة |
| السلم والثعبان | `snakes/` | نرد وسلالم وثعابين بلوحة واقعية وخمسة أشكال وثلاثة توزيعات |
| ديوان | `diwan/` | بنك أسئلة المسابقات: ١١٨٨ سؤالًا في ١٣ ديوانًا، بهوية ديوان مع التبديل إلى ثيمات أثَر |

## الهيكلة
```
index.html, home.css, home.js   الصفحة الرئيسية
assets/athar.css                الهوية المشتركة: الخط، الثيمات، الشعار
assets/athar-sound.js           الأصوات المشتركة (مؤثرات بلا موسيقى ولا آلات)
assets/sounds/                  مقاطع صوتية مسجّلة (إعلان الفائز)
assets/*.png                    شعارات أثَر (الأساسي والمعكوس)
assets/fonts/                   ملفات خط ثمانية (لا تُرفع بسبب الترخيص)
tarabee/                        لعبة ترابيع
telephone/                      مسابقة من سيربح التيلفون
snakes/                         لعبة السلم والثعبان
diwan/                          بنك أسئلة ديوان (data.js مولّد من ملفات الأسئلة الأصلية)
```

## قواعد ثابتة لكل الألعاب
- هوية أثَر: خط Thmanyah Sans، وثلاثة ثيمات (فاتح، كحلي، أزرق أثَر) مع مبدّل محفوظ
- عربي واتجاه RTL، ومتجاوب مع الجوال والآيباد والكمبيوتر
- الأصوات مؤثرات صوتية فقط (طبيعة، فم، تصفير، تصفيق…)، بلا موسيقى ولا آلات

## إضافة لعبة جديدة
أنشئ مجلدًا باسم اللعبة فيه `index.html` و`style.css` و`app.js`، واربط `../assets/athar.css` قبل ملف التنسيق، ثم أضف بطاقتها في `index.html` الرئيسي.

## الخط
ضع `thmanyahsans-Medium.woff2` و`thmanyahsans-Bold.woff2` في `assets/fonts/` محليًا. بدونها يعمل الخط الاحتياطي IBM Plex Sans Arabic.

## شكر وتقدير: الأصوات
مقطع إعلان الفائز `assets/sounds/winner-cheer.mp3` مزيج من انبثاق مولّد برمجيًا وتسجيلين حقيقيين، ويُنشر بترخيص [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) لأنه مشتق من تسجيل بهذا الترخيص:

- **Arrowhead Stadium crowd noise** لـ Kj1595، بترخيص [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)، من [Wikimedia Commons](https://commons.wikimedia.org/w/index.php?curid=83467289). التعديلات: قصّ، خفض المستوى، مزج.
- **Applause 2** لـ Sandermotions، بترخيص [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)، من [Wikimedia Commons](https://commons.wikimedia.org/w/index.php?curid=117971683).
