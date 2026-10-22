# Crypto icons

Coin (`*.svg`) and network (`networks/*.svg`) icons for the banner checkout's payment picker.

**Source:** [`@web3icons/core`](https://www.npmjs.com/package/@web3icons/core) 4.0.55, the "background" variant (`dist/svgs/tokens/background/*` and `dist/svgs/networks/background/*`). The SVG strings were copied out of the package's JS modules unchanged, apart from removing `class="web3icons"`. Toncoin (`ton.svg`) uses the TON network mark, because the set has no separate token icon for it.

**License:** MIT, https://github.com/0xa3k5/web3icons

```
MIT License

Copyright (c) 2024 0xa3k5

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

The coin and network logos are trademarks of their projects. They are used here only to identify the payment method.

To add a coin, put `<coin>.svg` here (and `networks/<network>.svg` for a token on a new network), then add a method to `payments.methods` in `backend/config/banners.php`. Its `coin` (lower-cased) and `network_icon` must match the file names. Network icons are only used for tokens that live on another chain (USDT on Tron); a chain's own coin shows its coin icon.
