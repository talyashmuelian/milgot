# מעקב מלגות אברכים

## מבנה הפרויקט

- `backend/` — שרת Flask + SQLite (REST API)
- `frontend/` — אתר React (Vite)

## הרצה מקומית

### שרת (backend)

```
cd backend
venv\Scripts\activate
python app.py
```

השרת יעלה על `http://127.0.0.1:5000`. מסד הנתונים נשמר בקובץ `backend/milgot.db`.

### אתר (frontend)

```
cd frontend
npm install
npm run dev
```

האתר יעלה על `http://localhost:5173` (או פורט אחר אם תפוס). בזמן פיתוח, Vite מנתב כל בקשה ל-`/api/...` אל השרת שרץ על פורט 5000 (מוגדר ב-`frontend/vite.config.js`), כך שהשרת עדיין צריך לרוץ במקביל.

## פריסה אמיתית (לא רק מקומית)

הארכיטקטורה המומלצת: **שרת Flask אחד בלבד**, שמגיש גם את ה-API וגם את קובצי האתר הבנויים (React build). ככה אין צורך בשני אחסונים נפרדים, ואין בעיות CORS כי הכול מגיע מאותו origin.

### שלב 1 — בניית האתר

```
cd frontend
npm run build
```

זה יוצר תיקיית `frontend/dist` עם הקבצים הסטטיים. **התיקייה הזו כן נשמרת ב-git במכוון** (בניגוד לברירת המחדל של Vite) — כי ל-PythonAnywhere אין Node/npm מותקן, ואי אפשר לבנות שם את האתר. בכל פעם שמשנים משהו ב-frontend, צריך להריץ `npm run build` מחדש ולעשות commit לתיקיית ה-`dist` המעודכנת.

### שלב 2 — העלאה ל-GitHub

```
git remote add origin <כתובת הריפו שיצרת ב-GitHub>
git push -u origin main
```

(את הריפו עצמו יוצרים דרך אתר GitHub — "New repository" — ומעתיקים את הכתובת שהוא נותן.)

### שלב 3 — PythonAnywhere

1. **Consoles** ← פתחי **Bash console** חדש, ואז:
   ```
   git clone <כתובת הריפו>
   cd <שם-הריפו>
   python3.10 -m venv backend/venv
   source backend/venv/bin/activate
   pip install -r backend/requirements.txt
   ```
2. **Web** ← **Add a new web app** ← **Manual configuration** ← בחרי גרסת Python שתואמת למה שהשתמשת בה למעלה.
3. באותו עמוד, מלאי:
   - **Source code**: `/home/<username>/<שם-הריפו>`
   - **Virtualenv**: `/home/<username>/<שם-הריפו>/backend/venv`
4. פתחי את קובץ ה-**WSGI configuration file** (יש לינק בעמוד ה-Web) ומחליפים את כל התוכן ב:
   ```python
   import sys
   path = '/home/<username>/<שם-הריפו>/backend'
   if path not in sys.path:
       sys.path.insert(0, path)
   from app import app as application
   ```
5. לוחצים **Reload**. האתר יהיה זמין ב-`https://<username>.pythonanywhere.com`.

### חשוב — גופן עברי בלינוקס

ה-PDF-ים מסתמכים היום על `C:\Windows\Fonts\arial.ttf`, שכמובן לא קיים בלינוקס. ב-`backend/pdf.py` יש כבר רשימת גיבוי (`_FONT_CANDIDATES`) עם נתיבים נפוצים בלינוקס (DejaVu Sans / Liberation Sans), אבל **כדאי לוודא שאחד מהם באמת קיים** ב-PythonAnywhere לפני שסומכים על הורדת PDF שם:
```
fc-list :lang=he
```
אם שום דבר לא מופיע, צריך להוסיף נתיב לגופן עברי אחר לרשימה (ואז git push + git pull + Reload).

### עדכון האתר אחרי שינויים עתידיים

```
# מקומית: בני מחדש ושלחי
cd frontend && npm run build && cd ..
git add -A && git commit -m "..." && git push

# ב-PythonAnywhere (Bash console):
cd <שם-הריפו> && git pull
# אם requirements.txt השתנה: pip install -r backend/requirements.txt (בתוך ה-venv)
# ואז ב-Web tab: Reload
```

### הערה לגבי מסד הנתונים והפרטיות

ה-`milgot.db` המקומי (עם כל האברכים שהוספת בפיתוח) **לא** עולה ל-git — בכוונה, כדי לא לדחוף נתוני בדיקה לפרודקשן. השרת ב-PythonAnywhere יתחיל עם מסד נתונים ריק לגמרי בהרצה הראשונה.

בנוסף — כרגע אין באתר שום מנגנון התחברות/הרשאות. כל מי שיש לו את הקישור `https://<username>.pythonanywhere.com` יכול לראות ולערוך את כל הנתונים. אם זה משהו שמפריע, כדאי לדבר איתי על הוספת הגנה (למשל סיסמה בסיסית) לפני ששולחים את הקישור הלאה.

## מה קיים כרגע

- ניהול רשימת אברכים (הוספה / עריכה / מחיקה)
- בחירת אברך ואז חודש (שנה לועזית, ניתן לדפדף בין שנים)
- לכל אברך+חודש: שעות לימוד, שעות מוחרגות, וכפתור "חשב מלגת נוכחות" (כרגע מחזיר תמיד 100 ש"ח — ניתן להחליף בנוסחה האמיתית ב-`backend/calculations.py`)
- ארבעה checkboxes וכפתור "חישוב כלל המלגה" (כרגע = סכום הנוכחות בלבד, ללא תוספת מהצ'קבוקסים — גם זה ב-`backend/calculations.py`)
- כל הנתונים נשמרים במסד הנתונים לפי אברך+שנה+חודש
- הורדת PDF בשלוש רמות: רשומה בודדת (אברך+חודש), דוח לכל האברכים בחודש נבחר, ודוח לכל חודשי השנה עבור אברך נבחר (נוצר ב-`backend/pdf.py`, מבוסס על reportlab + python-bidi וגופן Arial המקומי של Windows לתמיכה בעברית)
- טאב "לוח שנה": לוח חודשי עם ניווט בין חודשים, המדגיש שישי/שבת, ימי חג וערבי חג (מחושבים לפי הלוח העברי דרך `pyluach`, ב-`backend/holidays.py`). מתחת ללוח, שדה "מספר שעות בחודש" עם ברירת מחדל = ימי עסקים × 8 (לא כולל שישי/שבת/חג/ערב חג), הניתן לעריכה ושמירה ידנית לכל חודש+שנה (מודל `MonthHours`)

### הערה לגבי ה-PDF

הטקסט העברי בקבצי ה-PDF מסודר בסדר "ויזואלי" (מראה נכון על הדף), אבל אם מנסים להעתיק ממנו טקסט הוא עלול לצאת הפוך — זו מגבלה ידועה של הגישה הזו (reportlab לא תומך native ב-RTL). לצורך הדפסה/צפייה זה לא משנה כלום.

בנוסף, ה-PDF מסתמך כרגע על `C:\Windows\Fonts\arial.ttf` (קיים בכל Windows). בפריסה עתידית ללינוקס (כמו PythonAnywhere) יהיה צריך להוסיף שם נתיב לגופן עברי מקביל ברשימת `_FONT_CANDIDATES` ב-`backend/pdf.py`.

### הערה לגבי חישוב ימי העסקים בלוח השנה

הימים שיורדים אוטומטית מברירת המחדל: שישי, שבת, וימי החג "האמיתיים" (ראש השנה, יום כיפור, סוכות יום א׳, שמחת תורה, פסח יום א׳ ויום ז׳, שבועות) + היום שלפניהם (ערב חג). חול המועד, תעניות (צום גדליה, תשעה באב וכו') וחגים קלים (פורים, חנוכה, ל״ג בעומר וכו') **לא** יורדים אוטומטית — הם מוצגים בלוח לידיעה בלבד. אם צריך להוריד גם אותם, עורכים את השדה "מספר שעות בחודש" ידנית. הרשימה המדויקת נמצאת ב-`backend/holidays.py` (`YOM_TOV_DATES`).
