# Tomanify

Tomanify adds the toman price next to foreign prices while you browse. A dollar amount on Amazon, a pound price in a YouTube title, a dirham on a shop page: the green badge appears beside it.

Rates come from [alanchand.com](https://alanchand.com). They are saved for one hour. When that hour is up, the popup says **منقضی** and fetches them again in the background. You can also press **به‌روزرسانی** yourself.

![Tomanify](preview.png)

## Install

1. Download [Tomanify-2.3.4.zip](https://github.com/mohamadaz-apps/tomanify/releases/latest) and unzip it.
2. Open `chrome://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked** and choose the unzipped `Tomanify` folder. That folder contains `manifest.json`. Do not select the zip.
5. Open the popup once and click **به‌روزرسانی**.

To update later, remove the old Tomanify on that same page and load the new folder. If you cloned this repo instead of using the zip, load the `tomanify` folder. The files are the same.

## What the badge reads

The old reader took every digit in the line and stuck them together. A title like `5 best laptops under $499 (in 2026)` became one huge number. `£1.7M` was read as 1.7 pounds.

Tomanify now keeps only the number touching each currency symbol. A count or a year in the same sentence stays out. `K`, `M`, and `B` are applied, and so are million, billion, میلیون, میلیارد, and هزار. If a line has two prices, such as `£100/$125`, both are converted.

This deciding is done on your computer. The page is not sent anywhere.

The badge uses Vazirmatn, which is included in the extension. The font is licensed under the SIL Open Font License. See `fonts/OFL.txt`.

## The popup

The popup shows the current rate for each currency, in toman. You can change the badge size and colors, and hide the word تومان if you only want the number.

If a site already shows toman or rial prices, Tomanify leaves it alone.

## Files

- `manifest.json` is the Chrome extension manifest.
- `background.js` fetches and caches the rates.
- `content.js` finds prices and draws the badges.
- `price-mind.js` picks the number next to each symbol.
- `utils.js` formats the numbers.
- `popup.html` and `popup.js` are the popup.
- `fonts/` is Vazirmatn.
- `icons/` holds the toolbar icons.

## Support

If Tomanify is useful to you, you can send USDT on BNB Smart Chain (BEP20):

`0x2Bf99Bf8EB11BEC0fC74A15CB2Ba8c6b9161EFF9`

## Author

Mohammad Alizade (A.Z)
[github.com/mohamadaz-apps](https://github.com/mohamadaz-apps)

## License

MIT © Mohammad Alizade (A.Z)

---

# تومان‌فای

تومان‌فای کنار قیمت‌های خارجی، معادل تومان را نشان می‌دهد. قیمت دلاری در آمازون، قیمت پوندی در عنوان یک ویدیو، یا قیمت درهم در یک فروشگاه. نشان سبز همان‌جا کنار عدد ظاهر می‌شود.

نرخ‌ها از [alanchand.com](https://alanchand.com) می‌آیند و یک ساعت نگه داشته می‌شوند. بعد از آن در پاپ‌آپ نوشته می‌شود **منقضی** و نرخ در پس‌زمینه دوباره گرفته می‌شود. خودتان هم می‌توانید **به‌روزرسانی** را بزنید.

## نصب

1. فایل [Tomanify-2.3.4.zip](https://github.com/mohamadaz-apps/tomanify/releases/latest) را دانلود و از حالت فشرده خارج کنید.
2. در کروم بروید به `chrome://extensions`.
3. **Developer mode** را روشن کنید.
4. **Load unpacked** را بزنید و پوشهٔ `Tomanify` را انتخاب کنید. همان پوشه‌ای که `manifest.json` داخلش است. خود فایل زیپ را انتخاب نکنید.
5. یک بار پاپ‌آپ را باز کنید و **به‌روزرسانی** را بزنید.

برای نسخهٔ بعد، تومان‌فای قبلی را از همان صفحه حذف کنید و پوشهٔ جدید را بارگذاری کنید.

## نشان چه عددی را می‌خواند

خوانندهٔ قدیمی همهٔ رقم‌های یک خط را به هم می‌چسباند. عنوانی مثل `5 best laptops under $499 (in 2026)` یک عدد بسیار بزرگ می‌شد. `£1.7M` هم ۱٫۷ پوند حساب می‌شد.

حالا فقط عددی خوانده می‌شود که به علامت ارز چسبیده است. شمارهٔ یک فهرست، یا سال، داخل قیمت نمی‌رود. پسوندهای `K` و `M` و `B`، و همین‌طور million و billion و میلیون و میلیارد و هزار، حساب می‌شوند. اگر در یک خط دو قیمت باشد، مثل `£100/$125`، هر دو تبدیل می‌شوند.

این تصمیم روی خود کامپیوتر شما گرفته می‌شود. متن صفحه جایی فرستاده نمی‌شود.

فونت نشان وزیرمتن است و داخل خود افزونه قرار دارد. مجوز فونت SIL Open Font License است و متن آن در `fonts/OFL.txt` است.

## پاپ‌آپ

پاپ‌آپ نرخ هر ارز را به تومان نشان می‌دهد. اندازه و رنگ نشان را می‌توانید عوض کنید، و اگر بخواهید کلمهٔ تومان نمایش داده نشود.

سایت‌هایی که خودشان قیمت را به تومان یا ریال نشان می‌دهند کنار گذاشته می‌شوند.

## حمایت

اگر تومان‌فای به کارتان می‌آید، می‌توانید روی شبکهٔ BNB Smart Chain (BEP20) تتر بفرستید:

`0x2Bf99Bf8EB11BEC0fC74A15CB2Ba8c6b9161EFF9`

## نویسنده

محمد علیزاده (A.Z)
[github.com/mohamadaz-apps](https://github.com/mohamadaz-apps)

## مجوز

MIT © محمد علیزاده (A.Z)
