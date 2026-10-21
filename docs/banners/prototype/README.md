# Banner prototype (smuzzie)

Шаблон: видео из AE без текста + `template.json` с зонами. Покупатель меняет тексты, логотип и цвет, превью обновляется сразу. Итоговый файл совпадает с превью, потому что слой текста и лого рисует один и тот же `overlay.js`.

## Файлы
- `public/template/template.json`: зоны в % от размера видео, шрифт, размер, лимит символов
- `public/template/source.mp4`: исходник клиента (в проде лежит в приватном хранилище, наружу не отдаётся)
- `public/template/preview.mp4`: 720px, с вшитым водяным знаком, только он виден на сайте
- `public/overlay.js` + `overlay.css`: общий слой текста/лого, автоподгонка шрифта, матрица hue
- `public/index.html`: редактор (референс для компонента на Next)
- `public/render.html`: тот же слой для headless Chromium
- `tools/render.cjs`: рендер: Chromium -> overlay.png, ffmpeg -> banner.mp4 + banner.gif
- `tools/watermark.py`: водяной знак для preview.mp4

## Запуск
```
cd public && python3 -m http.server 8080      # редактор: http://localhost:8080
npm i playwright && npx playwright install chromium
node tools/render.cjs public/template sample/data.json sample/out
```

## Сборка preview.mp4 при загрузке шаблона
```
python3 tools/watermark.py 720 842 wm.png
ffmpeg -i source.mp4 -i wm.png -filter_complex "[0:v]scale=720:842[v];[v][1:v]overlay=0:0,format=yuv420p" -an -c:v libx264 -crf 27 -movflags +faststart preview.mp4
```

## Цвет
CSS `hue-rotate` и ffmpeg `hue` считают по-разному (средняя разница 2-3 единицы на канал, на глаз заметно). В рендере используется `colorchannelmixer` с матрицей CSS: разница с превью ~0.4 из 255.

## Замеры (1450x1694, 4 c)
overlay ~1.6 c, MP4 ~10 c, GIF ~3.5 c. MP4 2.4 МБ, GIF 600px 4.7 МБ.
